-- R3 local implementation: dedicated acceptance runs, bounded attempts and
-- immutable provider evidence. No seed, credentials, backfill or external call.
begin;
create table public.natori_case_acceptance_runs (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 project_ref text not null check(project_ref <> 'lvnfspyainrxtztjytbo'), origin text not null,
 provider_scope text not null, stripe_account text not null check(stripe_account ~ '^acct_[A-Za-z0-9]+$'),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at > starts_at), enabled boolean not null default false,
 allowed_to text[] not null, human_to text[] not null default '{}', sender text not null, reply_to text not null,
 mail_limit integer not null check(mail_limit between 1 and 1000), human_limit integer not null check(human_limit between 0 and 1000),
 used integer not null default 0 check(used >= 0), human_used integer not null default 0 check(human_used >= 0)
);
create table public.natori_case_acceptance_projects (
 run_id uuid not null references public.natori_case_acceptance_runs(id), project_id uuid not null references public.natori_projects(id),
 primary key(run_id,project_id)
);
create table public.natori_case_mail_bindings (
 job_id uuid primary key references public.natori_notification_jobs(id), run_id uuid not null references public.natori_case_acceptance_runs(id),
 owner_id uuid not null, project_id uuid not null references public.natori_projects(id), provider_scope text not null,
 environment text not null check(environment='acceptance'), request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'), created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_mail_spends (
 claim_token uuid primary key, job_id uuid not null references public.natori_case_mail_bindings(job_id),
 run_id uuid not null references public.natori_case_acceptance_runs(id), created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_mail_events (
 scope text not null, event_id text not null, body_hash text not null check(body_hash ~ '^[0-9a-f]{64}$'),
 job_id uuid not null references public.natori_case_mail_bindings(job_id), run_id uuid not null, provider_id text not null,
 event_type text not null check(event_type in ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed')),
 occurred_at timestamptz not null, received_at timestamptz not null default clock_timestamp(),
 primary key(scope,event_id)
);
create table public.natori_case_mail_provider_map (
 scope text not null, provider_id text not null, job_id uuid not null unique references public.natori_case_mail_bindings(job_id),
 primary key(scope,provider_id)
);
create trigger natori_case_mail_map_immutable before update or delete on public.natori_case_mail_provider_map for each row execute function public.natori_case_reconciliation_immutable_v1();
create index natori_case_mail_events_job on public.natori_case_mail_events(job_id,occurred_at);
create index natori_case_mail_bindings_project on public.natori_case_mail_bindings(project_id,job_id);
create function public.natori_case_acceptance_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$ begin raise exception 'acceptance_evidence_immutable'; end $$;
create trigger natori_case_mail_bindings_immutable before update or delete on public.natori_case_mail_bindings for each row execute function public.natori_case_acceptance_immutable_v1();
create trigger natori_case_mail_spends_immutable before update or delete on public.natori_case_mail_spends for each row execute function public.natori_case_acceptance_immutable_v1();
create trigger natori_case_mail_events_immutable before update or delete on public.natori_case_mail_events for each row execute function public.natori_case_acceptance_immutable_v1();

create function public.natori_case_acceptance_context_v1(p_run uuid,p_owner uuid,p_project uuid,p_mutation boolean default false) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('scope',r.provider_scope,'account',r.stripe_account,'origin',r.origin,'ref',r.project_ref,'paymentUrl',(select a.link_url from public.natori_payment_link_attempts a where a.project_id=p.id and a.owner_id=r.owner_id and a.provider_account_id=r.stripe_account and not a.livemode and a.state='active' and a.deadline>now() order by generation desc limit 1),'active',r.enabled and r.starts_at<=now() and r.ends_at>now())
 from public.natori_case_acceptance_runs r join public.natori_case_acceptance_projects x on x.run_id=r.id
 join public.natori_projects p on p.id=x.project_id and p.user_id=r.owner_id
 where r.id=p_run and r.owner_id=p_owner and p.id=p_project and p.deleted_at is null
 and (not p_mutation or (r.enabled and r.starts_at<=now() and r.ends_at>now() and p.status<>'closed'))
$$;

create function public.natori_case_acceptance_mail_v1(p_run uuid,p_owner uuid,p_project uuid,p_job uuid,p_claim uuid,p_hash text,p_to text,p_sender text,p_reply text,p_origin text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.natori_case_acceptance_runs%rowtype; j public.natori_notification_jobs%rowtype; b public.natori_case_mail_bindings%rowtype; human boolean;
begin
 -- Keep the existing project -> run -> job lock order. The payload guard also
 -- locks this project, so reserving a job first would invert claim/start/finish.
 perform 1 from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('allowed',false); end if;
 -- Global run serialization bounds every HTTP attempt, including retries/Cron.
 select * into r from public.natori_case_acceptance_runs where id=p_run for update;
 if not found or r.owner_id is distinct from p_owner or not r.enabled or r.starts_at>clock_timestamp() or r.ends_at<=clock_timestamp()
  or r.origin is distinct from p_origin or p_to is null or array_position(r.allowed_to,null) is not null or array_position(r.human_to,null) is not null or not coalesce(p_to=any(r.allowed_to),false) or r.sender is distinct from p_sender or r.reply_to is distinct from p_reply
  or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
  or not exists(select 1 from public.natori_case_acceptance_projects x join public.natori_projects p on p.id=x.project_id where x.run_id=r.id and p.id=p_project and p.user_id=p_owner and p.deleted_at is null and p.status<>'closed')
  then return jsonb_build_object('allowed',false); end if;
 select * into j from public.natori_notification_jobs where id=p_job and project_id=p_project for update;
 if not found or j.claim_token is distinct from p_claim or j.status<>'sending' or j.lease_expires_at is null or j.lease_expires_at<=clock_timestamp() then return jsonb_build_object('allowed',false); end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536
  or (j.payload is null and j.send_started_at is not null)
  or (j.payload is not null and j.payload is distinct from p_payload) then return jsonb_build_object('allowed',false); end if;
 if j.payload is null then
  update public.natori_notification_jobs set payload=p_payload where id=j.id returning * into j;
 end if;
 select * into b from public.natori_case_mail_bindings where job_id=j.id;
 if b.job_id is not null then
  if b.run_id<>r.id or b.owner_id<>p_owner or b.project_id<>p_project or b.provider_scope<>r.provider_scope or b.request_hash<>p_hash
   or b.payload_hash<>encode(sha256(convert_to(j.payload::text,'UTF8')),'hex') then return jsonb_build_object('allowed',false); end if;
 elsif j.send_started_at is not null or j.provider_scope is not null or j.provider_livemode is not null then
  return jsonb_build_object('allowed',false); -- Historical sends never acquire guessed provenance.
 end if;
 if exists(select 1 from public.natori_case_mail_spends where claim_token=p_claim and job_id=j.id and run_id=r.id) then
  return jsonb_build_object('allowed',true,'scope',r.provider_scope,'hash',p_hash); end if;
 human:=coalesce(p_to=any(r.human_to),false);
 if r.used>=r.mail_limit or (human and r.human_used>=r.human_limit) then return jsonb_build_object('allowed',false); end if;
 if b.job_id is null then
  insert into public.natori_case_mail_bindings(job_id,run_id,owner_id,project_id,provider_scope,environment,request_hash,payload_hash)
   values(j.id,r.id,p_owner,p_project,r.provider_scope,'acceptance',p_hash,encode(sha256(convert_to(j.payload::text,'UTF8')),'hex'));
  update public.natori_notification_jobs set provider_scope=r.provider_scope where id=j.id;
 end if;
 insert into public.natori_case_mail_spends(claim_token,job_id,run_id) values(p_claim,j.id,r.id);
 update public.natori_case_acceptance_runs set used=used+1,human_used=human_used+case when human then 1 else 0 end where id=r.id;
 return jsonb_build_object('allowed',true,'scope',r.provider_scope,'hash',p_hash);
end $$;

-- Reuse the canonical start guard at the final transport boundary, without a
-- new key, refund or attempt. It rechecks quote/payment/R1 and R2 facts.
create function public.natori_case_acceptance_send_v1(p_run uuid,p_job uuid,p_claim uuid,p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r public.natori_case_acceptance_runs%rowtype; j public.natori_notification_jobs%rowtype;
begin
 perform 1 from public.natori_projects where id=(select project_id from public.natori_notification_jobs where id=p_job) for update;
 select * into r from public.natori_case_acceptance_runs where id=p_run for update;
 if not found or not r.enabled or r.starts_at>clock_timestamp() or r.ends_at<=clock_timestamp() then return false; end if;
 select * into j from public.natori_notification_jobs where id=p_job for update;
 if not found or not exists(select 1 from public.natori_case_mail_bindings b join public.natori_projects p on p.id=b.project_id and p.user_id=b.owner_id
  where b.job_id=j.id and b.run_id=r.id and b.owner_id=r.owner_id and b.provider_scope=r.provider_scope and b.request_hash=p_hash)
  or not exists(select 1 from public.natori_case_mail_spends where claim_token=p_claim and job_id=j.id and run_id=r.id)
  then return false; end if;
 return exists(select 1 from public.natori_notification_start_v1(j.id,p_claim,j.payload));
end $$;

create function public.natori_case_mail_event_v1(p_run uuid,p_scope text,p_event text,p_body_hash text,p_job uuid,p_request_hash text,p_provider text,p_type text,p_occurred timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b public.natori_case_mail_bindings%rowtype; prior public.natori_case_mail_events%rowtype; j public.natori_notification_jobs%rowtype;
begin
 -- No run-enabled/time condition: signed late results must survive a stop.
 select * into b from public.natori_case_mail_bindings where job_id=p_job and run_id=p_run and provider_scope=p_scope;
 if not found or b.request_hash is distinct from p_request_hash or p_provider is null or p_provider !~ '^[A-Za-z0-9_-]{1,200}$'
  or p_event is null or length(p_event)>200 or p_body_hash is null or p_body_hash !~ '^[0-9a-f]{64}$'
  or p_type is null or p_type not in ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed')
  or p_occurred is null or p_occurred>clock_timestamp()+interval '5 minutes' then return jsonb_build_object('result','unmatched'); end if;
 select * into j from public.natori_notification_jobs where id=b.job_id and project_id=b.project_id for update;
 if not found or j.send_started_at is null or p_occurred<j.created_at
  or not exists(select 1 from public.natori_projects where id=b.project_id and user_id=b.owner_id)
  or (j.provider_id is not null and j.provider_id<>p_provider)
  or exists(select 1 from public.natori_case_mail_events where scope=p_scope and ((provider_id=p_provider and job_id<>b.job_id) or (job_id=b.job_id and provider_id<>p_provider)))
  then return jsonb_build_object('result','conflict'); end if;
 select * into prior from public.natori_case_mail_events where scope=p_scope and event_id=p_event;
 if found then
  return jsonb_build_object('result',case when prior.body_hash=p_body_hash and prior.job_id=b.job_id and prior.provider_id=p_provider then 'duplicate' else 'conflict' end);
 end if;
 insert into public.natori_case_mail_provider_map(scope,provider_id,job_id) values(p_scope,p_provider,b.job_id) on conflict do nothing;
 if not exists(select 1 from public.natori_case_mail_provider_map where scope=p_scope and provider_id=p_provider and job_id=b.job_id) then return jsonb_build_object('result','conflict'); end if;
 insert into public.natori_case_mail_events(scope,event_id,body_hash,job_id,run_id,provider_id,event_type,occurred_at)
  values(p_scope,p_event,p_body_hash,b.job_id,b.run_id,p_provider,p_type,p_occurred);
 return jsonb_build_object('result','recorded');
end $$;

create function public.natori_case_mail_evidence_v1(p_owner uuid,p_project uuid,p_job uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reference',e.provider_id,'occurredAt',e.occurred_at,'requestHash',b.request_hash,'scope',b.provider_scope,'run',b.run_id)
 from public.natori_case_mail_bindings b join public.natori_projects p on p.id=b.project_id and p.user_id=b.owner_id
 join lateral(select * from public.natori_case_mail_events x where x.job_id=b.job_id and x.scope=b.provider_scope and x.event_type='email.sent' order by occurred_at,event_id limit 1)e on true
 where b.owner_id=p_owner and b.project_id=p_project and b.job_id=p_job
$$;

-- Exact forward replacements for the R1 mail identity/apply branch follow below.

create or replace function public.natori_case_reconciliation_identity_v1(p_project uuid,p_kind text,p_target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p_kind='mail' then (
  select jsonb_build_object('owner',p.user_id,'project',p.id,'target',j.id,'quote',j.quote_id,'purpose',j.purpose,
   'account',j.provider_scope,'livemode',j.provider_livemode,'reference',j.provider_id,'key','natori-notice/'||j.id,
   'payloadHash',coalesce(b.payload_hash,encode(sha256(convert_to(j.payload::text,'UTF8')),'hex')),'amount',q.amount,'currency','jpy') || case when b.job_id is null then '{}'::jsonb else jsonb_build_object('mailEnvironment',b.environment,'mailRun',b.run_id,'requestHash',b.request_hash) end
  from public.natori_notification_jobs j left join public.natori_case_mail_bindings b on b.job_id=j.id and b.project_id=p.id and b.owner_id=p.user_id left join public.natori_quotes q on q.id=j.quote_id and q.project_id=p.id
  where j.id=p_target and j.project_id=p.id)
 else (
  select jsonb_build_object('owner',p.user_id,'project',p.id,'target',o.operation_id,'attempt',a.id,'generation',a.generation,
   'quote',a.quote_id,'account',a.provider_account_id,'livemode',a.livemode,'amount',a.amount,'currency','jpy','purpose','natori_commission',
   'scope','platform','requestHash',o.request_hash,'price',a.price_id,'link',a.link_id,
   'key','natori-plink/'||a.id||case when p_kind='price' then '/price' else '/link' end)
  from public.natori_payment_link_operations o join public.natori_payment_link_attempts a on a.id=o.attempt_id and a.project_id=p.id and a.owner_id=p.user_id
  where o.project_id=p.id and o.operation_id=p_target)
 end from public.natori_projects p where p.id=p_project
$$;

create or replace function public.natori_case_reconciliation_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare p public.natori_projects%rowtype; a public.natori_payment_link_attempts%rowtype; o public.natori_payment_link_operations%rowtype;
 j public.natori_notification_jobs%rowtype; x public.natori_case_reconciliation_jobs%rowtype;
 e public.natori_case_reconciliation_evidence%rowtype; r public.natori_case_reconciliation_resolutions%rowtype;
 ident jsonb; f jsonb; rev text; t timestamptz; k text; tid uuid; rid uuid; outcome text; money record;
begin
 if p_command='read' then
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id;
 else
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 end if;
 if p.id is null then return jsonb_build_object('result','not_found'); end if;
 if p_command='read' then
  return jsonb_build_object('result','ok','revision',public.natori_case_reconciliation_revision_v1(p.id),
   'operations',coalesce((select jsonb_agg(v) from (select operation_id as id,action,status,reconciliation_id from public.natori_payment_link_operations where project_id=p.id order by created_at desc,operation_id limit 101) v),'[]'),
   'notifications',coalesce((select jsonb_agg(v) from (select id,purpose,status,attempt_no from public.natori_notification_jobs where project_id=p.id order by created_at desc,id limit 101) v),'[]'),
   'mailEvents',coalesce((select jsonb_agg(v) from (select e.job_id,e.event_type,e.occurred_at,e.received_at from public.natori_case_mail_events e join public.natori_case_mail_bindings b on b.job_id=e.job_id where b.project_id=p.id and b.owner_id=p.user_id order by e.received_at desc,e.event_id limit 101)v),'[]'),
   'jobs',coalesce((select jsonb_agg(v) from (select x.id,x.kind,x.target_id,x.state,x.generation,x.created_at,
     e.id as evidence_id,e.facts,r.id as resolution_id from public.natori_case_reconciliation_jobs x
     left join public.natori_case_reconciliation_evidence e on e.job_id=x.id left join public.natori_case_reconciliation_resolutions r on r.job_id=x.id
     where x.project_id=p.id and x.owner_id=p.user_id order by x.created_at desc,x.id limit 101) v),'[]'));
 end if;
 -- Same project -> attempt -> operation/job order as the outbound writer.
 perform 1 from public.natori_payment_link_attempts where project_id=p.id order by generation for update;
 t:=clock_timestamp(); rev:=public.natori_case_reconciliation_revision_v1(p.id);
 if p_command='claim' then
  select * into x from public.natori_case_reconciliation_jobs where id=(p_input->>'id')::uuid;
  if x.id is not null then
   if x.owner_id<>p.user_id or x.project_id<>p.id or x.kind is distinct from p_input->>'kind' or x.target_id is distinct from (p_input->>'target')::uuid or x.mode is distinct from coalesce(p_input->>'mode','read') then return jsonb_build_object('result','conflict'); end if;
   return jsonb_build_object('result','existing','id',x.id);
  end if;
  if rev is distinct from p_input->>'revision' then return jsonb_build_object('result','stale'); end if;
  k:=p_input->>'kind';tid:=(p_input->>'target')::uuid;
  if k not in ('price','link','mail','payment','stop') then return jsonb_build_object('result','invalid_request'); end if;
  ident:=public.natori_case_reconciliation_identity_v1(p.id,k,tid);
  if ident is null then return jsonb_build_object('result','not_found'); end if;
  if coalesce(p_input->>'mode','read') not in ('read','stop') or (p_input->>'mode'='stop' and k<>'stop') then return jsonb_build_object('result','invalid_request'); end if;
  if p_input->>'mode'='stop' and exists(select 1 from public.natori_case_reconciliation_jobs where project_id=p.id and target_id=tid and mode='stop') then return jsonb_build_object('result','needs_review'); end if;
  if exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and (lease_until>t or mail_until>t))
   or exists(select 1 from public.natori_notification_jobs where project_id=p.id and lease_expires_at>t)
   or exists(select 1 from public.natori_payment_link_stops where project_id=p.id and lease_until>t)
   or exists(select 1 from public.natori_case_reconciliation_jobs where project_id=p.id and state='inspecting' and lease_until>t)
   then return jsonb_build_object('result','busy'); end if;
  if jsonb_typeof(p_input->'operator') is distinct from 'object' then return jsonb_build_object('result','invalid_request'); end if;
  insert into public.natori_case_reconciliation_jobs(id,owner_id,project_id,kind,mode,target_id,revision,identity,operator,token,lease_until,state)
   values((p_input->>'id')::uuid,p.user_id,p.id,k,coalesce(p_input->>'mode','read'),tid,rev,ident,p_input->'operator',(p_input->>'token')::uuid,t+interval '60 seconds','inspecting') returning * into x;
  return jsonb_build_object('result','claimed','id',x.id,'generation',x.generation,'identity',ident);
 end if;
 select * into x from public.natori_case_reconciliation_jobs where id=(p_input->>'id')::uuid and project_id=p.id and owner_id=p.user_id for update;
 if x.id is null then return jsonb_build_object('result','not_found'); end if;
 if p_command='fence' then
  if x.mode<>'stop' or x.token is distinct from (p_input->>'token')::uuid or x.generation is distinct from (p_input->>'generation')::integer
   or x.state<>'inspecting' or x.lease_until is null or x.lease_until<=t or x.revision is distinct from rev
   or x.identity is distinct from public.natori_case_reconciliation_identity_v1(p.id,x.kind,x.target_id)
   or p.payment_confirmed_at is not null or p.deleted_at is not null or p.status='closed'
   then return jsonb_build_object('result','stale'); end if;
  return jsonb_build_object('result','current');
 end if;
 if p_command='save' then
  if x.token is distinct from (p_input->>'token')::uuid or x.generation is distinct from (p_input->>'generation')::integer
   or x.state<>'inspecting' or x.lease_until<=t then return jsonb_build_object('result','stale'); end if;
  f:=p_input->'facts';
  if jsonb_typeof(f) is distinct from 'object' or octet_length(f::text)>20000 then return jsonb_build_object('result','invalid_evidence'); end if;
  -- Evidence includes acquisition failures and limits; they never permit resolution.
  insert into public.natori_case_reconciliation_evidence(id,job_id,facts,evidence_hash)
   values((p_input->>'evidenceId')::uuid,x.id,f,encode(sha256(convert_to(f::text,'UTF8')),'hex'));
  update public.natori_case_reconciliation_jobs set state='ready',lease_until=t where id=x.id;
  return jsonb_build_object('result','saved');
 end if;
 if p_command<>'apply' then return jsonb_build_object('result','invalid_command'); end if;
 rid:=(p_input->>'resolutionId')::uuid;
 select * into r from public.natori_case_reconciliation_resolutions where id=rid or job_id=x.id;
 if r.id is not null then
  if r.id<>rid or r.job_id<>x.id then return jsonb_build_object('result','conflict'); end if;
  return jsonb_build_object('result','applied','resolutionId',r.id);
 end if;
 select * into e from public.natori_case_reconciliation_evidence where job_id=x.id and id=(p_input->>'evidenceId')::uuid;
 if e.id is null or x.state<>'ready' or x.revision is distinct from rev then return jsonb_build_object('result','stale'); end if;
 if exists(select 1 from public.natori_case_reconciliation_jobs where project_id=p.id and state='inspecting' and lease_until>t)
  or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and (lease_until>t or mail_until>t))
  or exists(select 1 from public.natori_notification_jobs where project_id=p.id and lease_expires_at>t)
  or exists(select 1 from public.natori_payment_link_stops where project_id=p.id and lease_until>t)
  then return jsonb_build_object('result','busy'); end if;
 f:=e.facts;ident:=public.natori_case_reconciliation_identity_v1(p.id,x.kind,x.target_id);
 if ident is distinct from x.identity or f->'identity' is distinct from ident or f->>'state' is distinct from 'confirmed'
  or not coalesce(f->>'source'='provider_retrieval' or (x.kind='mail' and f->>'source'='provider_webhook' and ident->>'mailEnvironment'='acceptance'),false) or f->>'complete' is distinct from 'true'
  or coalesce(ident->>'account','')='' or (ident->>'livemode' is null and not coalesce(x.kind='mail' and ident->>'mailEnvironment'='acceptance',false)) or coalesce(f->>'reference','')='' or f->>'checkedAt' is null or jsonb_typeof(f->'limits') is distinct from 'array' or f->'limits'<>'[]'::jsonb
  or (f->>'checkedAt')::timestamptz<x.created_at or (f->>'checkedAt')::timestamptz>t+interval '5 seconds'
  then return jsonb_build_object('result','needs_review'); end if;
 if x.kind='mail' then
  if ident->>'mailEnvironment'='acceptance' and f->>'source' is distinct from 'provider_webhook' then return jsonb_build_object('result','needs_review'); end if;
  if f->>'source'='provider_webhook' and not exists(select 1 from public.natori_case_mail_events ev join public.natori_case_mail_bindings mb on mb.job_id=ev.job_id where ev.job_id=x.target_id and mb.owner_id=p.user_id and mb.project_id=p.id and ev.scope=ident->>'account' and ev.provider_id=f->>'reference' and ev.event_type='email.sent' and ev.occurred_at=(f->>'occurredAt')::timestamptz) then return jsonb_build_object('result','needs_review'); end if;
  select * into j from public.natori_notification_jobs where id=x.target_id and project_id=p.id for update;
  if j.status not in ('unknown','sending') or (j.payload is null and not coalesce(ident->>'mailEnvironment'='acceptance' and f->>'source'='provider_webhook',false)) or j.send_started_at is null or ident->>'payloadHash' is null
   or (j.provider_id is not null and j.provider_id is distinct from f->>'reference')
   or f->>'occurredAt' is null or (f->>'occurredAt')::timestamptz<j.created_at or (f->>'occurredAt')::timestamptz>t+interval '5 seconds'
   or f->>'outcome' is distinct from 'accepted' or exists(select 1 from public.natori_notification_jobs where notification_key=j.notification_key and attempt_no>j.attempt_no)
   then return jsonb_build_object('result','needs_review'); end if;
  update public.natori_notification_jobs set status='sent',provider_id=f->>'reference',sent_at=(f->>'occurredAt')::timestamptz,
   error_code=null,claim_token=null,lease_expires_at=null,retry_after=null,updated_at=t where id=j.id;
  if j.purpose='delivery_issue_client' then update public.natori_projects set delivered_mail_at=coalesce(delivered_mail_at,(f->>'occurredAt')::timestamptz) where id=p.id; end if;
  outcome:='accepted_confirmed';
 else
  select * into o from public.natori_payment_link_operations where project_id=p.id and operation_id=x.target_id for update;
  select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
  if exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and generation>a.generation)
   or a.quote_id is distinct from p.active_quote_id then return jsonb_build_object('result','stale'); end if;
  if x.kind='price' then
   if coalesce(f->>'reference','')!~'^price_[A-Za-z0-9]+$' or (a.price_id is not null and a.price_id is distinct from f->>'reference') or f->>'outcome' is distinct from 'created' then return jsonb_build_object('result','needs_review'); end if;
   update public.natori_payment_link_attempts set price_id=f->>'reference',claim_token=null,claim_generation=claim_generation+1,lease_until=null,updated_at=t where id=a.id;
   outcome:='price_confirmed';
  elsif x.kind in ('link','stop') then
   if coalesce(f->>'reference','')!~'^plink_[A-Za-z0-9]+$' or coalesce(f->>'price','')!~'^price_[A-Za-z0-9]+$'
    or (a.link_id is not null and a.link_id is distinct from f->>'reference') or (a.link_url is not null and a.link_url is distinct from f->>'url') or (a.price_id is not null and a.price_id is distinct from f->>'price')
    or coalesce(f->>'url','')!~'^https://buy[.]stripe[.]com/[A-Za-z0-9_]+$' then return jsonb_build_object('result','needs_review'); end if;
   if x.kind='stop' and (f->>'outcome' is distinct from 'stopped' or f->>'sessionsSafe' is distinct from 'true') then return jsonb_build_object('result','needs_review'); end if;
   if x.kind='link' and (a.state='inactive' or exists(select 1 from public.natori_case_reconciliation_resolutions where project_id=p.id and target_id=o.operation_id and kind='stopped_confirmed') or f->>'outcome' is distinct from 'active') then return jsonb_build_object('result','needs_review'); end if;
   update public.natori_payment_link_attempts set price_id=f->>'price',link_id=f->>'reference',link_url=f->>'url',state=case when x.kind='stop' then 'inactive' when deadline<=t then 'stop_required' else 'active' end,
    claim_token=null,claim_generation=claim_generation+1,lease_until=null,review_reason=null,updated_at=t where id=a.id;
   perform set_config('natori.payment_link_writer','v1',true);
   update public.natori_projects set payment_link_id=f->>'reference',payment_link_url=f->>'url',payment_quote_id=a.quote_id,quoted_amount=a.amount,
    payment_link_status=case when payment_confirmed_at is not null then 'paid' when x.kind='stop' then 'void' else 'ready' end where id=p.id;
   if x.kind='stop' then update public.natori_payment_link_stops set status='completed',claim_token=null,claim_generation=claim_generation+1,lease_until=null,updated_at=t where project_id=p.id and attempt_id=a.id and link_id=f->>'reference'; end if;
   outcome:=case when x.kind='stop' then 'stopped_confirmed' else 'link_confirmed' end;
  elsif x.kind='payment' then
   if coalesce(f->>'reference','')!~'^cs_[A-Za-z0-9_]+$' or coalesce(f->>'paymentIntent','')!~'^pi_[A-Za-z0-9]+$' or f->>'outcome' is distinct from 'paid'
    or p.type='undecided' or not exists(select 1 from public.natori_quotes where id=a.quote_id and project_id=p.id and accepted_at is not null and amount=a.amount)
    or a.link_id is null or f->>'link' is distinct from a.link_id or p.payment_quote_id is distinct from a.quote_id
    or p.quoted_amount is distinct from a.amount or exists(select 1 from public.natori_payment_transactions where stripe_session_id=f->>'reference' and
      (project_id<>p.id or (stripe_account_scope is not null and stripe_account_scope<>'platform') or (stripe_livemode is not null and stripe_livemode is distinct from a.livemode) or quote_id is distinct from a.quote_id or amount<>a.amount or (stripe_currency is not null and stripe_currency<>'jpy') or (stripe_payment_intent_id is not null and stripe_payment_intent_id is distinct from f->>'paymentIntent')))
    then return jsonb_build_object('result','needs_review'); end if;
   -- No fabricated event ID: explicit retrieval provenance is the evidence ledger.
   select * into money from public.natori_record_stripe_payment(p.id,f->>'reference',a.amount,a.quote_id);
   if money.result not in ('received','already-paid') then raise exception 'reconciliation_payment_requires_review'; end if;
   update public.natori_payment_transactions set stripe_account_scope='platform',stripe_livemode=a.livemode,
    stripe_currency='jpy',stripe_payment_intent_id=f->>'paymentIntent' where project_id=p.id and stripe_session_id=f->>'reference';
   outcome:='paid_confirmed';
  end if;
 end if;
 -- Only a whole pending link preparation with no outbox effect can be settled by
 -- a link fact. Price/payment/mail evidence never clears another unknown purpose.
 if x.kind in ('link','stop') and o.status='pending' and o.notification_id is null and o.action in ('issue','reissue','renotify') then
  update public.natori_payment_link_operations set reconciliation_id=rid,workspace_request=null,
   workspace_guard=jsonb_build_object('receiptRetention',jsonb_build_object('state','retired','reason','reconciled','retiredAt',t),
    'quote',workspace_guard->'quote','identity',workspace_guard->'identity') where project_id=p.id and operation_id=o.operation_id;
 end if;
 insert into public.natori_case_reconciliation_resolutions(id,job_id,evidence_id,owner_id,project_id,target_id,kind,operator,before_revision,after_revision)
  values(rid,x.id,e.id,p.user_id,p.id,x.target_id,outcome,p_input->'operator',rev,public.natori_case_reconciliation_revision_v1(p.id));
 return jsonb_build_object('result','applied','resolutionId',rid);
end $$;

revoke all on function public.natori_case_reconciliation_immutable_v1(),public.natori_case_reconciliation_revision_v1(uuid),public.natori_case_outbound_blocked_v1(uuid,uuid,uuid),public.natori_case_reconciliation_identity_v1(uuid,text,uuid),public.natori_case_reconciliation_v1(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.natori_case_reconciliation_revision_v1(uuid),public.natori_case_outbound_blocked_v1(uuid,uuid,uuid),public.natori_case_reconciliation_identity_v1(uuid,text,uuid),public.natori_case_reconciliation_v1(uuid,uuid,text,jsonb) to service_role;

-- Forward replacement: generation writer shares the inspection/retired-operation fence.


do $$ declare t text; f record; begin
 foreach t in array ARRAY['natori_case_acceptance_runs','natori_case_acceptance_projects','natori_case_mail_bindings','natori_case_mail_spends','natori_case_mail_events','natori_case_mail_provider_map'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on public.%I to service_role',t);
 end loop;
 grant update on public.natori_case_acceptance_runs to service_role;
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('natori_case_acceptance_immutable_v1','natori_case_acceptance_context_v1','natori_case_acceptance_mail_v1','natori_case_acceptance_send_v1','natori_case_mail_event_v1','natori_case_mail_evidence_v1') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;

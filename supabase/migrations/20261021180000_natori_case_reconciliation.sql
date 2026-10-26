-- R1: append-only provider evidence. No external calls or historical status rewrite.
begin;
create table public.natori_case_reconciliation_jobs (
 id uuid primary key, owner_id uuid not null references auth.users(id), project_id uuid not null references public.natori_projects(id),
 kind text not null check(kind in ('price','link','mail','payment','stop')), mode text not null check(mode in ('read','stop')), target_id uuid not null,
 revision text not null check(revision ~ '^[0-9a-f]{64}$'), identity jsonb not null,
 operator jsonb not null, token uuid not null, generation integer not null default 1,
 lease_until timestamptz not null, state text not null check(state in ('inspecting','ready')),
 created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_reconciliation_evidence (
 id uuid primary key, job_id uuid not null unique references public.natori_case_reconciliation_jobs(id),
 facts jsonb not null, evidence_hash text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_reconciliation_resolutions (
 id uuid primary key, job_id uuid not null unique references public.natori_case_reconciliation_jobs(id),
 evidence_id uuid not null unique references public.natori_case_reconciliation_evidence(id),
 owner_id uuid not null, project_id uuid not null, target_id uuid not null,
 kind text not null, operator jsonb not null, before_revision text not null, after_revision text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.natori_payment_link_operations add column reconciliation_id uuid references public.natori_case_reconciliation_resolutions(id) deferrable initially deferred;
-- Legacy mail has no recorded provider account/mode. Do not infer these from a new credential.
alter table public.natori_notification_jobs add column provider_scope text, add column provider_livemode boolean;
alter table public.natori_case_reconciliation_jobs enable row level security;
alter table public.natori_case_reconciliation_evidence enable row level security;
alter table public.natori_case_reconciliation_resolutions enable row level security;
revoke all on public.natori_case_reconciliation_jobs,public.natori_case_reconciliation_evidence,public.natori_case_reconciliation_resolutions from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_case_reconciliation_jobs to service_role;
grant select,insert on public.natori_case_reconciliation_evidence,public.natori_case_reconciliation_resolutions to service_role;
create function public.natori_case_mail_scope_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 if (new.provider_scope is distinct from old.provider_scope or new.provider_livemode is distinct from old.provider_livemode)
  and (old.send_started_at is not null or old.provider_scope is not null or old.provider_livemode is not null) then raise exception 'mail_provider_scope_immutable'; end if;
 return new;
end $$;
create trigger natori_case_mail_scope_guard before update on public.natori_notification_jobs for each row execute function public.natori_case_mail_scope_guard_v1();
revoke all on function public.natori_case_mail_scope_guard_v1() from public,anon,authenticated;
create index natori_case_reconciliation_project on public.natori_case_reconciliation_jobs(project_id,created_at desc);

create function public.natori_case_reconciliation_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$ begin raise exception 'reconciliation_history_immutable'; end $$;
create trigger natori_case_evidence_immutable before update or delete on public.natori_case_reconciliation_evidence for each row execute function public.natori_case_reconciliation_immutable_v1();
create trigger natori_case_resolution_immutable before update or delete on public.natori_case_reconciliation_resolutions for each row execute function public.natori_case_reconciliation_immutable_v1();

-- Hash canonical records, including late money/inbox/notification facts. Only the hash
-- leaves this helper; frozen payloads, addresses and receipt bodies are not copied.
create function public.natori_case_reconciliation_revision_v1(p_project uuid) returns text
language sql stable security invoker set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_array(to_jsonb(p),
  (select jsonb_agg(to_jsonb(q) order by q.id) from public.natori_quotes q where q.project_id=p.id),
  (select jsonb_agg(to_jsonb(a) order by a.id) from public.natori_payment_link_attempts a where a.project_id=p.id),
  (select jsonb_agg(to_jsonb(st) order by st.id) from public.natori_payment_link_stops st where st.project_id=p.id),
  (select jsonb_agg(to_jsonb(o) order by o.operation_id) from public.natori_payment_link_operations o where o.project_id=p.id),
  (select jsonb_agg(to_jsonb(j) order by j.id) from public.natori_notification_jobs j where j.project_id=p.id),
  (select jsonb_agg(to_jsonb(t) order by t.id) from public.natori_payment_transactions t where t.project_id=p.id),
  (select jsonb_agg(to_jsonb(i) order by i.event_id) from public.natori_stripe_event_inbox i where i.project_id=p.id),
  (select jsonb_agg(to_jsonb(r) order by r.id) from public.natori_refund_ledger r where r.project_id=p.id)
 )::text,'UTF8')),'hex') from public.natori_projects p where p.id=p_project
$$;

-- Shared outbound fence. Positive inbound payment facts remain writable and invalidate
-- the revision above. A resolved pending row is never changed to completed.
create function public.natori_case_outbound_blocked_v1(p_project uuid,p_operation uuid default null,p_job uuid default null)
returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from public.natori_case_reconciliation_jobs j where j.project_id=p_project and j.state='inspecting' and j.lease_until>clock_timestamp())
 or exists(select 1 from public.natori_case_reconciliation_jobs j where j.project_id=p_project and j.mode='stop'
  and not exists(select 1 from public.natori_case_reconciliation_resolutions r where r.project_id=p_project and r.target_id=j.target_id and r.kind='stopped_confirmed' and r.created_at>=j.created_at))
 or exists(select 1 from public.natori_order_mail_logs l where l.project_id=p_project and l.kind='payment' and l.status<>'sent')
 or exists(select 1 from public.natori_payment_link_operations o where o.project_id=p_project and o.status='pending' and (
   (o.operation_id is distinct from p_operation and o.reconciliation_id is null)
   or (o.operation_id=p_operation and (o.reconciliation_id is not null or o.workspace_guard->'receiptRetention'->>'state'='retired'
     or (o.workspace_guard is not null and o.workspace_request is null)))))
 or exists(select 1 from public.natori_notification_jobs j where j.project_id=p_project and j.purpose='payment_link_client' and (
   j.status='unknown' or (j.status='sending' and j.send_started_at is not null and coalesce(j.lease_expires_at,'-infinity')<=clock_timestamp())
   or (j.id is distinct from p_job and j.status in ('pending','sending'))))
$$;

-- The legacy sender writes its pending log BEFORE mail. Serialize that fence
-- with generation begin, including feature-flag rollback and an adoption race.
create function public.natori_case_legacy_mail_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 if new.kind='payment' then
  perform 1 from public.natori_projects where id=new.project_id for update;
  if exists(select 1 from public.natori_payment_link_attempts where project_id=new.project_id) then raise exception 'generation_payment_mail_writer_required'; end if;
 end if;
 return new;
end $$;
create trigger natori_case_legacy_mail_guard before insert on public.natori_order_mail_logs for each row execute function public.natori_case_legacy_mail_guard_v1();
revoke all on function public.natori_case_legacy_mail_guard_v1() from public,anon,authenticated;

-- Current canonical identity, never a browser supplied provider identity.
create function public.natori_case_reconciliation_identity_v1(p_project uuid,p_kind text,p_target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p_kind='mail' then (
  select jsonb_build_object('owner',p.user_id,'project',p.id,'target',j.id,'quote',j.quote_id,'purpose',j.purpose,
   'account',j.provider_scope,'livemode',j.provider_livemode,'reference',j.provider_id,'key','natori-notice/'||j.id,
   'payloadHash',encode(sha256(convert_to(j.payload::text,'UTF8')),'hex'),'amount',q.amount,'currency','jpy')
  from public.natori_notification_jobs j left join public.natori_quotes q on q.id=j.quote_id and q.project_id=p.id
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

create function public.natori_case_reconciliation_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}')
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
  or f->>'source' is distinct from 'provider_retrieval' or f->>'complete' is distinct from 'true'
  or coalesce(ident->>'account','')='' or ident->>'livemode' is null or coalesce(f->>'reference','')='' or f->>'checkedAt' is null or jsonb_typeof(f->'limits') is distinct from 'array' or f->'limits'<>'[]'::jsonb
  or (f->>'checkedAt')::timestamptz<x.created_at or (f->>'checkedAt')::timestamptz>t+interval '5 seconds'
  then return jsonb_build_object('result','needs_review'); end if;
 if x.kind='mail' then
  select * into j from public.natori_notification_jobs where id=x.target_id and project_id=p.id for update;
  if j.status not in ('unknown','sending') or j.payload is null or j.send_started_at is null or ident->>'payloadHash' is null
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
create or replace function public.natori_payment_links_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; q public.natori_quotes%rowtype;
 a public.natori_payment_link_attempts%rowtype; o public.natori_payment_link_operations%rowtype;
 s public.natori_payment_link_stops%rowtype; j public.natori_notification_jobs%rowtype; r public.natori_payment_link_rejections%rowtype;
 t timestamptz:=clock_timestamp(); op uuid; tok uuid; act text; v_deadline timestamptz; n uuid; v_stage text;
 v_live boolean; v_hash text; v_account text; v_value jsonb; last_mail timestamptz;
begin
 if p_owner_id is null then return jsonb_build_object('result','not_found'); end if;
 if p_command='scan' then return jsonb_build_object('result','ok','projects',coalesce((select jsonb_agg(z.id) from
  (select x.id from public.natori_projects x
   cross join lateral (select min(d.updated_at) as touched_at from (
    select st.updated_at from public.natori_payment_link_stops st where st.project_id=x.id and st.status in ('pending','processing')
    union all
    select at.updated_at from public.natori_payment_link_attempts at where at.project_id=x.id
     and at.state in ('active','creating','needs_review','stop_required','deactivating') and (at.link_id is not null or at.link_started_at is not null)
     and (at.deadline<=t or x.status='closed' or x.deleted_at is not null or x.payment_confirmed_at is not null)
   ) d) due
   where x.user_id=p_owner_id and due.touched_at is not null order by due.touched_at,x.id limit 100) z),'[]'::jsonb)); end if;
 select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 if p_command='begin' and p.payment_link_status='issuing' then return jsonb_build_object('result','needs_review'); end if;
 if p_command='outbound_gate' then return jsonb_build_object('result',case when public.natori_case_outbound_blocked_v1(p.id,(p_input->>'operationId')::uuid,null) then 'needs_review' else 'allowed' end); end if;
 if (p_command in ('begin','finish') or (p_command='stage' and coalesce(p_input->>'stage','') not in ('price','link','review')) or (p_command='mail_gate' and coalesce(p_input->>'action','') not in ('release','review')))
  and public.natori_case_outbound_blocked_v1(p.id,(p_input->>'operationId')::uuid,(p_input->>'jobId')::uuid)
  then return jsonb_build_object('result','needs_review'); end if;
 if p_command in ('reconcile_claim','reconcile_save','reconcile_renew','queue_stop','claim_stop','stop_renew','finish_stop')
  and exists(select 1 from public.natori_case_reconciliation_jobs x where x.project_id=p.id and ((x.state='inspecting' and x.lease_until>clock_timestamp()) or (x.mode='stop' and not exists(select 1 from public.natori_case_reconciliation_resolutions z where z.project_id=p.id and z.target_id=x.target_id and z.kind='stopped_confirmed' and z.created_at>=x.created_at))))
  then return jsonb_build_object('result','busy'); end if;
 select * into a from public.natori_payment_link_attempts where project_id=p.id order by generation desc limit 1 for update;
 -- Evaluate deadlines and leases after both project and latest-attempt lock waits.
 t:=clock_timestamp();
 if p_command='rejection' then
  select reason into act from public.natori_payment_link_rejections where project_id=p.id and operation_id=(p_input->>'operationId')::uuid;
  return jsonb_build_object('result',case when act is null then 'unknown' else 'rejected' end,'reason',act,'operationId',p_input->>'operationId');
 end if;
 if p_command in ('reconcile_claim','reconcile_save','reconcile_renew','reconcile_review') then
  tok=(p_input->>'token')::uuid;
  if a.id is null or a.state='inactive' or a.link_id is not null then return jsonb_build_object('result','absent'); end if;
  if a.deadline>t and p.status<>'closed' and p.deleted_at is null and p.payment_confirmed_at is null then return jsonb_build_object('result','not_due'); end if;
  if p_command='reconcile_claim' then
   if a.lease_until>t or a.mail_until>t then return jsonb_build_object('result','busy'); end if;
   if a.link_started_at is null then return jsonb_build_object('result','needs_review'); end if;
   update public.natori_payment_link_attempts set claim_token=tok,claim_generation=claim_generation+1,lease_until=t+interval '60 seconds',updated_at=t where id=a.id returning * into a;
   return jsonb_build_object('result','claimed','attempt',to_jsonb(a));
  end if;
  if a.claim_token is distinct from tok or a.claim_generation is distinct from (p_input->>'generation')::integer or a.lease_until is null or a.lease_until<=t then return jsonb_build_object('result','stale'); end if;
  if p_command='reconcile_renew' then
   update public.natori_payment_link_attempts set lease_until=t+interval '60 seconds' where id=a.id;
   return jsonb_build_object('result','renewed');
  end if;
  if p_command='reconcile_review' then
   update public.natori_payment_link_attempts set state='needs_review',review_reason='expired_creation_result_unresolved',lease_until=null,updated_at=t where id=a.id;
   return jsonb_build_object('result','needs_review');
  end if;
  if coalesce(p_input->>'linkId','')!~'^plink_[A-Za-z0-9]+$' or coalesce(p_input->>'url','')!~'^https://buy[.]stripe[.]com/'
   or p_input->>'verified' is distinct from 'true' then return jsonb_build_object('result','invalid_request'); end if;
  update public.natori_payment_link_attempts set link_id=p_input->>'linkId',link_url=p_input->>'url',state='stop_required',lease_until=null,updated_at=t where id=a.id returning * into a;
  insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
   values(p.id,p.user_id,a.id,a.link_id,a.livemode,'expired_creation_reconciled',a.deadline_revision) on conflict(project_id,link_id) do nothing;
  return jsonb_build_object('result','saved','attempt',to_jsonb(a));
 end if;

 if p_command='context' then return jsonb_build_object('result','ok','attempt',case when a.id is null then null else to_jsonb(a) end,
  'legacyLinkId',p.payment_link_id,'legacyUrl',p.payment_link_url,'quoteId',p.active_quote_id); end if;
 if p_command='operation' then
  select * into r from public.natori_payment_link_rejections where project_id=p.id and operation_id=(p_input->>'operationId')::uuid;
  if r.operation_id is not null then
   if r.request_hash is distinct from p_input->>'hash' then return jsonb_build_object('result','conflict'); end if;
   return jsonb_build_object('result','rejected','reason',r.reason,'operationId',r.operation_id); end if;
  select * into o from public.natori_payment_link_operations where project_id=p.id and operation_id=(p_input->>'operationId')::uuid;
  if o.operation_id is null then return jsonb_build_object('result','absent'); end if;
  if o.request_hash is distinct from p_input->>'hash' then return jsonb_build_object('result','conflict'); end if;
  return jsonb_build_object('result',o.status,'notificationId',o.notification_id);
 end if;
 if p_command='read' then
  select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id;
  return jsonb_build_object('result','ok','state',coalesce(a.state,case when p.payment_link_id is null then 'absent' else 'legacy_review' end),
   'attemptId',a.id,'generation',a.generation,'revision',a.deadline_revision,'deadline',a.deadline,'url',a.link_url,
   'confirmedAt',p.payment_confirmed_at,'terminal',p.status='closed' or p.deleted_at is not null,
   'canIssue',q.accepted_at is not null and q.superseded_at is null and p.status in ('quoted','awaiting_payment') and p.payment_confirmed_at is null,
   'amount',q.amount,'notificationStatus',(select status from public.natori_notification_jobs where id in
     (select notification_id from public.natori_payment_link_operations where project_id=p.id and attempt_id=a.id) order by created_at desc limit 1));
 end if;
 if p_command='close' then
  if p.status<>'closed' and p.status not in ('inquiry','consulting','estimating','quoted','awaiting_payment') then return jsonb_build_object('result','invalid_state'); end if;
  update public.natori_projects set status='closed',next_action='',note=case when coalesce(p_input->>'reason','')='' then note
   else coalesce(note||E'\n\n','')||'[closed '||t::date||'] '||left(p_input->>'reason',2000) end where id=p.id;
  return jsonb_build_object('result','completed');
 end if;
 if p_command='archive' then
  if p.status not in ('closed','completed') or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and state<>'inactive')
   or exists(select 1 from public.natori_payment_link_stops where project_id=p.id and status<>'completed')
   or(p.payment_link_id is not null and coalesce(p.payment_link_status,'') not in ('void','paid')) then return jsonb_build_object('result','unresolved'); end if;
  update public.natori_projects set deleted_at=coalesce(deleted_at,t) where id=p.id; return jsonb_build_object('result','completed');
 end if;
 if p_command='queue_stop' then
  if a.id is null then return jsonb_build_object('result','absent'); end if;
  if a.state='inactive' then return jsonb_build_object('result','completed'); end if;
  if a.deadline>t and p.status<>'closed' and p.deleted_at is null and p.payment_confirmed_at is null then return jsonb_build_object('result','not_due'); end if;
  if (a.lease_until>t or a.mail_until>t) and p.status<>'closed' and p.deleted_at is null then return jsonb_build_object('result','busy'); end if;
  if a.link_id is null then return jsonb_build_object('result','needs_review'); end if;
  update public.natori_payment_link_attempts set state='stop_required',updated_at=t where id=a.id and state not in ('deactivating','inactive');
  insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
   values(p.id,p.user_id,a.id,a.link_id,a.livemode,case when p.payment_confirmed_at is not null then 'paid' when p.status='closed' or p.deleted_at is not null then 'terminal' else 'deadline' end,a.deadline_revision)
   on conflict(project_id,link_id) do nothing; return jsonb_build_object('result','queued');
 end if;
 if p_command in ('claim_stop','stop_renew','finish_stop') then
  tok=(p_input->>'token')::uuid;
  if p_command='claim_stop' then
   select * into s from public.natori_payment_link_stops where project_id=p.id and status in ('pending','processing') order by created_at,id limit 1 for update;
   if s.id is null then return jsonb_build_object('result','absent'); end if;
   t:=clock_timestamp();
   if s.status='processing' and s.lease_until>t then return jsonb_build_object('result','busy'); end if;
   if s.attempt_id is not null then
    select * into a from public.natori_payment_link_attempts where id=s.attempt_id for update;
    t:=clock_timestamp();
    if a.mail_until>t or a.lease_until>t then return jsonb_build_object('result','busy'); end if;
    if a.state='inactive' then update public.natori_payment_link_stops set status='completed',updated_at=t where id=s.id; return jsonb_build_object('result','completed'); end if;
    if s.reason='deadline' and a.deadline_revision is distinct from s.deadline_revision then return jsonb_build_object('result','needs_review'); end if;
    update public.natori_payment_link_attempts set state='deactivating' where id=a.id;
   end if;
   update public.natori_payment_link_stops set status='processing',claim_token=tok,claim_generation=claim_generation+1,lease_until=t+interval '60 seconds',updated_at=t
    where id=s.id returning * into s;
   return jsonb_build_object('result','claimed','job',to_jsonb(s),'attempt',case when s.attempt_id is null then null else to_jsonb(a) end,
    'legacyLinkId',p.payment_link_id,'legacyUrl',p.payment_link_url,'quoteId',p.payment_quote_id,'legacyAmount',p.quoted_amount);
  end if;
  select * into s from public.natori_payment_link_stops where id=(p_input->>'jobId')::uuid and project_id=p.id for update;
  t:=clock_timestamp();
  if s.id is null or s.status<>'processing' or s.claim_token is distinct from tok or s.claim_generation is distinct from (p_input->>'generation')::integer or s.lease_until is null or s.lease_until<=t then return jsonb_build_object('result','stale'); end if;
  if p_command='stop_renew' then
   update public.natori_payment_link_stops set lease_until=t+interval '60 seconds',updated_at=t where id=s.id;
   return jsonb_build_object('result','renewed');
  end if;
  if p_input->>'outcome' is distinct from 'inactive' then
   update public.natori_payment_link_stops set status=case when p_input->>'outcome'='review' then 'needs_review' else 'pending' end,lease_until=null,updated_at=t where id=s.id;
   if s.attempt_id is not null then update public.natori_payment_link_attempts set state=case when p_input->>'outcome'='review' then 'needs_review' else 'stop_required' end,review_reason='provider_stop_unconfirmed' where id=s.attempt_id; end if;
   return jsonb_build_object('result','needs_review');
  end if;
  update public.natori_payment_link_stops set status='completed',lease_until=null,updated_at=t where id=s.id;
  update public.natori_payment_link_attempts set state='inactive',lease_until=null,updated_at=t where id=s.attempt_id;
  perform set_config('natori.payment_link_writer','v1',true);
  update public.natori_projects set payment_link_status='void' where id=p.id and payment_link_id=s.link_id and payment_confirmed_at is null;
  return jsonb_build_object('result','completed');
 end if;
 if p_command='mail_gate' then
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p.id;
  select * into a from public.natori_payment_link_attempts where id=(j.snapshot->>'attemptId')::uuid and project_id=p.id for update;
  t:=clock_timestamp();
  tok=(p_input->>'token')::uuid;
  if p_input->>'action'='release' then update public.natori_payment_link_attempts set mail_token=null,mail_until=null where id=a.id and mail_token=tok; return jsonb_build_object('result','released'); end if;
  if p_input->>'action'='review' then update public.natori_payment_link_attempts set state='needs_review',review_reason='provider_mail_link_unverified',mail_token=null,mail_until=null where id=a.id and mail_token=tok; return jsonb_build_object('result','blocked'); end if;
  if a.id is null or a.owner_id is distinct from p.user_id or a.quote_id is distinct from p.active_quote_id or a.amount is distinct from p.quote_accepted_amount
   or (j.snapshot->>'generation')::integer is distinct from a.generation
   or exists(select 1 from public.natori_payment_link_attempts where project_id=p.id and generation>a.generation)
   or exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed')
   or not exists(select 1 from public.natori_quotes where id=a.quote_id and project_id=p.id and user_id=p.user_id and accepted_at is not null and superseded_at is null and amount=a.amount)
   or a.state<>'active' or a.deadline is distinct from (j.snapshot->>'deadline')::timestamptz or a.deadline<=t+interval '45 seconds' or p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null then return jsonb_build_object('result','blocked'); end if;
  if a.lease_until>t or(a.mail_until>t and a.mail_token is distinct from tok) then return jsonb_build_object('result','busy'); end if;
  update public.natori_payment_link_attempts set mail_token=tok,mail_until=t+interval '30 seconds' where id=a.id;
  return jsonb_build_object('result','allowed');
 end if;
 op=(p_input->>'operationId')::uuid; tok=(p_input->>'token')::uuid;
 select * into o from public.natori_payment_link_operations where project_id=p.id and operation_id=op for update;
 if p_command='begin' then
  v_hash=p_input->>'hash'; act=p_input->>'action'; v_live=(p_input->>'livemode')::boolean; v_account=p_input->>'providerAccountId';
  select * into r from public.natori_payment_link_rejections where project_id=p.id and operation_id=op;
  if r.operation_id is not null then
   if r.request_hash is distinct from v_hash then return jsonb_build_object('result','conflict'); end if;
   return jsonb_build_object('result',r.reason,'operationState','rejected','operationId',op); end if;
  if v_hash is null or v_hash!~'^[0-9a-f]{64}$' or act not in ('issue','renotify','extend','reissue','adopt')
   or v_account is null or v_account!~'^acct_[A-Za-z0-9]+$' then return jsonb_build_object('result','invalid_request'); end if;
  if o.operation_id is not null then
   if o.request_hash<>v_hash or o.action<>act then return jsonb_build_object('result','conflict'); end if;
   select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
   t:=clock_timestamp();
   if o.status='completed' then return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',o.notification_id); end if;
  else
   if p.payment_confirmed_at is not null or p.deleted_at is not null or p.status not in ('quoted','awaiting_payment') then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'invalid_state'); end if;
   select * into q from public.natori_quotes where id=p.active_quote_id and project_id=p.id and user_id=p.user_id for update;
   if q.accepted_at is null or q.superseded_at is not null or q.amount<50 or p.quote_accepted_amount is distinct from q.amount then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'quote_not_accepted'); end if;
   if exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed') then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'payment_review'); end if;
   v_deadline=(p_input->>'deadline')::timestamptz;
   if act in ('issue','reissue','extend') and (v_deadline is null or v_deadline<=t or v_deadline>t+interval '366 days') then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'invalid_deadline'); end if;
   if act='adopt' then
    if a.id is not null or p.payment_link_id is null or p.payment_link_url is null or p.payment_link_status not in ('sent','ready','send_failed','void')
     or p.payment_quote_id is distinct from q.id or p.quoted_amount is distinct from q.amount
     or (p.payment_link_status='void' and p_input->>'active'='true') or p_input->>'linkId' is distinct from p.payment_link_id or p_input->>'url' is distinct from p.payment_link_url or p_input->>'reconciled' is distinct from 'true' then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'legacy_review'); end if;
    select max(sent_at) into last_mail from public.natori_order_mail_logs where project_id=p.id and kind='payment' and status='sent' and link_url=p.payment_link_url;
    if last_mail is null then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'legacy_review'); end if;
    v_deadline=last_mail+interval '7 days';
    insert into public.natori_payment_link_attempts(project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,link_id,link_url,deadline)
     values(p.id,p.user_id,q.id,1,q.amount,v_live,v_account,case when (p_input->>'active')::boolean then 'active' else 'inactive' end,p.payment_link_id,p.payment_link_url,v_deadline) returning * into a;
    if a.state='inactive' then
     perform set_config('natori.payment_link_writer','v1',true);
     update public.natori_projects set payment_link_status='void' where id=p.id and payment_link_id=a.link_id and payment_confirmed_at is null;
    end if;
   elsif act in ('issue','reissue') then
    if act='issue' and(a.id is not null or p.payment_link_id is not null) then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'legacy_review'); end if;
    if act='reissue' and (a.id is null or a.state<>'inactive' or p_input->>'confirmed' is distinct from 'true') then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'stop_required'); end if;
    if act='reissue' and a.provider_account_id is distinct from v_account then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'needs_review'); end if;
    insert into public.natori_payment_link_attempts(project_id,owner_id,quote_id,generation,amount,livemode,provider_account_id,state,deadline)
     values(p.id,p.user_id,q.id,coalesce(a.generation,0)+1,q.amount,v_live,v_account,'creating',v_deadline) returning * into a;
   else
    if a.id is null or a.state<>'active' or a.livemode is distinct from v_live or a.provider_account_id is distinct from v_account or a.quote_id is distinct from q.id or a.deadline<=t
     or a.deadline_revision is distinct from (p_input->>'revision')::integer then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'conflict'); end if;
    if a.lease_until>t or a.mail_until>t then return jsonb_build_object('result','busy'); end if;
    if act='extend' and (v_deadline<=a.deadline or p_input->>'confirmed' is distinct from 'true') then return public.natori_payment_link_reject_v1(p.id,op,v_hash,'invalid_deadline'); end if;
   end if;
   insert into public.natori_payment_link_operations(project_id,operation_id,request_hash,action,attempt_id,proposed_deadline,expected_revision,status)
    values(p.id,op,v_hash,act,a.id,v_deadline,a.deadline_revision,case when act='adopt' then 'completed' else 'pending' end) returning * into o;
   if act='adopt' then return jsonb_build_object('result','completed','attempt',to_jsonb(a)); end if;
  end if;
  if p.payment_confirmed_at is not null or p.deleted_at is not null or p.status='closed' then return jsonb_build_object('result','invalid_state'); end if;
  if a.state not in ('creating','active') or a.deadline<=t or a.livemode is distinct from v_live or a.provider_account_id is distinct from v_account then return jsonb_build_object('result','needs_review'); end if;
  if a.lease_until>t then return jsonb_build_object('result','busy'); end if;
  if(a.price_id is null and a.price_started_at<t-interval '23 hours') or(a.link_id is null and a.link_started_at<t-interval '23 hours') then
   update public.natori_payment_link_attempts set state='needs_review',review_reason='idempotency_retention_elapsed' where id=a.id; return jsonb_build_object('result','needs_review'); end if;
  update public.natori_payment_link_attempts set claim_token=tok,claim_generation=claim_generation+1,lease_until=t+interval '60 seconds',updated_at=t where id=a.id returning * into a;
  return jsonb_build_object('result','claimed','attempt',to_jsonb(a),'action',o.action,'proposedDeadline',o.proposed_deadline);
 end if;
 if o.operation_id is null then return jsonb_build_object('result','not_found'); end if;
 select * into a from public.natori_payment_link_attempts where id=o.attempt_id for update;
 t:=clock_timestamp();
 if a.claim_token is distinct from tok or a.claim_generation is distinct from (p_input->>'generation')::integer or a.lease_until is null or a.lease_until<=t then return jsonb_build_object('result','stale'); end if;
 if p_command='reissue_source' then
  if o.action<>'reissue' or o.status<>'pending' then return jsonb_build_object('result','needs_review'); end if;
  select * into a from public.natori_payment_link_attempts where project_id=p.id and generation=a.generation-1 for update;
  if a.id is null or a.state<>'inactive' or a.link_id is null then return jsonb_build_object('result','needs_review'); end if;
  return jsonb_build_object('result','ok','attempt',to_jsonb(a));
 end if;
 if (p_command='finish' or (p_command='stage' and coalesce(p_input->>'stage','') not in ('price','link','review'))) and (p.payment_confirmed_at is not null or p.active_quote_id is distinct from a.quote_id or p.quote_accepted_amount is distinct from a.amount) then return jsonb_build_object('result','needs_review'); end if;
 if p_command='stage' then
  v_stage=p_input->>'stage'; v_value=p_input->'value';
  if v_stage='renew' then null;
  elsif v_stage='price_start' then update public.natori_payment_link_attempts set price_started_at=coalesce(price_started_at,t) where id=a.id;
  elsif v_stage='link_start' then update public.natori_payment_link_attempts set link_started_at=coalesce(link_started_at,t) where id=a.id;
  elsif v_stage='price' then
   if coalesce(v_value->>'id','')!~'^price_[A-Za-z0-9]+$' or(a.price_id is not null and a.price_id<>v_value->>'id') then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set price_id=v_value->>'id' where id=a.id;
  elsif v_stage='link' then
   if coalesce(v_value->>'id','')!~'^plink_[A-Za-z0-9]+$' or coalesce(v_value->>'url','')!~'^https://buy[.]stripe[.]com/'
    or(a.link_id is not null and(a.link_id<>v_value->>'id' or a.link_url<>v_value->>'url')) then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set link_id=v_value->>'id',link_url=v_value->>'url' where id=a.id;
   if a.deadline<=t or p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null then
    update public.natori_payment_link_attempts set state='stop_required' where id=a.id;
    insert into public.natori_payment_link_stops(project_id,owner_id,attempt_id,link_id,livemode,reason,deadline_revision)
     values(p.id,p.user_id,a.id,v_value->>'id',a.livemode,'terminal_during_creation',a.deadline_revision) on conflict(project_id,link_id) do nothing;
   end if;
  elsif v_stage='review' then update public.natori_payment_link_attempts set state='needs_review',review_reason=left(p_input->>'reason',100),lease_until=null where id=a.id;
  else return jsonb_build_object('result','invalid_request'); end if;
  update public.natori_payment_link_attempts set lease_until=case when state='needs_review' then null else t+interval '60 seconds' end,updated_at=t where id=a.id returning * into a;
  return jsonb_build_object('result','saved','attempt',to_jsonb(a));
 end if;
 if p_command='finish' then
  if o.status='completed' then return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',o.notification_id); end if;
  if p.status='closed' or p.deleted_at is not null or p.payment_confirmed_at is not null or a.state not in ('creating','active') or a.deadline<=t
   or a.link_id is null or a.link_url is null or p_input->>'verified' is distinct from 'true' then return jsonb_build_object('result','invalid_state'); end if;
  if o.action='extend' then
   if a.deadline_revision is distinct from o.expected_revision then return jsonb_build_object('result','conflict'); end if;
   update public.natori_payment_link_attempts set deadline=o.proposed_deadline,deadline_revision=deadline_revision+1 where id=a.id;
  else
   if jsonb_typeof(p_input->'payload') is distinct from 'object' or p_input->'payload'->>'format' is distinct from 'natori-delivery-aes256gcm-v1' then return jsonb_build_object('result','invalid_payload'); end if;
   insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot,payload)
    values('payment-link/'||a.id||'/'||op,p.id,a.quote_id,'payment_link_client',jsonb_build_object('attemptId',a.id,'generation',a.generation,'deadline',a.deadline),p_input->'payload') returning id into n;
  end if;
  update public.natori_payment_link_attempts set state='active',lease_until=null,updated_at=t where id=a.id returning * into a;
  update public.natori_payment_link_operations set status='completed',notification_id=n where project_id=p.id and operation_id=op;
  perform set_config('natori.payment_link_writer','v1',true);
  update public.natori_projects set payment_link_id=a.link_id,payment_link_url=a.link_url,payment_link_status='ready',payment_quote_id=a.quote_id,
   quoted_amount=a.amount,status='awaiting_payment',next_action='支払いの確認待ち' where id=p.id;
  return jsonb_build_object('result','completed','attempt',to_jsonb(a),'notificationId',n);
 end if;
 return jsonb_build_object('result','invalid_command');
end; $$;

create or replace function public.natori_notification_claim_v1(p_id uuid, p_claim_token uuid, p_manual boolean default false)
returns setof public.natori_notification_jobs
language plpgsql security invoker set search_path = '' as $$
declare j public.natori_notification_jobs%rowtype; t timestamptz := clock_timestamp();
begin
  perform 1 from public.natori_projects where id=(select project_id from public.natori_notification_jobs where id=p_id) for update;
  select * into j from public.natori_notification_jobs where id=p_id for update;
  if not found or p_claim_token is null or j.status in ('sent','failed') then return; end if;
  t:=clock_timestamp();
  if (j.purpose='payment_link_client' and public.natori_case_outbound_blocked_v1(j.project_id,null,j.id)) or (j.purpose='payment_link_client' and j.status='unknown') then return; end if;
  if j.lease_expires_at > t or j.retry_after > t then return; end if;
  -- Resend retains keys for 24 hours. A conservative 23-hour boundary includes clock/network margin.
  if j.send_started_at <= t - interval '23 hours' or j.claim_count >= 8 then
    update public.natori_notification_jobs set status='unknown',error_code='review_required',
      claim_token=null,lease_expires_at=null,updated_at=t where id=p_id;
    return;
  end if;
  if not p_manual and j.claim_count >= 3 then return; end if;
  return query update public.natori_notification_jobs set status='sending',claim_token=p_claim_token,
    lease_expires_at=t+interval '2 minutes',claim_count=claim_count+1,updated_at=t
    where id=p_id returning *;
end;
$$;

create or replace function public.natori_notification_start_v1(p_id uuid,p_claim_token uuid,p_payload jsonb)
returns setof public.natori_notification_jobs
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare j public.natori_notification_jobs%rowtype; owner_id uuid; gate jsonb;
begin
  perform 1 from public.natori_projects where id=(select project_id from public.natori_notification_jobs where id=p_id) for update;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return; end if;
  if exists(select 1 from public.natori_notification_jobs j join public.natori_projects p on p.id=j.project_id where j.id=p_id and j.purpose='payment_link_client' and (p.payment_confirmed_at is not null or public.natori_case_outbound_blocked_v1(j.project_id,null,j.id))) then return; end if;
  select * into j from public.natori_notification_jobs where id=p_id;
  if j.purpose='payment_link_client' then
   select user_id into owner_id from public.natori_projects where id=j.project_id;
   if j.payload->>'workspace'='natori-case-payment-v1' then gate:=public.natori_case_payment_command_v1(owner_id,j.project_id,'mail_gate',jsonb_build_object('jobId',p_id,'token',p_claim_token));
   else gate:=public.natori_payment_links_v1(owner_id,j.project_id,'mail_gate',jsonb_build_object('jobId',p_id,'token',p_claim_token)); end if;
   if gate->>'result' is distinct from 'allowed' then return; end if;
  end if;
  return query update public.natori_notification_jobs set payload=coalesce(payload,p_payload),
    send_started_at=coalesce(send_started_at,clock_timestamp()),updated_at=clock_timestamp()
    where id=p_id and status='sending' and claim_token=p_claim_token and lease_expires_at>clock_timestamp()
      and (payload is null or payload=p_payload)
      and (send_started_at is null or send_started_at>clock_timestamp()-interval '23 hours') returning *;
end;
$$;

create or replace function public.natori_notification_finish_v1(p_id uuid,p_claim_token uuid,p_status text,p_provider_id text default null,p_error_code text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.natori_notification_jobs%rowtype;
begin
  perform 1 from public.natori_projects where id=(select project_id from public.natori_notification_jobs where id=p_id) for update;
  if p_status not in ('sent','failed','unknown') or p_status is null then return false; end if;
  if p_status='sent' and (p_provider_id is null or length(p_provider_id)>200) then return false; end if;
  if p_error_code is not null and p_error_code !~ '^[a-z_]{1,60}$' then return false; end if;
  select * into j from public.natori_notification_jobs where id=p_id;
  if j.purpose='delivery_issue_client' then perform 1 from public.natori_projects where id=j.project_id for update; end if;
  update public.natori_notification_jobs set status=p_status,provider_id=p_provider_id,
    sent_at=case when p_status='sent' then clock_timestamp() else null end,error_code=p_error_code,
    claim_token=null,lease_expires_at=null,retry_after=case when p_status='unknown' then clock_timestamp()+interval '1 minute' else null end,
    updated_at=clock_timestamp() where id=p_id and status='sending' and claim_token=p_claim_token and lease_expires_at>clock_timestamp()
      and (p_status<>'sent' or (payload is not null and send_started_at is not null)) returning * into j;
  if not found then return false; end if;
  if j.purpose='delivery_issue_client' and p_status='sent' then
    update public.natori_projects set delivered_mail_at=coalesce(delivered_mail_at,j.sent_at) where id=j.project_id;
  end if;
  return true;
end $$;

create or replace function public.natori_notification_retry_v1(p_id uuid,p_owner_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare j public.natori_notification_jobs%rowtype; latest public.natori_notification_jobs%rowtype; new_id uuid;
begin
  select n.* into j from public.natori_notification_jobs n join public.natori_projects p on p.id=n.project_id
    where n.id=p_id and p.user_id=p_owner_id;
  if not found then return null; end if;
  perform 1 from public.natori_projects where id=j.project_id and user_id=p_owner_id for update;
  if j.purpose='payment_link_client' and public.natori_case_outbound_blocked_v1(j.project_id,null,j.id) then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(j.notification_key,0));
  select * into latest from public.natori_notification_jobs where notification_key=j.notification_key order by attempt_no desc limit 1 for update;
  if latest.purpose='payment_link_client' and latest.status='unknown' then return null; end if;
  if latest.status='sent' then return null; end if;
  if latest.status<>'failed' then return latest.id; end if;
  if latest.attempt_no>=5 then return null; end if;
  insert into public.natori_notification_jobs(notification_key,attempt_no,project_id,quote_id,purpose,snapshot,payload)
    values(latest.notification_key,latest.attempt_no+1,latest.project_id,latest.quote_id,latest.purpose,latest.snapshot,latest.payload)
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.natori_case_payment_snapshot_v1(p_owner_id uuid,p_project_id uuid,p_operation_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('project',jsonb_build_object('id',p.id,'owner',p.user_id,'title',p.title,'clientName',p.client_name,'email',p.client_email,
  'status',p.status,'acceptedAmount',p.quote_accepted_amount,'acceptedAt',p.quote_accepted_at,'paidAt',p.payment_confirmed_at,'deletedAt',p.deleted_at,'legacyLink',p.payment_link_id),
  'quote',(select jsonb_build_object('id',q.id,'version',q.version,'amount',q.amount,'acceptedAt',q.accepted_at,'supersededAt',q.superseded_at)
   from public.natori_quotes q where q.id=p.active_quote_id and q.project_id=p.id and q.user_id=p.user_id),
  'link',(select jsonb_build_object('id',a.id,'quoteId',a.quote_id,'generation',a.generation,'revision',a.deadline_revision,'deadline',a.deadline,'state',a.state,'url',a.link_url,'amount',a.amount)
   from public.natori_payment_link_attempts a where a.project_id=p.id and a.owner_id=p.user_id order by a.generation desc limit 1),
  'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at,j.id) from
   (select distinct on (notification_key) id,notification_key,attempt_no,status,sent_at,created_at,send_started_at,lease_expires_at,quote_id,snapshot,payload from public.natori_notification_jobs
    where project_id=p.id and purpose='payment_link_client' order by notification_key,attempt_no desc limit 101) j),'[]'::jsonb),
  'noticeGuards',coalesce((select jsonb_object_agg(g.notification_key,g.workspace_guard) from
   (select original.notification_key,x.workspace_guard from public.natori_payment_link_operations x
    join public.natori_notification_jobs original on original.id=x.notification_id
    where x.project_id=p.id and x.workspace_guard is not null order by x.created_at desc,x.operation_id limit 101) g),'{}'::jsonb),
  'legacyCount',(select count(*) from public.natori_order_mail_logs where project_id=p.id and kind='payment'),
  'review',exists(select 1 from public.natori_stripe_event_inbox where project_id=p.id and status<>'completed'),
  'operation',(select jsonb_build_object('id',operation_id,'status',status,'request',case when public.natori_case_payment_receipt_reason_v1(p_owner_id,p.id,operation_id) is null then workspace_request else null end,'retirementReason',public.natori_case_payment_receipt_reason_v1(p_owner_id,p.id,operation_id),'guard',workspace_guard,'notificationId',notification_id)
    from public.natori_payment_link_operations where project_id=p.id and workspace_guard is not null
    and (case when p_operation_id is not null then operation_id=p_operation_id else reconciliation_id is null end)
    order by (status='pending') desc,created_at desc,operation_id limit 1),
  'pending',exists(select 1 from public.natori_payment_link_operations where project_id=p.id and status='pending' and reconciliation_id is null),
  'rejection',(select reason from public.natori_payment_link_rejections where project_id=p.id and operation_id=p_operation_id))
 from public.natori_projects p where p.id=p_project_id and p.user_id=p_owner_id
$$;


create or replace function public.natori_case_payment_command_v1(p_owner_id uuid,p_project_id uuid,p_command text,p_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb; g jsonb; o public.natori_payment_link_operations%rowtype; r jsonb; j public.natori_notification_jobs%rowtype; n uuid;
begin
 perform 1 from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
 if not found then return jsonb_build_object('result','not_found'); end if;
 v:=public.natori_case_payment_snapshot_v1(p_owner_id,p_project_id,(p_input->>'operationId')::uuid);
 g:=jsonb_build_object('quote',v->'quote','identity',((v->'project')-array['status','paidAt','deletedAt','legacyLink','title','clientName','email'])||jsonb_build_object('metadataHash',
  encode(sha256(convert_to(octet_length(v->'project'->>'title')::text||':'||(v->'project'->>'title')||
   octet_length(v->'project'->>'clientName')::text||':'||(v->'project'->>'clientName')||
   octet_length(coalesce(v->'project'->>'email',''))::text||':'||coalesce(v->'project'->>'email',''),'UTF8')),'hex')),
  'link',v->'link','notices',(select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','status',x->'status') order by x->>'id'),'[]'::jsonb) from jsonb_array_elements(v->'jobs') x),
  'legacyCount',v->'legacyCount');
 if p_command in ('begin','stage','finish') then
  select * into o from public.natori_payment_link_operations where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  if o.operation_id is not null and o.status='pending' and (
    o.workspace_guard->'receiptRetention'->>'state'='retired' or o.workspace_request is null
    or (p_command='begin' and public.natori_case_payment_receipt_reason_v1(p_owner_id,p_project_id,o.operation_id) is not null)
  ) then return jsonb_build_object('result','receipt_retired','operationState','pending','operationId',o.operation_id); end if;
  if o.operation_id is null then
   if p_command<>'begin' then return jsonb_build_object('result','not_found'); end if;
   if p_input->'guard' is distinct from g or jsonb_array_length(v->'jobs')>100 or (v->>'pending')::boolean
    or exists(select 1 from jsonb_array_elements(v->'jobs') x where x->>'status'<>'sent')
    or (v->>'legacyCount')::integer>0 or p_input->>'action' not in ('issue','renotify') then
    return public.natori_payment_link_reject_v1(p_project_id,(p_input->>'operationId')::uuid,p_input->>'hash','confirmation_stale'); end if;
   if jsonb_typeof(p_input->'receipt') is distinct from 'object' then return jsonb_build_object('result','invalid_request'); end if;
  elsif o.workspace_guard is null or o.workspace_guard is distinct from p_input->'guard' then return jsonb_build_object('result','conflict');
  end if;
  -- A successful provider response is a fact, even after money/quote/recipient
  -- changes during the call. Keep the original guard identity and core lease fence;
  -- only save known IDs (and queue terminal stops), never start another effect.
  if p_command='stage' and p_input->>'stage' in ('price','link') and o.operation_id is not null and o.status='pending'
   and o.action='issue' then return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input); end if;
  -- Re-notification must still refer to the exact reviewed link/deadline revision.
  -- An issue operation starts without a link, then records its generated ID normally.
  if o.action='renotify' and p_input->'guard'->'link' is distinct from g->'link' then
   return jsonb_build_object('result','confirmation_stale'); end if;
  -- Link changes are expected during creation; the accepted quote and recipient are not.
  if p_input->'guard'->'quote' is distinct from g->'quote' or p_input->'guard'->'identity' is distinct from g->'identity'
    or (v->'project'->>'paidAt') is not null or (v->'project'->>'deletedAt') is not null
    or v->'project'->>'status' not in ('quoted','awaiting_payment') or (v->>'review')::boolean then
   if o.operation_id is null then return public.natori_payment_link_reject_v1(p_project_id,(p_input->>'operationId')::uuid,p_input->>'hash','confirmation_stale'); end if;
   return jsonb_build_object('result','confirmation_stale'); end if;
  r:=public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
  if p_command='begin' and o.operation_id is null and r->>'result'='claimed' then
   update public.natori_payment_link_operations set workspace_guard=p_input->'guard',workspace_request=p_input->'receipt'
    where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  end if;
  if p_command='finish' and r->>'result'='completed' then
   update public.natori_payment_link_operations set workspace_request=null where project_id=p_project_id and operation_id=(p_input->>'operationId')::uuid;
  end if;
  return r;
 elsif p_command='mail_gate' then
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p_project_id and purpose='payment_link_client';
  -- Retry jobs retain their notification_key and frozen payload, not the original id.
  select x.* into o from public.natori_payment_link_operations x join public.natori_notification_jobs original on original.id=x.notification_id
   where x.project_id=p_project_id and original.notification_key=j.notification_key;
  if p_input->>'action'='release' then return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input); end if;
  if o.workspace_guard is null or o.workspace_guard->'quote' is distinct from g->'quote' or o.workspace_guard->'identity' is distinct from g->'identity'
   or v->'project'->>'status' not in ('quoted','awaiting_payment') or j.quote_id is distinct from (v->'quote'->>'id')::uuid or (v->>'review')::boolean then return jsonb_build_object('result','blocked'); end if;
  return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
 elsif p_command in ('retry','resume') then
  if p_input->'guard' is distinct from g or (v->>'pending')::boolean or (v->>'review')::boolean or jsonb_array_length(v->'jobs')>100
   or v->'project'->>'paidAt' is not null or v->'project'->>'deletedAt' is not null or v->'project'->>'status' not in ('quoted','awaiting_payment')
   then return jsonb_build_object('result','confirmation_stale'); end if;
  select * into j from public.natori_notification_jobs where id=(p_input->>'jobId')::uuid and project_id=p_project_id and purpose='payment_link_client'
   and (case when p_command='retry' then status='failed' else status in ('pending','sending') and send_started_at is null and (lease_expires_at is null or lease_expires_at<=clock_timestamp()) end);
  if j.id is null or exists(select 1 from jsonb_array_elements(v->'jobs') x where x->>'status'<>'sent' and x->>'id'<>j.id::text)
   then return jsonb_build_object('result','confirmation_stale'); end if;
  -- This also verifies current quote/attempt/deadline at the eventual mail gate.
  if not exists(select 1 from public.natori_payment_link_operations x join public.natori_notification_jobs original on original.id=x.notification_id
   where x.project_id=p_project_id and original.notification_key=j.notification_key and x.workspace_guard->'quote'=g->'quote' and x.workspace_guard->'identity'=g->'identity')
   then return jsonb_build_object('result','needs_review'); end if;
  if p_command='resume' then n:=j.id;else select public.natori_notification_retry_v1(j.id,p_owner_id) into n;end if;
  return jsonb_build_object('result',case when n is null then 'needs_review' else 'queued' end,'notificationId',n);
 elsif p_command in ('operation','context','outbound_gate') then
  return public.natori_payment_links_v1(p_owner_id,p_project_id,p_command,p_input);
 end if;
 return jsonb_build_object('result','invalid_command');
end $$;

commit;

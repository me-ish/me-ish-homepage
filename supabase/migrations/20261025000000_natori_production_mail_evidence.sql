-- Forward only: production is an application environment, not Resend livemode.
-- No customer seed/backfill, external call, payload purge, or history repair.
begin;
select pg_catalog.pg_advisory_xact_lock(7261549321761::bigint);
do $preflight$
declare r record;
begin
 if (select md5(prosrc) from pg_proc where oid='natori_case_guard.images()'::regprocedure)<>'5976c98c2bf0435358bfbda70a311be8' or (select md5(prosrc) from pg_proc where oid='natori_case_guard.check_contract(text)'::regprocedure)<>'5dee460563666848471d9912b93048a3' then raise exception 'production_mail_guard_contract_mismatch';end if;
 for r in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(r.root);end loop;
 if (select md5(prosrc) from pg_proc where oid='public.natori_case_reconciliation_identity_v1(uuid,text,uuid)'::regprocedure)<>'2ee660ad4517912714c0af7ad01530ce'
 or (select md5(prosrc) from pg_proc where oid='natori_case_guard.natori_case_reconciliation_v1(uuid,uuid,text,jsonb)'::regprocedure)<>'dae54a153bcf1b8e20dfbc1d4ade60ae'
 then raise exception 'production_mail_prior_contract_mismatch';end if;
end $preflight$;

create table public.natori_case_production_mail_connections(
 id uuid primary key, owner_id uuid not null references auth.users(id),
 environment text not null default 'production' check(environment='production'),
 scope text not null unique check(scope='resend/'||id::text),
 project_ref text not null check(project_ref ~ '^[a-z]{20}$'), origin text not null check(origin ~ '^https://[^/[:space:]]+$'),
 credential_hash text not null check(credential_hash ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false, created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_production_mail_bindings(
 job_id uuid primary key references public.natori_notification_jobs(id),
 connection_id uuid not null references public.natori_case_production_mail_connections(id),
 owner_id uuid not null references auth.users(id), project_id uuid not null references public.natori_projects(id),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'), payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
create table public.natori_case_production_mail_events(
 connection_id uuid not null references public.natori_case_production_mail_connections(id), event_id text not null,
 body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'), job_id uuid not null references public.natori_case_production_mail_bindings(job_id),
 provider_id text not null, event_type text not null check(event_type in ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed')),
 occurred_at timestamptz not null, received_at timestamptz not null default clock_timestamp(), primary key(connection_id,event_id)
);
create index natori_production_mail_events_job on public.natori_case_production_mail_events(job_id,occurred_at,event_id);
create table public.natori_case_production_mail_provider_map(
 connection_id uuid not null references public.natori_case_production_mail_connections(id), provider_id text not null,
 job_id uuid not null unique references public.natori_case_production_mail_bindings(job_id), primary key(connection_id,provider_id)
);
alter table public.natori_case_production_mail_connections enable row level security;
alter table public.natori_case_production_mail_bindings enable row level security;
alter table public.natori_case_production_mail_events enable row level security;
alter table public.natori_case_production_mail_provider_map enable row level security;
revoke all on public.natori_case_production_mail_connections,public.natori_case_production_mail_bindings,public.natori_case_production_mail_events,public.natori_case_production_mail_provider_map from public,anon,authenticated,service_role;
grant select on public.natori_case_production_mail_connections to service_role;
grant select,insert on public.natori_case_production_mail_bindings,public.natori_case_production_mail_events,public.natori_case_production_mail_provider_map to service_role;

create function public.natori_case_production_mail_connection_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'production_mail_connection_immutable';end if;
 return new;
end$$;
create trigger natori_production_mail_connection_immutable before update or delete on public.natori_case_production_mail_connections for each row execute function public.natori_case_production_mail_connection_immutable_v1();
create trigger natori_production_mail_binding_immutable before update or delete on public.natori_case_production_mail_bindings for each row execute function public.natori_case_reconciliation_immutable_v1();
create trigger natori_production_mail_event_immutable before update or delete on public.natori_case_production_mail_events for each row execute function public.natori_case_reconciliation_immutable_v1();
create trigger natori_production_mail_map_immutable before update or delete on public.natori_case_production_mail_provider_map for each row execute function public.natori_case_reconciliation_immutable_v1();

create function public.natori_case_production_mail_context_v1(p_connection uuid,p_owner uuid,p_project uuid,p_ref text,p_origin text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('connection',c.id,'owner',c.owner_id,'scope',c.scope,'environment',c.environment,'ref',c.project_ref,'origin',c.origin,'credentialHash',c.credential_hash,'enabled',c.enabled)
 from public.natori_case_production_mail_connections c join public.natori_projects p on p.user_id=c.owner_id
 where c.id=p_connection and c.owner_id=p_owner and p.id=p_project and c.project_ref=p_ref and c.origin=p_origin
$$;
create function public.natori_case_production_mail_bind_v1(p_connection uuid,p_owner uuid,p_project uuid,p_job uuid,p_claim uuid,p_ref text,p_origin text,p_credential_hash text,p_request_hash text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.natori_case_production_mail_connections%rowtype;j public.natori_notification_jobs%rowtype;b public.natori_case_production_mail_bindings%rowtype;
begin
 if not public.natori_case_system_admit_v1(p_owner,'sender') then return jsonb_build_object('allowed',false);end if;
 select * into c from public.natori_case_production_mail_connections where id=p_connection and owner_id=p_owner and project_ref=p_ref and origin=p_origin;
 if c.id is null or not c.enabled or c.credential_hash is distinct from p_credential_hash or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' or p_payload is null then return jsonb_build_object('allowed',false);end if;
 perform 1 from public.natori_projects where id=p_project and user_id=p_owner for update;
 if not found then return jsonb_build_object('allowed',false);end if;
 select * into j from public.natori_notification_jobs where id=p_job and project_id=p_project for update;
 if j.id is null or p_claim is null or j.claim_token is distinct from p_claim or j.status<>'sending' or j.lease_expires_at is null or j.lease_expires_at<=clock_timestamp()
  or (j.payload is not null and j.payload is distinct from p_payload) then return jsonb_build_object('allowed',false);end if;
 select * into b from public.natori_case_production_mail_bindings where job_id=j.id;
 if b.job_id is null then
  if j.send_started_at is not null or j.provider_scope is not null or j.provider_livemode is not null
   or exists(select 1 from public.natori_case_mail_bindings where job_id=j.id)
   or not public.natori_case_system_admit_v1(p_owner,'command') then return jsonb_build_object('allowed',false);end if;
  update public.natori_notification_jobs set payload=coalesce(payload,p_payload),provider_scope=c.scope where id=j.id;
  insert into public.natori_case_production_mail_bindings(job_id,connection_id,owner_id,project_id,request_hash,payload_hash)
   values(j.id,c.id,p_owner,p_project,p_request_hash,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'));
 else
  if b.connection_id<>c.id or b.owner_id<>p_owner or b.project_id<>p_project or b.request_hash<>p_request_hash
   or b.payload_hash<>encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') or j.provider_scope is distinct from c.scope or j.provider_livemode is not null
   then return jsonb_build_object('allowed',false);end if;
 end if;
 return jsonb_build_object('allowed',true,'scope',c.scope,'requestHash',p_request_hash,'connection',c.id);
end$$;
create function public.natori_case_production_mail_send_v1(p_connection uuid,p_owner uuid,p_project uuid,p_job uuid,p_claim uuid,p_credential_hash text,p_request_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$begin
 if not public.natori_case_system_admit_v1(p_owner,'sender') then return false;end if;
 return exists(select 1 from public.natori_case_production_mail_bindings b
 join public.natori_case_production_mail_connections c on c.id=b.connection_id and c.owner_id=b.owner_id
 join public.natori_projects p on p.id=b.project_id and p.user_id=b.owner_id
 join public.natori_notification_jobs j on j.id=b.job_id and j.project_id=p.id
 where c.id=p_connection and c.enabled and c.credential_hash=p_credential_hash and b.owner_id=p_owner and b.project_id=p_project and b.job_id=p_job and b.request_hash=p_request_hash
 and p_claim is not null and j.claim_token=p_claim and j.status='sending' and j.lease_expires_at>clock_timestamp() and j.send_started_at is not null and j.send_started_at>clock_timestamp()-interval '23 hours'
 and j.provider_scope=c.scope and j.provider_livemode is null and b.payload_hash=encode(sha256(convert_to(j.payload::text,'UTF8')),'hex')
 and not exists(select 1 from public.natori_notification_jobs newer where newer.notification_key=j.notification_key and newer.attempt_no>j.attempt_no));
end$$;
create function public.natori_case_production_mail_event_v1(p_connection uuid,p_event text,p_body_hash text,p_job uuid,p_request_hash text,p_provider text,p_type text,p_occurred timestamptz,p_ref text,p_origin text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b public.natori_case_production_mail_bindings%rowtype;c public.natori_case_production_mail_connections%rowtype;j public.natori_notification_jobs%rowtype;prior public.natori_case_production_mail_events%rowtype;
begin
 -- Late signed facts remain recordable with connection/entry/senders disabled.
 select * into b from public.natori_case_production_mail_bindings where job_id=p_job and connection_id=p_connection;
 select * into c from public.natori_case_production_mail_connections where id=p_connection;
 if b.job_id is null or c.id is null or c.owner_id<>b.owner_id or c.project_ref is distinct from p_ref or c.origin is distinct from p_origin or b.request_hash is distinct from p_request_hash
 or p_provider is null or p_provider !~ '^[A-Za-z0-9_-]{1,200}$' or p_event is null or p_event !~ '^[A-Za-z0-9_-]{1,200}$'
 or p_body_hash is null or p_body_hash !~ '^[a-f0-9]{64}$' or p_type is null or p_type not in ('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed')
 or p_occurred is null or p_occurred>clock_timestamp()+interval '5 minutes' then return jsonb_build_object('result','unmatched');end if;
 select * into j from public.natori_notification_jobs where id=b.job_id and project_id=b.project_id for update;
 if j.id is null or j.send_started_at is null or p_occurred<j.created_at or j.provider_scope is distinct from c.scope or j.provider_livemode is not null
 or not exists(select 1 from public.natori_projects where id=b.project_id and user_id=b.owner_id)
 or (j.provider_id is not null and j.provider_id<>p_provider) then return jsonb_build_object('result','conflict');end if;
 select * into prior from public.natori_case_production_mail_events where connection_id=c.id and event_id=p_event;
 if found then return jsonb_build_object('result',case when prior.body_hash=p_body_hash and prior.job_id=j.id and prior.provider_id=p_provider then 'duplicate' else 'conflict' end);end if;
 insert into public.natori_case_production_mail_provider_map(connection_id,provider_id,job_id) values(c.id,p_provider,j.id) on conflict do nothing;
 if not exists(select 1 from public.natori_case_production_mail_provider_map where connection_id=c.id and provider_id=p_provider and job_id=j.id)
 or exists(select 1 from public.natori_case_production_mail_provider_map where job_id=j.id and provider_id<>p_provider) then return jsonb_build_object('result','conflict');end if;
 insert into public.natori_case_production_mail_events(connection_id,event_id,body_hash,job_id,provider_id,event_type,occurred_at) values(c.id,p_event,p_body_hash,j.id,p_provider,p_type,p_occurred);
 return jsonb_build_object('result','recorded');
end$$;
create function public.natori_case_production_mail_evidence_v1(p_owner uuid,p_project uuid,p_job uuid,p_connection uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('reference',e.provider_id,'occurredAt',e.occurred_at,'requestHash',b.request_hash,'payloadHash',b.payload_hash,'scope',c.scope,'environment',c.environment,'connection',c.id,'owner',c.owner_id,'ref',c.project_ref,'origin',c.origin)
 from public.natori_case_production_mail_bindings b join public.natori_case_production_mail_connections c on c.id=b.connection_id and c.owner_id=b.owner_id
 join public.natori_projects p on p.id=b.project_id and p.user_id=b.owner_id
 join lateral(select * from public.natori_case_production_mail_events ev where ev.job_id=b.job_id and ev.connection_id=c.id and ev.event_type='email.sent' order by ev.occurred_at,ev.event_id limit 1)e on true
 where b.owner_id=p_owner and b.project_id=p_project and b.job_id=p_job and c.id=p_connection
$$;

-- Canonical identity retains NULL provider mode for production mail.
create or replace function public.natori_case_reconciliation_identity_v1(p_project uuid,p_kind text,p_target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when p_kind='mail' then (
  select jsonb_build_object('owner',p.user_id,'project',p.id,'target',j.id,'quote',j.quote_id,'purpose',j.purpose,
   'account',j.provider_scope,'livemode',j.provider_livemode,'reference',j.provider_id,'key','natori-notice/'||j.id,
   'payloadHash',coalesce(ab.payload_hash,pb.payload_hash,encode(sha256(convert_to(j.payload::text,'UTF8')),'hex')),'amount',q.amount,'currency','jpy')
  ||case when ab.job_id is not null then jsonb_build_object('mailEnvironment','acceptance','mailRun',ab.run_id,'requestHash',ab.request_hash)
    when pb.job_id is not null and c.scope=j.provider_scope and j.provider_livemode is null then jsonb_build_object('mailEnvironment','production','mailConnection',c.id,'requestHash',pb.request_hash) else '{}'::jsonb end
  from public.natori_notification_jobs j left join public.natori_case_mail_bindings ab on ab.job_id=j.id and ab.project_id=p.id and ab.owner_id=p.user_id
  left join public.natori_case_production_mail_bindings pb on pb.job_id=j.id and pb.project_id=p.id and pb.owner_id=p.user_id
  left join public.natori_case_production_mail_connections c on c.id=pb.connection_id and c.owner_id=p.user_id
  left join public.natori_quotes q on q.id=j.quote_id and q.project_id=p.id
  where j.id=p_target and j.project_id=p.id and not(ab.job_id is not null and pb.job_id is not null))
 else (select jsonb_build_object('owner',p.user_id,'project',p.id,'target',o.operation_id,'attempt',a.id,'generation',a.generation,
   'quote',a.quote_id,'account',a.provider_account_id,'livemode',a.livemode,'amount',a.amount,'currency','jpy','purpose','natori_commission','scope','platform','requestHash',o.request_hash,'price',a.price_id,'link',a.link_id,
   'key','natori-plink/'||a.id||case when p_kind='price' then '/price' else '/link' end)
  from public.natori_payment_link_operations o join public.natori_payment_link_attempts a on a.id=o.attempt_id and a.project_id=p.id and a.owner_id=p.user_id where o.project_id=p.id and o.operation_id=p_target)
 end from public.natori_projects p where p.id=p_project
$$;

-- Change only the verified private R1 body; preserve public wrapper/OID/ACL and
-- private SECURITY/owner/search_path. These strings are frozen source patches.
do $patch$
declare p record;body text;old text;replacement text;
begin
 select *,pg_get_functiondef(oid) definition into p from pg_proc where oid='natori_case_guard.natori_case_reconciliation_v1(uuid,uuid,text,jsonb)'::regprocedure;
 body:=p.prosrc;
 old:=$old0$ident->>'mailEnvironment'='acceptance'$old0$;replacement:=$new0$ident->>'mailEnvironment' in ('acceptance','production')$new0$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>4 then raise exception 'production_mail_patch_count_0';end if;
 body:=replace(body,old,replacement);
 old:=$old1$if f->>'source'='provider_webhook' and not exists(select 1 from public.natori_case_mail_events ev join public.natori_case_mail_bindings mb on mb.job_id=ev.job_id where ev.job_id=x.target_id and mb.owner_id=p.user_id and mb.project_id=p.id and ev.scope=ident->>'account' and ev.provider_id=f->>'reference' and ev.event_type='email.sent' and ev.occurred_at=(f->>'occurredAt')::timestamptz) then return jsonb_build_object('result','needs_review'); end if;$old1$;replacement:=$new1$if f->>'source'='provider_webhook' and not (
   (ident->>'mailEnvironment'='acceptance' and exists(select 1 from public.natori_case_mail_events ev join public.natori_case_mail_bindings mb on mb.job_id=ev.job_id where ev.job_id=x.target_id and mb.owner_id=p.user_id and mb.project_id=p.id and ev.scope=ident->>'account' and ev.provider_id=f->>'reference' and ev.event_type='email.sent' and ev.occurred_at=(f->>'occurredAt')::timestamptz))
   or (ident->>'mailEnvironment'='production' and exists(select 1 from public.natori_case_production_mail_events ev
    join public.natori_case_production_mail_bindings mb on mb.job_id=ev.job_id and mb.connection_id=ev.connection_id
    join public.natori_case_production_mail_connections mc on mc.id=mb.connection_id and mc.owner_id=mb.owner_id
    where ev.job_id=x.target_id and mb.owner_id=p.user_id and mb.project_id=p.id and mc.scope=ident->>'account'
    and mc.id=(ident->>'mailConnection')::uuid and mb.request_hash=ident->>'requestHash' and mb.payload_hash=ident->>'payloadHash'
    and ev.provider_id=f->>'reference' and ev.event_type='email.sent' and ev.occurred_at=(f->>'occurredAt')::timestamptz))
  ) then return jsonb_build_object('result','needs_review');end if;$new1$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'production_mail_patch_count_1';end if;
 body:=replace(body,old,replacement);
 old:=$old2$select e.job_id,e.event_type,e.occurred_at,e.received_at from public.natori_case_mail_events e join public.natori_case_mail_bindings b on b.job_id=e.job_id where b.project_id=p.id and b.owner_id=p.user_id order by e.received_at desc,e.event_id limit 101$old2$;replacement:=$new2$select ev.job_id,ev.event_type,ev.occurred_at,ev.received_at from (
      select e.job_id,e.event_type,e.occurred_at,e.received_at,e.event_id from public.natori_case_mail_events e join public.natori_case_mail_bindings b on b.job_id=e.job_id where b.project_id=p.id and b.owner_id=p.user_id
      union all select e.job_id,e.event_type,e.occurred_at,e.received_at,e.event_id from public.natori_case_production_mail_events e join public.natori_case_production_mail_bindings b on b.job_id=e.job_id and b.connection_id=e.connection_id where b.project_id=p.id and b.owner_id=p.user_id
     )ev order by ev.received_at desc,ev.event_id limit 101$new2$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'production_mail_patch_count_2';end if;
 body:=replace(body,old,replacement);
 old:=$mailguard$if x.kind='mail' then$mailguard$;
 if (length(body)-length(replace(body,old,'')))/length(old)<>1 then raise exception 'production_mail_environment_patch_count';end if;
 body:=replace(body,old,$newmailguard$if x.kind='mail' then
  if not coalesce(ident->>'mailEnvironment' in ('acceptance','production'),false) or ident->>'livemode' is not null
   or f->>'source' is distinct from 'provider_webhook' then return jsonb_build_object('result','needs_review');end if;$newmailguard$);
 execute replace(p.definition,p.prosrc,body);
end $patch$;

-- Register one immutable fact root, using the established L7 envelope pattern.
-- It records events/map only; it cannot settle business records or start sends.
do $envelope$
declare p record;args text;definition text;wrapper text;
begin
 select *,pg_get_functiondef(oid) definition,pg_get_function_arguments(oid) args into p from pg_proc where oid='public.natori_case_production_mail_event_v1(uuid,text,text,uuid,text,text,text,timestamptz,text,text)'::regprocedure;
 definition:=replace(p.definition,'FUNCTION public.natori_case_production_mail_event_v1(', 'FUNCTION natori_case_guard.natori_case_production_mail_event_v1(');execute definition;
 revoke all on function natori_case_guard.natori_case_production_mail_event_v1(uuid,text,text,uuid,text,text,text,timestamptz,text,text) from public,anon,authenticated,service_role;
 args:='p_connection,p_event,p_body_hash,p_job,p_request_hash,p_provider,p_type,p_occurred,p_ref,p_origin';
 wrapper:=$body$declare o uuid;pr uuid;frame bigint;result jsonb;begin
  perform natori_case_guard.shared_lock();perform natori_case_guard.check_contract('natori_case_production_mail_event_v1');
  select b.owner_id,b.project_id into o,pr from public.natori_case_production_mail_bindings b where b.job_id=p_job and b.connection_id=p_connection;
  insert into natori_case_guard.frames(pid,tx,root,owner_id,project_id,fact) values(pg_backend_pid(),txid_current(),'natori_case_production_mail_event_v1',o,pr,true) returning depth into frame;
  begin result:=natori_case_guard.natori_case_production_mail_event_v1(p_connection,p_event,p_body_hash,p_job,p_request_hash,p_provider,p_type,p_occurred,p_ref,p_origin);
  exception when others then delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;raise;end;
  delete from natori_case_guard.frames where pid=pg_backend_pid() and tx=txid_current() and depth=frame;return result;end$body$;
 execute format('create function public.natori_system_fact_natori_case_production_mail_event_v1(%s) returns jsonb language plpgsql volatile security definer set search_path=%L as %L',p.args,'',wrapper);
 execute replace(p.definition,p.prosrc,'begin return public.natori_system_fact_natori_case_production_mail_event_v1('||args||');end');
 insert into natori_case_guard.effects values('natori_case_production_mail_event_v1','public.natori_case_production_mail_events'),('natori_case_production_mail_event_v1','public.natori_case_production_mail_provider_map');
 insert into natori_case_guard.permissions values('natori_case_production_mail_event_v1','schema','public','USAGE'),('natori_case_production_mail_event_v1','function',p.oid::text,'EXECUTE');
 insert into natori_case_guard.permissions select 'natori_case_production_mail_event_v1','table','public.'||rel,'SELECT' from unnest(array['natori_case_production_mail_connections','natori_case_production_mail_bindings','natori_case_production_mail_events','natori_case_production_mail_provider_map','natori_notification_jobs','natori_projects'])rel;
 insert into natori_case_guard.permissions values('natori_case_production_mail_event_v1','table','public.natori_case_production_mail_events','INSERT'),('natori_case_production_mail_event_v1','table','public.natori_case_production_mail_provider_map','INSERT');
 insert into natori_case_guard.permissions select 'natori_case_reconciliation_v1','table','public.'||rel,'SELECT' from unnest(array['natori_case_production_mail_connections','natori_case_production_mail_bindings','natori_case_production_mail_events'])rel;
end $envelope$;

-- New private fact bodies are now part of the deterministic frozen image, too.
do $images$
declare p record;body text;
begin
 select *,pg_get_functiondef(oid) definition into p from pg_proc where oid='natori_case_guard.images()'::regprocedure;
 body:=p.prosrc||$extra$
 union all select 'private-function',p.oid::regprocedure::text,
  md5(p.prosrc||p.proowner::text||p.prosecdef::text||coalesce(p.proconfig::text,'')||coalesce(p.proacl::text,''))
 from pg_proc p where p.pronamespace='natori_case_guard'::regnamespace and p.proname in ('natori_case_reconciliation_v1','natori_case_production_mail_event_v1')
 $extra$;
 execute replace(p.definition,p.prosrc,body);
end $images$;

do $finalize$
declare obj text;f record;
begin
 for obj in select unnest(array['natori_case_production_mail_connections','natori_case_production_mail_bindings','natori_case_production_mail_events','natori_case_production_mail_provider_map']) loop
  execute format('create trigger natori_000_system_lock before insert or update or delete or truncate on public.%I for each statement execute function natori_case_guard.statement_guard()',obj);
  -- Connection configuration is admin-only metadata. Its sole mutable enabled
  -- field remains controllable during a hold; send RPCs still require admission.
  if obj<>'natori_case_production_mail_connections' then execute format('create trigger zzzz_natori_system_row before insert or update or delete on public.%I for each row execute function natori_case_guard.row_guard()',obj);end if;
 end loop;
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'natori_case_production_mail_%' or proname='natori_system_fact_natori_case_production_mail_event_v1') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
 -- The trigger helper is not an RPC, even for service_role.
 revoke all on function public.natori_case_production_mail_connection_immutable_v1() from public,anon,authenticated,service_role;
 insert into natori_case_guard.dependencies select * from natori_case_guard.images() on conflict(kind,identity) do update set image=excluded.image;
 for obj in select distinct root from natori_case_guard.permissions loop perform natori_case_guard.check_contract(obj);end loop;
end $finalize$;
commit;

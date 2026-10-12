-- WF01: first rough OK, business event and staff outbox entry commit together.
-- Existing OKs are read as pending acknowledgement; there is no historical enqueue.
begin;

-- Fail closed before changing anything: these guards and the renewal privilege are
-- part of the reviewed predecessor contract, not optional IF NOT EXISTS upgrades.
do $preflight$
declare item record; purpose_definition text; predicate_tokens text; invalid boolean; col record;
begin
  for item in select * from (values
    ('natori_talk_roughs_guard','8ebb4853cd8c0032eb9cf61dddd3d187',19),
    ('natori_talk_roughs_keep_ok','2bd71f2c2333a44ebf91acfa04543948',11)
  ) x(name,body_md5,trigger_type) loop
    if not exists(select 1 from pg_catalog.pg_proc f join pg_catalog.pg_namespace ns on ns.oid=f.pronamespace
      join pg_catalog.pg_trigger t on t.tgfoid=f.oid
      where ns.nspname='public' and f.proname=item.name and f.pronargs=0
        and f.prorettype='pg_catalog.trigger'::regtype and not f.prosecdef
        and f.proconfig=array['search_path=""']::text[] and f.provolatile='v' and f.proparallel='u' and md5(f.prosrc)=item.body_md5
        and t.tgrelid='public.natori_talk_roughs'::regclass and t.tgname=item.name
        and t.tgtype=item.trigger_type and t.tgenabled='O' and not t.tgisinternal) then
      raise exception 'wf01_rough_guard_drift' using errcode='23514';
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_trigger where tgrelid='public.natori_talk_roughs'::regclass and not tgisinternal)<>2
    then raise exception 'wf01_rough_trigger_drift' using errcode='23514'; end if;
  for item in select * from (values
    ('public.natori_talk_roughs'),('public.natori_consultation_messages'),
    ('public.natori_consultation_access'),('public.natori_notification_jobs')
  ) x(name) loop
    if not exists(select 1 from pg_catalog.pg_class where oid=item.name::regclass and relkind='r' and relrowsecurity)
      then raise exception 'wf01_table_rls_drift' using errcode='23514'; end if;
    for col in select attname from pg_catalog.pg_attribute where attrelid=item.name::regclass and attnum>0 and not attisdropped loop
      if pg_catalog.has_column_privilege('anon',item.name,col.attname,'SELECT,INSERT,UPDATE,REFERENCES')
         or pg_catalog.has_column_privilege('authenticated',item.name,col.attname,'SELECT,INSERT,UPDATE,REFERENCES')
        then raise exception 'wf01_browser_column_acl_drift' using errcode='23514'; end if;
    end loop;
    if pg_catalog.has_table_privilege('anon',item.name,'DELETE,TRUNCATE,TRIGGER')
      or pg_catalog.has_table_privilege('authenticated',item.name,'DELETE,TRUNCATE,TRIGGER')
      then raise exception 'wf01_browser_table_acl_drift' using errcode='23514'; end if;
  end loop;
  if not pg_catalog.has_table_privilege('service_role','public.natori_consultation_access','SELECT')
    or not pg_catalog.has_table_privilege('service_role','public.natori_consultation_access','UPDATE')
    or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.natori_consultation_access'::regclass and attname='renewed_at' and atttypid='timestamptz'::regtype and not attisdropped)
    then raise exception 'wf01_consultation_renewal_prerequisite_missing' using errcode='23514'; end if;
  if not exists(select 1 from pg_catalog.pg_proc where oid='public.natori_consultation_overview_v1(uuid,uuid[])'::regprocedure and not prosecdef
    and proconfig=array['search_path=""']::text[] and provolatile='s')
    or pg_catalog.has_function_privilege('anon','public.natori_consultation_overview_v1(uuid,uuid[])','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','public.natori_consultation_overview_v1(uuid,uuid[])','EXECUTE')
    then raise exception 'wf01_overview_contract_drift' using errcode='23514'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.natori_notification_jobs'::regclass
    and tgname='natori_notification_immutable' and tgenabled='O' and tgtype=19
    and tgfoid='public.natori_notification_immutable_v1()'::regprocedure)
    then raise exception 'wf01_notification_guard_drift' using errcode='23514'; end if;
  -- Named PhaseN and Phase1 lifecycle bodies are both safe predecessors. The
  -- production latest Phase1 bodies retain encrypted delivery payload handling.
  for item in select * from (values
    ('public.natori_notification_immutable_v1()','2b8f37ea0b4ca849d86be02c2e82d68d|a83c1b07e264cf2f1d05cd75dbd85bf9'),
    ('public.natori_notification_claim_v1(uuid,uuid,boolean)','0624b9aeab9a0411efc330b4589ed60c'),
    ('public.natori_notification_start_v1(uuid,uuid,jsonb)','76a0ee1017a39887340f87247e912178'),
    ('public.natori_notification_finish_v1(uuid,uuid,text,text,text)','33c4f6b136224d62f632aeeb174560aa|09e6228c0424e9f5a06a22376eba1d6d'),
    ('public.natori_notification_retry_v1(uuid,uuid)','1eaa1b95f4f91c962ef482a04f1bd887'),
    ('public.natori_notification_list_v1(uuid,integer)','20de08ebda9e4a26c2728b380b44de93')
  ) x(signature,body_md5) loop
    if not exists(select 1 from pg_catalog.pg_proc where oid=item.signature::regprocedure
      and not prosecdef and proconfig=array['search_path=""']::text[] and provolatile='v' and proparallel='u' and md5(prosrc)=any(pg_catalog.string_to_array(item.body_md5,'|')))
      or pg_catalog.has_function_privilege('anon',item.signature,'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated',item.signature,'EXECUTE') then
      raise exception 'wf01_notification_lifecycle_drift' using errcode='23514';
    end if;
  end loop;
  select pg_catalog.pg_get_expr(conbin,conrelid) into strict purpose_definition from pg_catalog.pg_constraint
    where conrelid='public.natori_notification_jobs'::regclass and conname='natori_notification_jobs_purpose_check'
      and contype='c' and convalidated and conkey=array[(select attnum from pg_catalog.pg_attribute
        where attrelid='public.natori_notification_jobs'::regclass and attname='purpose')]::smallint[];
  -- Accept finite literal membership predicates joined only by OR. A permissive,
  -- negated or executable/custom predicate is unsafe drift, even if five sample
  -- purposes happen to pass. Unknown finite purposes remain preserved.
  predicate_tokens:=pg_catalog.regexp_replace(purpose_definition,
    $membership$purpose = ANY \(ARRAY\['[a-z][a-z0-9_]{0,60}'::text(, '[a-z][a-z0-9_]{0,60}'::text)*\]\)$membership$,'MEMBER','g');
  predicate_tokens:=pg_catalog.regexp_replace(predicate_tokens,
    $single$purpose = '[a-z][a-z0-9_]{0,60}'::text$single$,'MEMBER','g');
  if pg_catalog.strpos(predicate_tokens,'MEMBER')=0 or
    pg_catalog.replace(pg_catalog.replace(predicate_tokens,'MEMBER',''),'OR','')!~'^[()[:space:]]*$' then
    raise exception 'wf01_notification_purpose_predicate_drift' using errcode='23514';
  end if;
  execute 'select bool_or(('||purpose_definition||') is distinct from true) from unnest(array[''quote_accept_artist'',''delivery_accept_artist'',''delivery_accept_client'',''consultation_staff'',''consultation_client'']) purpose' into invalid;
  if invalid is distinct from false then raise exception 'wf01_notification_purpose_prerequisite_drift' using errcode='23514'; end if;
  -- Retain the installed predicate, including every purpose added by other phases.
  execute 'alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check';
  execute 'alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check check (('||purpose_definition||') or purpose=''rough_ok_artist'')';
end
$preflight$;

create index natori_talk_roughs_ok_order on public.natori_talk_roughs(project_id,client_ok_at desc,id desc)
  where client_ok_at is not null;

create table public.natori_rough_ok_events (
  rough_id uuid primary key references public.natori_talk_roughs(id) on delete cascade,
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  message_id uuid not null references public.natori_consultation_messages(id) on delete cascade,
  client_ok_at timestamptz not null,
  notification_id uuid not null unique references public.natori_notification_jobs(id),
  created_at timestamptz not null default clock_timestamp()
);
create index natori_rough_ok_events_project on public.natori_rough_ok_events(project_id,client_ok_at desc,rough_id);
create table public.natori_rough_ok_acknowledgements (
  rough_id uuid primary key references public.natori_talk_roughs(id) on delete cascade,
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  client_ok_at timestamptz not null,
  acknowledged_at timestamptz not null default clock_timestamp()
);
create index natori_rough_ok_acknowledgements_project on public.natori_rough_ok_acknowledgements(project_id,rough_id);
alter table public.natori_rough_ok_events enable row level security;
alter table public.natori_rough_ok_acknowledgements enable row level security;
revoke all on public.natori_rough_ok_events,public.natori_rough_ok_acknowledgements from public,anon,authenticated,service_role;
grant select,insert on public.natori_rough_ok_events,public.natori_rough_ok_acknowledgements to service_role;

-- Preserve the predecessor's intentional project/message cascade deletion behavior.
-- Direct deletion and every update of a business event or acknowledgement fail.
create function public.natori_rough_ok_fact_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' and pg_catalog.pg_trigger_depth()>1 then return old; end if;
  raise exception 'rough_ok_fact_immutable' using errcode='23514';
end;
$$;
create trigger natori_rough_ok_event_immutable before update or delete on public.natori_rough_ok_events
  for each row execute function public.natori_rough_ok_fact_guard_v1();
create trigger natori_rough_ok_ack_immutable before update or delete on public.natori_rough_ok_acknowledgements
  for each row execute function public.natori_rough_ok_fact_guard_v1();

-- Mark/unmark still work. Creating an already-OK rough would evade the first-OK
-- transition and is rejected, including from a trusted service caller.
create function public.natori_rough_ok_insert_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.client_ok_at is not null then raise exception 'rough_ok_insert_forbidden' using errcode='23514'; end if;
  if not exists(select 1 from public.natori_consultation_messages m
    where m.id=new.message_id and m.project_id=new.project_id and m.sender='staff') then
    raise exception 'rough_message_binding_invalid' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger natori_rough_ok_insert_guard before insert on public.natori_talk_roughs
  for each row execute function public.natori_rough_ok_insert_guard_v1();

create function public.natori_rough_ok_ack_binding_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.natori_talk_roughs r join public.natori_projects p on p.id=r.project_id
    where r.id=new.rough_id and r.project_id=new.project_id and p.user_id=new.owner_id
      and r.client_ok_at=new.client_ok_at and r.client_ok_at is not null) then
    raise exception 'rough_ok_ack_binding_invalid' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger natori_rough_ok_ack_binding before insert on public.natori_rough_ok_acknowledgements
  for each row execute function public.natori_rough_ok_ack_binding_v1();

-- This trigger also covers the previous service UPDATE path. There is no direct
-- service first-OK write which commits without both the event and logical job.
-- The service role remains trusted; capability authentication belongs to the RPC.
create function public.natori_rough_ok_enqueue_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; nid uuid;
begin
  select * into strict p from public.natori_projects where id=new.project_id for update;
  if p.deleted_at is not null or p.status='closed' then raise exception 'rough_project_unavailable' using errcode='23514'; end if;
  perform 1 from public.natori_consultation_messages where id=new.message_id and project_id=p.id and sender='staff' for share;
  if not found then raise exception 'rough_message_binding_invalid' using errcode='23514'; end if;
  insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot)
    values('rough-ok/'||new.id,p.id,'rough_ok_artist',jsonb_build_object(
      'roughId',new.id,'messageId',new.message_id,'projectId',p.id,'title',p.title,
      'clientName',p.client_name,'clientOkAt',new.client_ok_at,'beforeQuote',new.before_quote)) returning id into nid;
  insert into public.natori_rough_ok_events(rough_id,project_id,message_id,client_ok_at,notification_id)
    values(new.id,p.id,new.message_id,new.client_ok_at,nid);
  return new;
end;
$$;
create trigger natori_rough_ok_enqueue after update of client_ok_at on public.natori_talk_roughs
  for each row when (old.client_ok_at is null and new.client_ok_at is not null)
  execute function public.natori_rough_ok_enqueue_v1();

create function public.natori_record_rough_ok_v1(p_project_id uuid,p_rough_id uuid,p_token_hash text)
returns table(result text,rough_id uuid,project_id uuid,client_ok_at timestamptz,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_talk_roughs%rowtype;
  a public.natori_consultation_access%rowtype; t timestamptz; outcome text; ids uuid[];
begin
  if p_project_id is null or p_rough_id is null or p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then
    return query select 'not_found'::text,null::uuid,null::uuid,null::timestamptz,array[]::uuid[]; return;
  end if;
  select * into p from public.natori_projects where id=p_project_id for update;
  if not found or p.deleted_at is not null then
    return query select 'not_found'::text,null::uuid,null::uuid,null::timestamptz,array[]::uuid[]; return;
  end if;
  select * into r from public.natori_talk_roughs where id=p_rough_id and natori_talk_roughs.project_id=p.id for update;
  if not found then return query select 'not_found'::text,null::uuid,null::uuid,null::timestamptz,array[]::uuid[]; return; end if;
  perform 1 from public.natori_consultation_messages where id=r.message_id and natori_consultation_messages.project_id=p.id and sender='staff' for share;
  if not found then return query select 'not_found'::text,null::uuid,null::uuid,null::timestamptz,array[]::uuid[]; return; end if;
  select * into a from public.natori_consultation_access where natori_consultation_access.project_id=p.id and token_hash=p_token_hash for share;
  t:=clock_timestamp();
  if not found or a.expires_at<=t then
    return query select 'not_found'::text,null::uuid,null::uuid,null::timestamptz,array[]::uuid[]; return;
  end if;
  if p.status='closed' then return query select 'closed'::text,r.id,p.id,r.client_ok_at,array[]::uuid[]; return; end if;
  if r.client_ok_at is null then
    update public.natori_talk_roughs set client_ok_at=t where id=r.id returning * into r;
    outcome:='ok';
  else outcome:='already_ok'; end if;
  select coalesce(array_agg(j.id order by j.attempt_no),array[]::uuid[]) into ids from public.natori_notification_jobs j
    where j.project_id=p.id and j.purpose='rough_ok_artist' and j.notification_key='rough-ok/'||r.id and j.status in('pending','sending','unknown');
  -- Refresh AFTER the trigger's FK/unique/table/queue waits. Expiry during that
  -- work raises instead of returning success and rolls back OK/event/job together.
  t:=clock_timestamp();
  if a.expires_at<=t or not exists(select 1 from public.natori_consultation_access
    where id=a.id and natori_consultation_access.project_id=p.id and token_hash=p_token_hash and expires_at>t) then
    raise exception 'rough_ok_capability_expired' using errcode='40001';
  end if;
  return query select outcome,r.id,p.id,r.client_ok_at,ids;
end;
$$;

create function public.natori_acknowledge_rough_ok_v1(p_owner_id uuid,p_project_id uuid,p_rough_id uuid)
returns table(result text,acknowledged_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_talk_roughs%rowtype; ack timestamptz;
begin
  select * into p from public.natori_projects where id=p_project_id for update;
  if not found or p_owner_id is null or p.user_id is distinct from p_owner_id or p.deleted_at is not null then
    return query select 'not_found'::text,null::timestamptz; return;
  end if;
  select * into r from public.natori_talk_roughs where id=p_rough_id and project_id=p.id for update;
  if not found then return query select 'not_found'::text,null::timestamptz; return; end if;
  if r.client_ok_at is null then return query select 'not_ok'::text,null::timestamptz; return; end if;
  select a.acknowledged_at into ack from public.natori_rough_ok_acknowledgements a where a.rough_id=r.id and a.project_id=p.id;
  if found then return query select 'already_acknowledged'::text,ack; return; end if;
  insert into public.natori_rough_ok_acknowledgements(rough_id,project_id,owner_id,client_ok_at)
    values(r.id,p.id,p_owner_id,r.client_ok_at) returning natori_rough_ok_acknowledgements.acknowledged_at into ack;
  return query select 'acknowledged'::text,ack;
end;
$$;

create function public.natori_rough_ok_list_v1(p_owner_id uuid,p_project_id uuid)
returns table(rough_id uuid,message_id uuid,before_quote boolean,client_ok_at timestamptz,acknowledged_at timestamptz,
  notification_id uuid,notification_status text,notification_attempt_no integer,notification_sent_at timestamptz,
  notification_claim_count integer,notification_lease_expires_at timestamptz,notification_send_started_at timestamptz,notification_retry_after timestamptz)
language sql stable security invoker set search_path='' as $$
  select r.id,r.message_id,r.before_quote,r.client_ok_at,a.acknowledged_at,j.id,j.status,j.attempt_no,j.sent_at,
    j.claim_count,j.lease_expires_at,j.send_started_at,j.retry_after
  from public.natori_projects p join public.natori_talk_roughs r on r.project_id=p.id
  left join public.natori_rough_ok_acknowledgements a on a.rough_id=r.id and a.project_id=p.id
  left join lateral (select n.id,n.status,n.attempt_no,n.sent_at,n.claim_count,n.lease_expires_at,n.send_started_at,n.retry_after from public.natori_notification_jobs n
    where n.project_id=p.id and n.notification_key='rough-ok/'||r.id and n.purpose='rough_ok_artist'
    order by n.attempt_no desc limit 1) j on true
  where p.id=p_project_id and p.user_id=p_owner_id and p.deleted_at is null and r.client_ok_at is not null
  order by r.client_ok_at desc,r.id desc;
$$;

-- A rough-specific owner retry does not depend on generic acceptance UI flags.
-- Derive the job from the immutable event; historical OKs never acquire a job here.
create function public.natori_retry_rough_ok_notification_v1(p_owner_id uuid,p_project_id uuid,p_rough_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; nid uuid; retried uuid; latest public.natori_notification_jobs%rowtype;
begin
  select * into p from public.natori_projects where id=p_project_id for update;
  if not found or p_owner_id is null or p.user_id is distinct from p_owner_id or p.deleted_at is not null then return null; end if;
  perform 1 from public.natori_talk_roughs where id=p_rough_id and project_id=p.id and client_ok_at is not null for update;
  if not found then return null; end if;
  select j.id into nid from public.natori_rough_ok_events e join public.natori_notification_jobs j on j.id=e.notification_id
    where e.rough_id=p_rough_id and e.project_id=p.id and j.project_id=p.id
      and j.purpose='rough_ok_artist' and j.notification_key='rough-ok/'||p_rough_id;
  if not found then return null; end if;
  retried:=public.natori_notification_retry_v1(nid,p_owner_id);
  if retried is null then return null; end if;
  select * into strict latest from public.natori_notification_jobs where id=retried;
  if latest.project_id<>p.id or latest.purpose<>'rough_ok_artist' or latest.notification_key<>'rough-ok/'||p_rough_id then
    raise exception 'rough_ok_notification_binding_invalid' using errcode='23514';
  end if;
  return retried;
end;
$$;

-- Version 1 remains unchanged for existing callers and compatibility fixtures.
create function public.natori_consultation_overview_v2(p_owner_id uuid,p_project_ids uuid[])
returns table(project_id uuid,latest_message_id uuid,latest_sender text,latest_message_at timestamptz,
  notification_failed integer,notification_pending integer,rough_ok_pending integer,latest_rough_ok_id uuid,latest_rough_ok_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select v.*,pending.total::integer,latest.id,latest.client_ok_at
  from public.natori_consultation_overview_v1(p_owner_id,p_project_ids) v
  cross join lateral (select count(*) total from public.natori_talk_roughs r
    where r.project_id=v.project_id and r.client_ok_at is not null and not exists(
      select 1 from public.natori_rough_ok_acknowledgements a where a.rough_id=r.id and a.project_id=r.project_id)) pending
  left join lateral (select r.id,r.client_ok_at from public.natori_talk_roughs r
    where r.project_id=v.project_id and r.client_ok_at is not null and not exists(
      select 1 from public.natori_rough_ok_acknowledgements a where a.rough_id=r.id and a.project_id=r.project_id)
    order by r.client_ok_at desc,r.id desc limit 1) latest on true;
$$;

revoke all on function public.natori_rough_ok_fact_guard_v1(),public.natori_rough_ok_insert_guard_v1(),
  public.natori_rough_ok_ack_binding_v1(),public.natori_rough_ok_enqueue_v1() from public,anon,authenticated,service_role;
revoke all on function public.natori_record_rough_ok_v1(uuid,uuid,text),public.natori_acknowledge_rough_ok_v1(uuid,uuid,uuid),
  public.natori_rough_ok_list_v1(uuid,uuid),public.natori_retry_rough_ok_notification_v1(uuid,uuid,uuid),public.natori_consultation_overview_v2(uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.natori_record_rough_ok_v1(uuid,uuid,text),public.natori_acknowledge_rough_ok_v1(uuid,uuid,uuid),
  public.natori_rough_ok_list_v1(uuid,uuid),public.natori_retry_rough_ok_notification_v1(uuid,uuid,uuid),public.natori_consultation_overview_v2(uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
commit;

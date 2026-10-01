-- Phase 1 expand. Existing business rows, hashes, files and timestamps are preserved.
begin;

alter table public.natori_delivery_files
  add column state text not null default 'legacy_unverified'
    check (state in ('pending','ready','failed','legacy_unverified','deleting')),
  add column content_type text,
  add column storage_version text,
  add column verified_at timestamptz,
  add column deleted_at timestamptz,
  add constraint natori_delivery_ready_evidence check
    (state <> 'ready' or (size_bytes > 0 and content_type is not null and storage_version is not null and verified_at is not null));

create table public.natori_delivery_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.natori_projects(id),
  revision integer not null default 1 check (revision = 1),
  manifest jsonb not null check (jsonb_typeof(manifest)='array' and jsonb_array_length(manifest) between 1 and 10),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  published_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  legacy boolean not null default false
);
create table public.natori_delivery_access (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  release_id uuid not null references public.natori_delivery_releases(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index natori_delivery_access_release on public.natori_delivery_access(release_id);
create table public.natori_delivery_operations (
  project_id uuid not null references public.natori_projects(id),
  operation_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  release_id uuid not null references public.natori_delivery_releases(id),
  notification_id uuid not null references public.natori_notification_jobs(id),
  created_at timestamptz not null default clock_timestamp(),
  primary key(project_id,operation_id)
);
create index natori_delivery_operations_release on public.natori_delivery_operations(release_id);
create index natori_delivery_operations_notification on public.natori_delivery_operations(notification_id);

alter table public.natori_delivery_releases enable row level security;
alter table public.natori_delivery_access enable row level security;
alter table public.natori_delivery_operations enable row level security;
revoke all on public.natori_delivery_releases,public.natori_delivery_access,public.natori_delivery_operations
  from public,anon,authenticated,service_role;
grant select,insert,update on public.natori_delivery_releases to service_role;
grant select,insert on public.natori_delivery_access,public.natori_delivery_operations to service_role;
-- Browser writes already use the authenticated management API. Legacy direct row writes cannot publish.
revoke insert,update,delete on public.natori_delivery_files from public,anon,authenticated;

alter table public.natori_notification_jobs drop constraint natori_notification_jobs_purpose_check;
alter table public.natori_notification_jobs add constraint natori_notification_jobs_purpose_check
  check (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client','delivery_issue_client'));
alter table public.natori_notification_jobs add constraint natori_delivery_notification_encrypted
  check (purpose <> 'delivery_issue_client' or
    (payload is not null and payload->>'format'='natori-delivery-aes256gcm-v1' and payload ? 'ciphertext' and payload ? 'expiresAt'));

-- The sole exception to immutable payload evidence is bounded ciphertext erasure.
-- All envelope identity, other columns, and sent evidence remain unchanged.
create or replace function public.natori_notification_immutable_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.purpose='delivery_issue_client' and old.payload->>'format'='natori-delivery-aes256gcm-v1'
    and (old.payload->>'expiresAt')::timestamptz<=clock_timestamp()
    and new.payload=old.payload-'ciphertext'-'iv'-'tag'||jsonb_build_object('ciphertext','','iv','','tag','','purged',true)
    and to_jsonb(new)-'payload'=to_jsonb(old)-'payload' then return new; end if;
  if (new.notification_key,new.attempt_no,new.project_id,new.quote_id,new.purpose,new.snapshot,new.created_at)
    is distinct from (old.notification_key,old.attempt_no,old.project_id,old.quote_id,old.purpose,old.snapshot,old.created_at)
    or (old.payload is not null and new.payload is distinct from old.payload)
    or (old.send_started_at is not null and new.send_started_at is distinct from old.send_started_at)
    or (old.status='sent' and new is distinct from old) then
    raise exception 'Immutable notification evidence' using errcode='23514';
  end if;
  return new;
end $$;

create function public.natori_delivery_purge_payloads_v1(p_owner_id uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare cnt integer;
begin
  update public.natori_notification_jobs j set payload=j.payload-'ciphertext'-'iv'-'tag'||
    jsonb_build_object('ciphertext','','iv','','tag','','purged',true)
    where j.id in (select n.id from public.natori_notification_jobs n join public.natori_projects p on p.id=n.project_id
      where p.user_id=p_owner_id and n.purpose='delivery_issue_client' and n.payload->>'purged' is distinct from 'true'
      and (n.payload->>'expiresAt')::timestamptz<=clock_timestamp() order by n.created_at limit 100);
  get diagnostics cnt=row_count; return cnt;
end $$;

-- One lock order for reservation, finalization, deletion, publication and acceptance: project first.
create function public.natori_delivery_file_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare pid uuid;
begin
  pid := case when tg_op='DELETE' then old.project_id else new.project_id end;
  perform 1 from public.natori_projects where id=pid for update;
  if tg_op='UPDATE' and (new.id,new.project_id,new.folder,new.storage_path,new.file_name,new.size_bytes)
    is distinct from (old.id,old.project_id,old.folder,old.storage_path,old.file_name,old.size_bytes) then
    raise exception 'Immutable delivery reservation' using errcode='23514';
  end if;
  if tg_op='INSERT' and new.folder='final' and exists
    (select 1 from public.natori_delivery_releases r where r.project_id=pid) then
    raise exception 'Published delivery is immutable' using errcode='23514';
  end if;
  if tg_op<>'INSERT' and exists (select 1 from public.natori_delivery_releases r,
    lateral jsonb_array_elements(r.manifest) f where r.project_id=pid and f->>'id'=old.id::text) then
    raise exception 'Published delivery is immutable' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger natori_delivery_file_guard before insert or update or delete on public.natori_delivery_files
  for each row execute function public.natori_delivery_file_guard_v1();

create function public.natori_delivery_release_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' or (new.id,new.project_id,new.revision,new.manifest,new.snapshot,new.published_at,new.expires_at,new.legacy)
    is distinct from (old.id,old.project_id,old.revision,old.manifest,old.snapshot,old.published_at,old.expires_at,old.legacy)
    or (old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at) then
    raise exception 'Immutable delivery release' using errcode='23514';
  end if;
  return new;
end $$;
create trigger natori_delivery_release_guard before update or delete on public.natori_delivery_releases
  for each row execute function public.natori_delivery_release_guard_v1();

create function public.natori_delivery_project_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r public.natori_delivery_releases%rowtype;
begin
  select * into r from public.natori_delivery_releases where project_id=old.id;
  if not found then return new; end if;
  if (new.delivery_token_hash,new.delivery_token_expires_at) is distinct from
    (old.delivery_token_hash,old.delivery_token_expires_at)
    or (old.delivery_accepted_at is not null and new.delivery_accepted_at is distinct from old.delivery_accepted_at)
    or (old.completed_at is not null and new.completed_at is distinct from old.completed_at)
    or (old.delivery_accepted_at is not null and new.status <> old.status)
    or (new.delivery_accepted_at is not null and new.delivery_accepted_at is distinct from r.accepted_at) then
    raise exception 'Immutable issued delivery evidence' using errcode='23514';
  end if;
  return new;
end $$;
create trigger natori_delivery_project_guard before update on public.natori_projects
  for each row execute function public.natori_delivery_project_guard_v1();

create function public.natori_delivery_reserve_v1(p_owner_id uuid,p_project_id uuid,p_file_id uuid,
  p_folder text,p_path text,p_file_name text,p_size_bytes bigint,p_content_type text)
returns table(result text,file_id uuid,storage_path text)
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; f public.natori_delivery_files%rowtype;
begin
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
  if not found then return query select 'not-found',null::uuid,null::text; return; end if;
  if p.deleted_at is not null or p.status in ('closed','completed') then
    return query select 'invalid-state',null::uuid,null::text; return; end if;
  if p_folder not in ('rough','final') or p_size_bytes not between 1 and 50000000
    or length(p_file_name) not between 1 and 200 or length(p_content_type) not between 1 and 200
    or p_path not like p_project_id::text||'/'||p_folder||'/'||p_file_id::text||'%' then
    return query select 'invalid-input',null::uuid,null::text; return; end if;
  select * into f from public.natori_delivery_files where id=p_file_id;
  if found then
    if (f.project_id,f.folder,f.storage_path,f.file_name,f.size_bytes,f.content_type) is distinct from
      (p_project_id,p_folder,p_path,p_file_name,p_size_bytes,p_content_type) or f.deleted_at is not null then
      return query select 'conflict',null::uuid,null::text;
    else return query select 'reserved',f.id,f.storage_path; end if;
    return;
  end if;
  if p_folder='final' and exists(select 1 from public.natori_delivery_releases where project_id=p.id) then
    return query select 'published',null::uuid,null::text; return; end if;
  if (select count(*) from public.natori_delivery_files where project_id=p.id and folder=p_folder and deleted_at is null)>=10 then
    return query select 'too-many-files',null::uuid,null::text; return; end if;
  insert into public.natori_delivery_files(id,project_id,folder,storage_path,file_name,size_bytes,content_type,state)
    values(p_file_id,p.id,p_folder,p_path,p_file_name,p_size_bytes,p_content_type,'pending');
  return query select 'reserved',p_file_id,p_path;
end $$;

create function public.natori_delivery_finalize_v1(p_owner_id uuid,p_file_id uuid,p_size_bytes bigint,
  p_content_type text,p_storage_version text,p_verified_at timestamptz)
returns text language plpgsql security invoker set search_path='' as $$
declare f public.natori_delivery_files%rowtype; pid uuid;
begin
  select project_id into pid from public.natori_delivery_files where id=p_file_id;
  perform 1 from public.natori_projects where id=pid and user_id=p_owner_id and deleted_at is null
    and status<>'closed' for update;
  if not found then return 'not-found'; end if;
  select * into f from public.natori_delivery_files where id=p_file_id for update;
  if f.deleted_at is not null or f.state='deleting' then return 'invalid-state'; end if;
  if p_verified_at is null or p_verified_at>clock_timestamp()+interval '5 seconds'
    or p_verified_at<clock_timestamp()-interval '60 seconds' or p_size_bytes<>f.size_bytes
    or coalesce(p_storage_version,'')='' or coalesce(p_content_type,'')=''
    or (f.content_type is not null and f.content_type<>p_content_type) then return 'unavailable'; end if;
  if f.state='ready' and (f.storage_version,f.content_type)=(p_storage_version,p_content_type) then return 'ready'; end if;
  if exists(select 1 from public.natori_delivery_releases r,lateral jsonb_array_elements(r.manifest) m
    where r.project_id=pid and m->>'id'=f.id::text) then return 'published'; end if;
  update public.natori_delivery_files set state='ready',content_type=p_content_type,
    storage_version=p_storage_version,verified_at=p_verified_at where id=f.id;
  return 'ready';
end $$;

-- Tombstone BEFORE Storage removal: concurrent publication must exclude this row.
create function public.natori_delivery_delete_v1(p_owner_id uuid,p_file_id uuid,p_finish boolean default false)
returns text language plpgsql security invoker set search_path='' as $$
declare f public.natori_delivery_files%rowtype; pid uuid;
begin
  select project_id into pid from public.natori_delivery_files where id=p_file_id;
  perform 1 from public.natori_projects where id=pid and user_id=p_owner_id for update;
  if not found then return 'not-found'; end if;
  select * into f from public.natori_delivery_files where id=p_file_id for update;
  if f.deleted_at is not null then return 'deleted'; end if;
  if exists(select 1 from public.natori_delivery_releases r,lateral jsonb_array_elements(r.manifest) m
    where r.project_id=pid and m->>'id'=f.id::text) then return 'published'; end if;
  if p_finish and f.state<>'deleting' then return 'invalid-state'; end if;
  update public.natori_delivery_files set state='deleting',
    deleted_at=case when p_finish then clock_timestamp() else null end where id=f.id;
  return case when p_finish then 'deleted' else 'deleting' end;
end $$;

create function public.natori_delivery_issue_v1(p_owner_id uuid,p_project_id uuid,p_operation_id uuid,p_to_email text,
  p_request_hash text,p_manifest jsonb,p_verified_at timestamptz,p_token_hash text,p_expires_at timestamptz,p_payload jsonb)
returns table(result text,release_id uuid,notification_id uuid)
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_delivery_releases%rowtype;
  op public.natori_delivery_operations%rowtype; notice uuid; exp timestamptz; cnt integer; notice_hash text;
begin
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
  if not found then return query select 'not-found',null::uuid,null::uuid; return; end if;
  select * into op from public.natori_delivery_operations where project_id=p.id and operation_id=p_operation_id;
  if found then
    if op.request_hash<>p_request_hash then return query select 'conflict',null::uuid,null::uuid;
    else return query select 'issued',op.release_id,op.notification_id; end if;
    return;
  end if;
  if p.deleted_at is not null or p.status not in ('delivery_prep','delivered','completed') or p.payment_confirmed_at is null then
    return query select 'invalid-state',null::uuid,null::uuid; return; end if;
  if p_operation_id is null or p_request_hash !~ '^[0-9a-f]{64}$' or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_payload->>'format' is distinct from 'natori-delivery-aes256gcm-v1' then
    return query select 'invalid-input',null::uuid,null::uuid; return; end if;
  select * into r from public.natori_delivery_releases where project_id=p.id for update;
  if r.id is not null then
    if r.manifest is distinct from p_manifest then return query select 'conflict',null::uuid,null::uuid; return; end if;
    exp:=r.expires_at;
    -- A still unresolved notification is recovered with its original provider key and access.
    select j.id,j.snapshot->>'requestHash' into notice,notice_hash from public.natori_notification_jobs j where j.project_id=p.id
      and j.purpose='delivery_issue_client' and j.status in ('pending','sending','unknown') order by j.created_at desc limit 1;
    if notice is not null then
      if notice_hash is distinct from p_request_hash then return query select 'conflict',null::uuid,null::uuid; return; end if;
      insert into public.natori_delivery_operations(project_id,operation_id,request_hash,release_id,notification_id)
        values(p.id,p_operation_id,p_request_hash,r.id,notice);
      return query select 'issued',r.id,notice; return;
    end if;
  else
    if p.status='completed' and p.delivery_accepted_at is null then
      return query select 'invalid-state',null::uuid,null::uuid; return; end if;
    exp:=case when p.delivery_token_hash is not null then p.delivery_token_expires_at else p_expires_at end;
  end if;
  if exp is null or exp<=clock_timestamp() or p_expires_at is distinct from exp then
    return query select 'expired',null::uuid,null::uuid; return; end if;
  if p_verified_at is null or p_verified_at>clock_timestamp()+interval '5 seconds'
    or p_verified_at<clock_timestamp()-interval '60 seconds' or jsonb_typeof(p_manifest)<>'array' then
    return query select 'unavailable',null::uuid,null::uuid; return; end if;
  cnt:=jsonb_array_length(p_manifest);
  if cnt not between 1 and 10 or cnt<>(select count(*) from public.natori_delivery_files
    where project_id=p.id and folder='final' and deleted_at is null)
    or cnt<>(select count(distinct m->>'id') from jsonb_array_elements(p_manifest) m)
    or exists(select 1 from jsonb_array_elements(p_manifest) m left join public.natori_delivery_files f
      on f.id::text=m->>'id' and f.project_id=p.id and f.folder='final' and f.deleted_at is null
      where f.id is null or f.state<>'ready' or (m->>'path',m->>'fileName',m->>'sizeBytes',m->>'contentType',m->>'storageVersion')
      is distinct from (f.storage_path,f.file_name,f.size_bytes::text,f.content_type,f.storage_version)) then
    return query select 'unavailable',null::uuid,null::uuid; return; end if;
  if r.id is null then
    -- Set the original hash only for a brand-new release, before the immutable release exists.
    if p.delivery_token_hash is null then
      update public.natori_projects set delivery_token_hash=p_token_hash,delivery_token_expires_at=exp,client_email=p_to_email where id=p.id;
      p.client_email:=p_to_email;
    end if;
    insert into public.natori_delivery_releases(project_id,manifest,snapshot,expires_at,accepted_at,legacy)
      values(p.id,p_manifest,jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email),exp,p.delivery_accepted_at,p.delivery_token_hash is not null)
      returning * into r;
    if p.delivery_token_hash is not null then
      insert into public.natori_delivery_access(token_hash,release_id,expires_at) values(p.delivery_token_hash,r.id,exp);
    end if;
  end if;
  insert into public.natori_delivery_access(token_hash,release_id,expires_at) values(p_token_hash,r.id,exp);
  insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot,payload)
    values('delivery-issued/'||r.id||'/'||p_operation_id,p.id,'delivery_issue_client',
      jsonb_build_object('releaseId',r.id,'title',p.title,'clientName',p.client_name,'requestHash',p_request_hash),p_payload) returning id into notice;
  insert into public.natori_delivery_operations(project_id,operation_id,request_hash,release_id,notification_id)
    values(p.id,p_operation_id,p_request_hash,r.id,notice);
  if p.status='delivery_prep' then
    update public.natori_projects set status='delivered',next_action='依頼者の受け取り確認を待つ' where id=p.id;
  end if;
  return query select 'issued',r.id,notice;
end $$;

-- Existing v1 signatures remain callable by old code, but cannot bypass fresh server evidence.
create function public.natori_accept_delivery_ready_v1(p_token_hash text,p_release_id uuid,
  p_manifest jsonb,p_verified_at timestamptz)
returns table(result text,project_id uuid,project_title text,client_name text,accepted_at timestamptz,notification_ids uuid[])
language plpgsql security invoker set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_delivery_releases%rowtype; a public.natori_delivery_access%rowtype;
  pid uuid; exp timestamptz; t timestamptz; ids uuid[];
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query select 'not-found',null::uuid,null::text,null::text,null::timestamptz,array[]::uuid[]; return; end if;
  select rr.project_id into pid from public.natori_delivery_access aa join public.natori_delivery_releases rr on rr.id=aa.release_id
    where aa.token_hash=p_token_hash;
  if pid is null then select id into pid from public.natori_projects where delivery_token_hash=p_token_hash; end if;
  select * into p from public.natori_projects where id=pid for update;
  if not found then return query select 'not-found',null::uuid,null::text,null::text,null::timestamptz,array[]::uuid[]; return; end if;
  select * into r from public.natori_delivery_releases where natori_delivery_releases.project_id=p.id for update;
  select * into a from public.natori_delivery_access where token_hash=p_token_hash;
  exp:=case when a.token_hash is not null then a.expires_at else p.delivery_token_expires_at end;
  t:=clock_timestamp();
  -- Preserve v1 idempotent result for previously accepted links, even after their original expiry.
  if p.delivery_accepted_at is not null then result:='already-accepted';
  elsif p.deleted_at is not null or p.status='closed' then result:='archived';
  elsif p.payment_confirmed_at is null then result:='unpaid';
  elsif exp is null or exp<=t then result:='expired';
  elsif p.status<>'delivered' or p.completed_at is not null then result:='invalid-state';
  elsif r.id is null or p_release_id is distinct from r.id or p_manifest is distinct from r.manifest
    or p_verified_at is null or p_verified_at>t+interval '5 seconds' or p_verified_at<t-interval '60 seconds' then result:='unavailable';
  else
    update public.natori_delivery_releases set accepted_at=t where id=r.id;
    update public.natori_projects set delivery_accepted_at=t,completed_at=t,status='completed',next_action='完了' where id=p.id;
    insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot)
      select 'delivery-accepted/'||p.id||'/'||purpose,p.id,purpose,
        jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email,'acceptedAt',t)
      from unnest(array['delivery_accept_artist','delivery_accept_client']) purpose;
    p.delivery_accepted_at:=t; result:='accepted';
  end if;
  select coalesce(array_agg(j.id),array[]::uuid[]) into ids from public.natori_notification_jobs j where j.project_id=p.id
    and j.purpose in ('delivery_accept_artist','delivery_accept_client') and j.status in ('pending','sending','unknown');
  return query select result,p.id,p.title,p.client_name,p.delivery_accepted_at,ids;
end $$;

create or replace function public.natori_accept_delivery_v1(p_token_hash text)
returns table(result text,project_id uuid,project_title text,client_name text,accepted_at timestamptz)
language sql security invoker set search_path='' as $$
  select r.result,r.project_id,r.project_title,r.client_name,r.accepted_at
    from public.natori_accept_delivery_ready_v1(p_token_hash,null,null,null) r;
$$;
create or replace function public.natori_accept_delivery_with_notifications_v1(p_token_hash text)
returns table(result text,project_id uuid,project_title text,client_name text,accepted_at timestamptz,notification_ids uuid[])
language sql security invoker set search_path='' as $$
  select * from public.natori_accept_delivery_ready_v1(p_token_hash,null,null,null);
$$;

-- Mail delivery evidence is committed with provider result, never a stale project status update.
create or replace function public.natori_notification_finish_v1(p_id uuid,p_claim_token uuid,p_status text,p_provider_id text default null,p_error_code text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare j public.natori_notification_jobs%rowtype;
begin
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

-- All entry points are server-only. No new grants to anonymous or authenticated JWTs.
do $$ declare f record; begin
  for f in select oid::regprocedure::text as signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('natori_delivery_file_guard_v1','natori_delivery_release_guard_v1','natori_delivery_project_guard_v1',
      'natori_delivery_reserve_v1','natori_delivery_finalize_v1','natori_delivery_delete_v1','natori_delivery_issue_v1',
      'natori_accept_delivery_ready_v1','natori_delivery_purge_payloads_v1') loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';
    if f.signature not like '%guard_v1()' then execute 'grant execute on function '||f.signature||' to service_role'; end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;

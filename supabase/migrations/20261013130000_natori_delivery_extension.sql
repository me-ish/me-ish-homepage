-- PAY-04: extend an issued delivery's download period and resend it, without touching the original evidence.
-- The release row, its manifest and its original expires_at stay immutable. An extension is a new append-only
-- fact; the effective expiry is the latest extension (or the original). Each extension also issues a NEW
-- access token, so links that already expired are never revived.
begin;

create table public.natori_delivery_extensions (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.natori_delivery_releases(id),
  project_id uuid not null references public.natori_projects(id),
  operation_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  previous_expires_at timestamptz not null,
  new_expires_at timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default clock_timestamp(),
  unique (project_id, operation_id),
  check (new_expires_at > previous_expires_at)
);
create index natori_delivery_extensions_release on public.natori_delivery_extensions(release_id, new_expires_at desc);

alter table public.natori_delivery_extensions enable row level security;
revoke all on public.natori_delivery_extensions from public, anon, authenticated, service_role;
grant select, insert on public.natori_delivery_extensions to service_role;

create function public.natori_delivery_extension_guard_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'Append-only delivery extension' using errcode='23514';
end $$;
create trigger natori_delivery_extension_guard before update or delete on public.natori_delivery_extensions
  for each row execute function public.natori_delivery_extension_guard_v1();

create function public.natori_delivery_extend_v1(p_owner_id uuid, p_project_id uuid, p_operation_id uuid,
  p_request_hash text, p_new_expires_at timestamptz, p_reason text, p_token_hash text, p_manifest jsonb,
  p_verified_at timestamptz, p_payload jsonb)
returns table(result text, release_id uuid, notification_id uuid)
language plpgsql security definer set search_path='' as $$
declare p public.natori_projects%rowtype; r public.natori_delivery_releases%rowtype;
  op public.natori_delivery_operations%rowtype; cur timestamptz; t timestamptz:=clock_timestamp(); notice uuid;
begin
  select * into p from public.natori_projects where id=p_project_id and user_id=p_owner_id for update;
  if not found then return query select 'not-found', null::uuid, null::uuid; return; end if;
  select * into op from public.natori_delivery_operations o where o.project_id=p.id and o.operation_id=p_operation_id;
  if found then
    if op.request_hash<>p_request_hash then return query select 'conflict', null::uuid, null::uuid;
    else return query select 'extended', op.release_id, op.notification_id; end if;
    return;
  end if;
  if p_operation_id is null or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_new_expires_at is null
    or p_reason is null or char_length(p_reason) not between 1 and 200
    or p_payload->>'format' is distinct from 'natori-delivery-aes256gcm-v1' then
    return query select 'invalid-input', null::uuid, null::uuid; return; end if;
  -- Only an issued, paid, not yet received delivery can be extended.
  if p.deleted_at is not null or p.status<>'delivered' or p.payment_confirmed_at is null
    or p.delivery_accepted_at is not null or p.completed_at is not null then
    return query select 'invalid-state', null::uuid, null::uuid; return; end if;
  select * into r from public.natori_delivery_releases rr where rr.project_id=p.id for update;
  if r.id is null or r.accepted_at is not null then
    return query select 'invalid-state', null::uuid, null::uuid; return; end if;
  -- A mail that is still being sent keeps its own recovery path; do not queue a second one.
  if exists (select 1 from public.natori_notification_jobs j where j.project_id=p.id
    and j.purpose='delivery_issue_client' and j.status in ('pending','sending','unknown')) then
    return query select 'notice-pending', null::uuid, null::uuid; return; end if;
  select greatest(r.expires_at, coalesce(max(x.new_expires_at), r.expires_at)) into cur
    from public.natori_delivery_extensions x where x.release_id=r.id;
  if p_new_expires_at<=cur or p_new_expires_at<=t+interval '1 day' or p_new_expires_at>t+interval '31 days' then
    return query select 'invalid-expiry', null::uuid, null::uuid; return; end if;
  -- The immutable release manifest is the only thing that can be resent, and it must still verify in Storage.
  if p_manifest is distinct from r.manifest or p_verified_at is null or p_verified_at>t+interval '5 seconds'
    or p_verified_at<t-interval '60 seconds' then
    return query select 'unavailable', null::uuid, null::uuid; return; end if;
  insert into public.natori_delivery_extensions(release_id, project_id, operation_id, request_hash,
    previous_expires_at, new_expires_at, reason)
    values(r.id, p.id, p_operation_id, p_request_hash, cur, p_new_expires_at, p_reason);
  insert into public.natori_delivery_access(token_hash, release_id, expires_at)
    values(p_token_hash, r.id, p_new_expires_at);
  insert into public.natori_notification_jobs(notification_key, project_id, purpose, snapshot, payload)
    values('delivery-extended/'||r.id||'/'||p_operation_id, p.id, 'delivery_issue_client',
      jsonb_build_object('releaseId', r.id, 'title', p.title, 'clientName', p.client_name, 'requestHash', p_request_hash),
      p_payload) returning id into notice;
  insert into public.natori_delivery_operations(project_id, operation_id, request_hash, release_id, notification_id)
    values(p.id, p_operation_id, p_request_hash, r.id, notice);
  return query select 'extended', r.id, notice;
end $$;

do $$ declare f record; begin
  for f in select oid::regprocedure::text as signature from pg_proc where pronamespace='public'::regnamespace
    and proname in ('natori_delivery_extension_guard_v1','natori_delivery_extend_v1') loop
    execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';
    if f.signature not like '%guard_v1()' then execute 'grant execute on function '||f.signature||' to service_role'; end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;

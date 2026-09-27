-- Phase N expand only. No historical enqueue, token changes or business backfill.
begin;

create table public.natori_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null,
  attempt_no integer not null default 1 check (attempt_no between 1 and 5),
  project_id uuid not null references public.natori_projects(id),
  quote_id uuid references public.natori_quotes(id),
  purpose text not null check (purpose in ('quote_accept_artist','delivery_accept_artist','delivery_accept_client')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  payload jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','unknown')),
  claim_token uuid,
  lease_expires_at timestamptz,
  claim_count integer not null default 0 check (claim_count between 0 and 8),
  send_started_at timestamptz,
  retry_after timestamptz,
  provider_id text,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(notification_key, attempt_no),
  check (status <> 'sent' or (sent_at is not null and provider_id is not null)),
  check (status <> 'sending' or (claim_token is not null and lease_expires_at is not null))
);
create unique index natori_notification_one_open on public.natori_notification_jobs(notification_key)
  where status in ('pending','sending','unknown');
create index natori_notification_project on public.natori_notification_jobs(project_id, created_at desc);
create index natori_notification_quote on public.natori_notification_jobs(quote_id) where quote_id is not null;
alter table public.natori_notification_jobs enable row level security;
revoke all on public.natori_notification_jobs from public, anon, authenticated, service_role;
grant select, insert, update on public.natori_notification_jobs to service_role;

-- Freeze the business snapshot and the exact request reused with an idempotency key.
create function public.natori_notification_immutable_v1() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.notification_key,new.attempt_no,new.project_id,new.quote_id,new.purpose,new.snapshot,new.created_at)
     is distinct from (old.notification_key,old.attempt_no,old.project_id,old.quote_id,old.purpose,old.snapshot,old.created_at)
     or (old.payload is not null and new.payload is distinct from old.payload)
     or (old.send_started_at is not null and new.send_started_at is distinct from old.send_started_at)
     or (old.status = 'sent' and new is distinct from old) then
    raise exception 'Immutable notification evidence' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger natori_notification_immutable before update on public.natori_notification_jobs
  for each row execute function public.natori_notification_immutable_v1();

-- Reuse the existing business RPC and locks. The wrapper is ONE transaction:
-- failure to enqueue rolls acceptance back too. Existing accepted rows get no new mail.
create function public.natori_accept_quote_with_notifications_v1(p_token_hash text)
returns table(result text, quote_id uuid, project_id uuid, accepted_at timestamptz, notification_ids uuid[])
language plpgsql security invoker set search_path = '' as $$
declare r record; q public.natori_quotes%rowtype; ids uuid[];
begin
  select * into r from public.natori_accept_quote(p_token_hash);
  if r.result = 'ok' then
    select * into strict q from public.natori_quotes where id = r.quote_id;
    insert into public.natori_notification_jobs(notification_key,project_id,quote_id,purpose,snapshot)
    values ('quote-accepted/' || q.id, q.project_id, q.id, 'quote_accept_artist',
      jsonb_build_object('title',q.title,'clientName',q.client_name,'amount',q.amount,'acceptedAt',r.accepted_at));
  end if;
  select coalesce(array_agg(j.id),array[]::uuid[]) into ids from public.natori_notification_jobs j
    where j.notification_key = 'quote-accepted/' || r.quote_id and j.status in ('pending','sending','unknown');
  return query select r.result::text,r.quote_id::uuid,r.project_id::uuid,r.accepted_at::timestamptz,ids;
end;
$$;

create function public.natori_accept_delivery_with_notifications_v1(p_token_hash text)
returns table(result text, project_id uuid, project_title text, client_name text, accepted_at timestamptz, notification_ids uuid[])
language plpgsql security invoker set search_path = '' as $$
declare r record; p public.natori_projects%rowtype; ids uuid[];
begin
  select * into r from public.natori_accept_delivery_v1(p_token_hash);
  if r.result = 'accepted' then
    select * into strict p from public.natori_projects where id = r.project_id;
    insert into public.natori_notification_jobs(notification_key,project_id,purpose,snapshot)
    select 'delivery-accepted/' || p.id || '/' || purpose, p.id, purpose,
      jsonb_build_object('title',p.title,'clientName',p.client_name,'clientEmail',p.client_email,'acceptedAt',r.accepted_at)
    from unnest(array['delivery_accept_artist','delivery_accept_client']) as purpose;
  end if;
  select coalesce(array_agg(j.id),array[]::uuid[]) into ids from public.natori_notification_jobs j
    where j.project_id = r.project_id and j.purpose in ('delivery_accept_artist','delivery_accept_client')
      and j.status in ('pending','sending','unknown');
  return query select r.result::text,r.project_id::uuid,r.project_title::text,r.client_name::text,r.accepted_at::timestamptz,ids;
end;
$$;

create function public.natori_notification_claim_v1(p_id uuid, p_claim_token uuid, p_manual boolean default false)
returns setof public.natori_notification_jobs
language plpgsql security invoker set search_path = '' as $$
declare j public.natori_notification_jobs%rowtype; t timestamptz := clock_timestamp();
begin
  select * into j from public.natori_notification_jobs where id=p_id for update;
  if not found or p_claim_token is null or j.status in ('sent','failed') then return; end if;
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

-- Bind payload and start the conservative idempotency clock BEFORE contacting the provider.
create function public.natori_notification_start_v1(p_id uuid,p_claim_token uuid,p_payload jsonb)
returns setof public.natori_notification_jobs
language plpgsql security invoker set search_path = '' as $$
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return; end if;
  return query update public.natori_notification_jobs set payload=coalesce(payload,p_payload),
    send_started_at=coalesce(send_started_at,clock_timestamp()),updated_at=clock_timestamp()
    where id=p_id and status='sending' and claim_token=p_claim_token and lease_expires_at>clock_timestamp()
      and (payload is null or payload=p_payload)
      and (send_started_at is null or send_started_at>clock_timestamp()-interval '23 hours') returning *;
end;
$$;

create function public.natori_notification_finish_v1(p_id uuid,p_claim_token uuid,p_status text,p_provider_id text default null,p_error_code text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('sent','failed','unknown') or p_status is null then return false; end if;
  if p_status='sent' and (p_provider_id is null or length(p_provider_id)>200) then return false; end if;
  if p_error_code is not null and p_error_code !~ '^[a-z_]{1,60}$' then return false; end if;
  update public.natori_notification_jobs set status=p_status,provider_id=p_provider_id,
    sent_at=case when p_status='sent' then clock_timestamp() else null end,
    error_code=p_error_code,claim_token=null,lease_expires_at=null,
    retry_after=case when p_status='unknown' then clock_timestamp()+interval '1 minute' else null end,
    updated_at=clock_timestamp()
    where id=p_id and status='sending' and claim_token=p_claim_token and lease_expires_at>clock_timestamp()
      and (p_status<>'sent' or (payload is not null and send_started_at is not null));
  return found;
end;
$$;

-- A fresh provider key is allowed ONLY after a definite non-acceptance. Unknown is never replaced.
-- Advisory lock serializes requests against an older failed attempt, not just the latest row.
create function public.natori_notification_retry_v1(p_id uuid,p_owner_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare j public.natori_notification_jobs%rowtype; latest public.natori_notification_jobs%rowtype; new_id uuid;
begin
  select n.* into j from public.natori_notification_jobs n join public.natori_projects p on p.id=n.project_id
    where n.id=p_id and p.user_id=p_owner_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(j.notification_key,0));
  select * into latest from public.natori_notification_jobs where notification_key=j.notification_key order by attempt_no desc limit 1 for update;
  if latest.status='sent' then return null; end if;
  if latest.status<>'failed' then return latest.id; end if;
  if latest.attempt_no>=5 then return null; end if;
  insert into public.natori_notification_jobs(notification_key,attempt_no,project_id,quote_id,purpose,snapshot,payload)
    values(latest.notification_key,latest.attempt_no+1,latest.project_id,latest.quote_id,latest.purpose,latest.snapshot,latest.payload)
    returning id into new_id;
  return new_id;
end;
$$;

-- Latest attempt per logical notification, unresolved first. Pagination must not
-- hide an old pending notification behind a long history of successful sends.
create function public.natori_notification_list_v1(p_owner_id uuid,p_offset integer default 0)
returns table(id uuid,project_id uuid,project_title text,purpose text,status text,attempt_no integer,
  claim_count integer,lease_expires_at timestamptz,send_started_at timestamptz,retry_after timestamptz,last_sent_at timestamptz)
language sql security invoker set search_path = '' as $$
  with history as (
    select j.*,p.title as project_title,max(j.sent_at) over (partition by j.notification_key) as last_sent_at
    from public.natori_notification_jobs j join public.natori_projects p on p.id=j.project_id
    where p.user_id=p_owner_id
  ), latest as (
    select distinct on (h.notification_key) h.* from history h order by h.notification_key,h.attempt_no desc
  )
  select l.id,l.project_id,l.project_title,l.purpose,l.status,l.attempt_no,l.claim_count,
    l.lease_expires_at,l.send_started_at,l.retry_after,l.last_sent_at
  from latest l order by (l.status='sent'),l.created_at desc,l.id
  limit 51 offset greatest(0,least(p_offset,100000));
$$;

-- No PUBLIC default EXECUTE; no browser/Auth JWT can inspect recipients or operate the queue.
revoke all on function public.natori_notification_immutable_v1() from public,anon,authenticated,service_role;
revoke all on function public.natori_accept_quote_with_notifications_v1(text) from public,anon,authenticated,service_role;
revoke all on function public.natori_accept_delivery_with_notifications_v1(text) from public,anon,authenticated,service_role;
revoke all on function public.natori_notification_claim_v1(uuid,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function public.natori_notification_start_v1(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.natori_notification_finish_v1(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.natori_notification_retry_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.natori_notification_list_v1(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.natori_accept_quote_with_notifications_v1(text) to service_role;
grant execute on function public.natori_accept_delivery_with_notifications_v1(text) to service_role;
grant execute on function public.natori_notification_claim_v1(uuid,uuid,boolean) to service_role;
grant execute on function public.natori_notification_start_v1(uuid,uuid,jsonb) to service_role;
grant execute on function public.natori_notification_finish_v1(uuid,uuid,text,text,text) to service_role;
grant execute on function public.natori_notification_retry_v1(uuid,uuid) to service_role;
grant execute on function public.natori_notification_list_v1(uuid,integer) to service_role;
notify pgrst, 'reload schema';
commit;

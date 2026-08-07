-- Etorie P1-12: accept a delivery and complete its project atomically.
-- The plaintext delivery token never reaches Postgres; the server sends only
-- its SHA-256 hash. The project row lock serializes retries and concurrent POSTs.

begin;

create function public.natori_accept_delivery_v1(
  p_token_hash text
)
returns table (
  result text,
  project_id uuid,
  project_title text,
  client_name text,
  accepted_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.natori_projects%rowtype;
  v_now timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return query
      select 'not-found'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  select projects.*
  into v_project
  from public.natori_projects as projects
  where projects.delivery_token_hash = p_token_hash
  for update;

  if not found then
    return query
      select 'not-found'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- Resolve the current time only after the row lock is held. A request that
  -- waited behind a token reissue or another acceptance must validate expiry
  -- against the time at which it actually owns the project lock.
  v_now := clock_timestamp();

  -- A successful retry remains successful even after the original token expiry.
  if v_project.delivery_accepted_at is not null then
    return query select
      'already-accepted'::text,
      v_project.id,
      v_project.title,
      v_project.client_name,
      v_project.delivery_accepted_at;
    return;
  end if;

  if v_project.deleted_at is not null then
    return query select
      'archived'::text, v_project.id, v_project.title, v_project.client_name,
      null::timestamptz;
    return;
  end if;

  if v_project.payment_confirmed_at is null then
    return query select
      'unpaid'::text, v_project.id, v_project.title, v_project.client_name,
      null::timestamptz;
    return;
  end if;

  if v_project.delivery_token_expires_at is null
     or v_project.delivery_token_expires_at <= v_now then
    return query select
      'expired'::text, v_project.id, v_project.title, v_project.client_name,
      null::timestamptz;
    return;
  end if;

  -- Only a newly delivered project may be completed by requester acceptance.
  -- Existing manually completed rows and inconsistent partial timestamps stay
  -- untouched for administrator review.
  if v_project.status <> 'delivered'
     or v_project.delivered_mail_at is null
     or v_project.completed_at is not null then
    return query select
      'invalid-state'::text, v_project.id, v_project.title, v_project.client_name,
      null::timestamptz;
    return;
  end if;

  update public.natori_projects
  set delivery_accepted_at = v_now,
      completed_at = v_now,
      status = 'completed',
      next_action = '完了',
      updated_at = v_now
  where id = v_project.id;

  -- P1-10's delivery activity trigger runs inside this transaction. If that
  -- insert fails, this update rolls back with it and no partial timestamps remain.
  return query select
    'accepted'::text,
    v_project.id,
    v_project.title,
    v_project.client_name,
    v_now;
end;
$$;

comment on function public.natori_accept_delivery_v1(text) is
  'P1-12 service-role-only atomic requester delivery acceptance; returns a domain result for idempotent retries.';

revoke all on function public.natori_accept_delivery_v1(text)
from public, anon, authenticated, service_role;

grant execute on function public.natori_accept_delivery_v1(text)
to service_role;

commit;

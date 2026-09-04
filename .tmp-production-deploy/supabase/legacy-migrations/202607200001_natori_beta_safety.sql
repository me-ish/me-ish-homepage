-- Natori limited-beta safety hardening.
--
-- This migration adds immutable quote revisions, durable outbound-mail state,
-- payment audit fields, private inquiry references, and transactional RPCs for
-- project/task mutations. Existing completed rows are deliberately NOT marked
-- as paid: historical payment status must be reviewed explicitly.

/* --------------------------------------------------------------------------
   Immutable quote revisions
---------------------------------------------------------------------------- */

create table if not exists public.natori_quotes (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.natori_projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  version         integer not null check (version > 0),
  title           text not null,
  client_name     text not null,
  to_email        text not null,
  amount          integer not null check (amount >= 0),
  subject         text not null,
  body_snapshot   text not null,
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  superseded_at   timestamptz,
  created_at      timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists idx_natori_quotes_project_created
  on public.natori_quotes(project_id, created_at desc);
create index if not exists idx_natori_quotes_user
  on public.natori_quotes(user_id);

alter table public.natori_quotes enable row level security;
-- No client policies: quote tokens are resolved by server-only code.

alter table public.natori_projects
  add column if not exists active_quote_id uuid references public.natori_quotes(id) on delete set null,
  add column if not exists payment_quote_id uuid references public.natori_quotes(id) on delete set null,
  add column if not exists payment_link_url text,
  add column if not exists payment_link_status text,
  add column if not exists paid_amount integer,
  add column if not exists stripe_payment_session_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'natori_projects_payment_link_status_check'
  ) then
    alter table public.natori_projects add constraint natori_projects_payment_link_status_check
      check (payment_link_status is null or payment_link_status in (
        'issuing','ready','sent','send_failed','paid','void'
      ));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'natori_projects_paid_amount_check'
  ) then
    alter table public.natori_projects add constraint natori_projects_paid_amount_check
      check (paid_amount is null or paid_amount >= 0);
  end if;
end
$$;

create table if not exists public.natori_payment_transactions (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.natori_projects(id) on delete cascade,
  quote_id           uuid references public.natori_quotes(id) on delete set null,
  stripe_session_id  text unique,
  amount             integer not null check (amount >= 0),
  status             text not null check (status in ('received','amount_mismatch','quote_mismatch','duplicate_payment','manual')),
  received_at        timestamptz not null default now(),
  note               text
);

create index if not exists idx_natori_payment_transactions_project
  on public.natori_payment_transactions(project_id, received_at desc);
alter table public.natori_payment_transactions enable row level security;
-- No client policies: payment audit rows are service-only.

/* --------------------------------------------------------------------------
   Durable outbound-mail state
---------------------------------------------------------------------------- */

alter table public.natori_order_mail_logs
  add column if not exists request_id uuid,
  add column if not exists status text,
  add column if not exists subject text,
  add column if not exists body_snapshot text,
  add column if not exists quote_id uuid references public.natori_quotes(id) on delete set null,
  add column if not exists error_message text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.natori_order_mail_logs
set request_id = coalesce(request_id, gen_random_uuid()),
    status = coalesce(status, 'sent'),
    subject = coalesce(subject, ''),
    body_snapshot = coalesce(body_snapshot, '')
where request_id is null or status is null or subject is null or body_snapshot is null;

alter table public.natori_order_mail_logs
  alter column request_id set not null,
  alter column status set not null,
  alter column subject set not null,
  alter column body_snapshot set not null,
  alter column sent_at drop not null,
  alter column sent_at drop default;

create unique index if not exists idx_natori_order_mail_logs_request
  on public.natori_order_mail_logs(request_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'natori_order_mail_logs_status_check'
  ) then
    alter table public.natori_order_mail_logs add constraint natori_order_mail_logs_status_check
      check (status in ('pending','sent','failed','state_error'));
  end if;
end
$$;

/* --------------------------------------------------------------------------
   Private inquiry reference files
---------------------------------------------------------------------------- */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'natori-inquiry-refs',
  'natori-inquiry-refs',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.natori_inquiry_reference_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.natori_projects(id) on delete cascade,
  storage_path  text not null unique,
  created_at    timestamptz not null default now()
);

create index if not exists idx_natori_inquiry_reference_project
  on public.natori_inquiry_reference_files(project_id, created_at);
alter table public.natori_inquiry_reference_files enable row level security;
-- No client policies: access is service-only and URLs are short-lived.

/* --------------------------------------------------------------------------
   Atomic project/task operations
---------------------------------------------------------------------------- */

create or replace function public.natori_create_project_with_tasks(
  p_user_id uuid,
  p_project jsonb,
  p_tasks jsonb,
  p_reference_paths jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if p_user_id is null then
    raise exception 'owner_required';
  end if;

  insert into public.natori_projects (
    user_id, title, client_name, client_email, amount, type, status,
    delivery_plan, priority, start_date, due_date, next_action, note,
    payment_confirmed_at, paid_at, paid_amount, completed_at
  ) values (
    p_user_id,
    p_project->>'title',
    p_project->>'client_name',
    nullif(p_project->>'client_email', ''),
    coalesce((p_project->>'amount')::integer, 0),
    p_project->>'type',
    p_project->>'status',
    p_project->>'delivery_plan',
    nullif(p_project->>'priority', ''),
    nullif(p_project->>'start_date', '')::date,
    (p_project->>'due_date')::date,
    coalesce(p_project->>'next_action', ''),
    nullif(p_project->>'note', ''),
    nullif(p_project->>'payment_confirmed_at', '')::timestamptz,
    nullif(p_project->>'paid_at', '')::timestamptz,
    nullif(p_project->>'paid_amount', '')::integer,
    nullif(p_project->>'completed_at', '')::timestamptz
  ) returning id into v_project_id;

  insert into public.natori_project_tasks (
    project_id, task_key, label, stage, estimated_hours, done, sort_order
  )
  select
    v_project_id,
    task_key,
    label,
    stage,
    estimated_hours,
    done,
    sort_order
  from jsonb_to_recordset(coalesce(p_tasks, '[]'::jsonb)) as x(
    task_key text,
    label text,
    stage text,
    estimated_hours numeric,
    done boolean,
    sort_order integer
  );

  insert into public.natori_inquiry_reference_files (project_id, storage_path)
  select v_project_id, value
  from jsonb_array_elements_text(coalesce(p_reference_paths, '[]'::jsonb));

  if nullif(p_project->>'paid_at', '') is not null then
    insert into public.natori_payment_transactions (
      project_id, amount, status, received_at, note
    ) values (
      v_project_id,
      coalesce((p_project->>'paid_amount')::integer, (p_project->>'amount')::integer),
      'manual',
      (p_project->>'paid_at')::timestamptz,
      'manual historical result entry'
    );
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb) to service_role;

create or replace function public.natori_delete_project(
  p_user_id uuid,
  p_project_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted uuid;
begin
  delete from public.natori_projects
  where id = p_project_id and user_id = p_user_id
  returning id into v_deleted;
  return v_deleted is not null;
end;
$$;

revoke all on function public.natori_delete_project(uuid, uuid) from public;
grant execute on function public.natori_delete_project(uuid, uuid) to service_role;

create or replace function public.natori_update_task_and_status(
  p_user_id uuid,
  p_project_id uuid,
  p_task_key text,
  p_done boolean,
  p_status text,
  p_next_action text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.natori_projects%rowtype;
  v_task_id uuid;
  v_from text;
  v_to text;
  v_from_pre integer;
  v_to_pre integer;
  v_valid_transition boolean := false;
begin
  select * into v_project
  from public.natori_projects
  where id = p_project_id and user_id = p_user_id
  for update;

  if not found then return false; end if;

  if v_project.status = 'completed' and p_status <> 'completed' then
    raise exception 'completed_project_requires_explicit_reopen';
  end if;

  if p_status not in (
    'inquiry','consulting','estimating','quoted','awaiting_payment','rough',
    'lineart','coloring','waiting','delivery_prep','delivered','completed','closed'
  ) then
    raise exception 'invalid_status';
  end if;

  v_from := case when v_project.status = 'consulting' then 'inquiry' else v_project.status end;
  v_to := case when p_status = 'consulting' then 'inquiry' else p_status end;
  v_from_pre := array_position(array['inquiry','estimating','quoted','awaiting_payment'], v_from);
  v_to_pre := array_position(array['inquiry','estimating','quoted','awaiting_payment'], v_to);
  v_valid_transition :=
    v_from = v_to
    or (v_from = 'closed' and v_to = 'inquiry')
    or (v_to = 'closed' and v_from_pre is not null)
    or (v_from_pre is not null and v_to_pre is not null and v_to_pre > v_from_pre)
    or (
      v_from_pre is not null
      and v_to in ('rough','lineart','coloring','waiting','delivery_prep','delivered','completed')
    )
    or (
      v_from in ('rough','lineart','coloring','waiting','delivery_prep','delivered','completed')
      and v_to in ('rough','lineart','coloring','waiting','delivery_prep','delivered','completed')
    );
  if v_valid_transition is not true then
    raise exception 'invalid_status_transition';
  end if;

  if p_status in ('rough','lineart','coloring','waiting','delivery_prep','delivered','completed')
     and v_project.payment_confirmed_at is null then
    raise exception 'payment_required';
  end if;

  update public.natori_project_tasks
  set done = p_done
  where project_id = p_project_id and task_key = p_task_key
  returning id into v_task_id;

  if v_task_id is null then return false; end if;

  update public.natori_projects
  set status = p_status,
      next_action = coalesce(p_next_action, ''),
      completed_at = case
        when p_status = 'completed' then coalesce(completed_at, now())
        else completed_at
      end
  where id = p_project_id and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text) from public;
grant execute on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text) to service_role;

create or replace function public.natori_confirm_manual_payment(
  p_user_id uuid,
  p_project_id uuid,
  p_next_action text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.natori_projects%rowtype;
  v_now timestamptz := now();
begin
  select * into v_project
  from public.natori_projects
  where id = p_project_id
    and user_id = p_user_id
    and payment_confirmed_at is null
    and status in ('inquiry','estimating','consulting','quoted','awaiting_payment')
  for update;
  if not found then return false; end if;

  update public.natori_projects
  set status = 'rough',
      next_action = coalesce(p_next_action, ''),
      payment_confirmed_at = v_now,
      paid_at = v_now,
      paid_amount = v_project.amount,
      payment_link_status = 'paid'
  where id = p_project_id and user_id = p_user_id;

  insert into public.natori_payment_transactions (
    project_id, quote_id, amount, status, received_at, note
  ) values (
    p_project_id,
    v_project.active_quote_id,
    v_project.amount,
    'manual',
    v_now,
    'manual payment confirmation'
  );
  return true;
end;
$$;

revoke all on function public.natori_confirm_manual_payment(uuid, uuid, text) from public;
grant execute on function public.natori_confirm_manual_payment(uuid, uuid, text) to service_role;

create or replace function public.natori_record_stripe_payment(
  p_project_id uuid,
  p_session_id text,
  p_amount integer,
  p_quote_id uuid
)
returns table(result text, advanced boolean, new_event boolean, recorded_amount integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.natori_projects%rowtype;
  v_amount integer;
  v_now timestamptz := now();
  v_inserted integer := 0;
  v_advanced boolean := false;
  v_entry text;
begin
  if nullif(trim(p_session_id), '') is null then
    raise exception 'stripe_session_required';
  end if;

  select * into v_project
  from public.natori_projects
  where id = p_project_id
  for update;
  if not found then
    return query select 'not-found'::text, false, false, null::integer;
    return;
  end if;

  v_amount := coalesce(p_amount, v_project.amount);
  if v_amount < 0 then raise exception 'invalid_payment_amount'; end if;

  -- 入金済み案件では金額照合より先にsessionを判定する。別sessionなら金額に
  -- かかわらず重複入金として扱い、返金確認の対象にする。
  if v_project.payment_confirmed_at is not null then
    if v_project.stripe_payment_session_id = p_session_id then
      return query select 'already-paid'::text, false, false, v_amount;
      return;
    end if;

    insert into public.natori_payment_transactions (
      project_id, quote_id, stripe_session_id, amount, status, received_at, note
    ) values (
      v_project.id, v_project.payment_quote_id, p_session_id, v_amount,
      'duplicate_payment', v_now,
      'original_session=' || coalesce(v_project.stripe_payment_session_id, 'unknown')
    ) on conflict (stripe_session_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      v_entry := '【要確認: 重複入金の可能性（Stripe） ' ||
        to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || '】' ||
        v_amount::text || '円 / session: ' || p_session_id;
      update public.natori_projects
      set note = concat_ws(E'\n\n', nullif(note, ''), v_entry)
      where id = v_project.id;
    end if;
    return query select 'duplicate-payment'::text, false, v_inserted = 1, v_amount;
    return;
  end if;

  if v_project.payment_quote_id is not null
     and p_quote_id is distinct from v_project.payment_quote_id then
    insert into public.natori_payment_transactions (
      project_id, quote_id, stripe_session_id, amount, status, received_at, note
    ) values (
      v_project.id, p_quote_id, p_session_id, v_amount,
      'quote_mismatch', v_now,
      'expected_quote=' || v_project.payment_quote_id::text
    ) on conflict (stripe_session_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      v_entry := '【要確認: 旧見積もりへの入金（Stripe） ' ||
        to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || '】' ||
        v_amount::text || '円 / session: ' || p_session_id;
      update public.natori_projects
      set note = concat_ws(E'\n\n', nullif(note, ''), v_entry)
      where id = v_project.id;
    end if;
    return query select 'quote-mismatch'::text, false, v_inserted = 1, v_amount;
    return;
  end if;

  if v_project.quoted_amount is not null
     and p_amount is not null
     and p_amount <> v_project.quoted_amount then
    insert into public.natori_payment_transactions (
      project_id, quote_id, stripe_session_id, amount, status, received_at, note
    ) values (
      v_project.id, v_project.payment_quote_id, p_session_id, p_amount,
      'amount_mismatch', v_now, 'expected=' || v_project.quoted_amount::text
    ) on conflict (stripe_session_id) do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      v_entry := '【要確認: 入金金額不一致（Stripe） ' ||
        to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || '】受領 ' ||
        p_amount::text || '円 / 見積 ' || v_project.quoted_amount::text ||
        '円 / session: ' || p_session_id;
      update public.natori_projects
      set note = concat_ws(E'\n\n', nullif(note, ''), v_entry)
      where id = v_project.id;
    end if;
    return query select 'amount-mismatch'::text, false, v_inserted = 1, p_amount;
    return;
  end if;

  v_advanced := v_project.status in (
    'inquiry','consulting','estimating','quoted','awaiting_payment'
  );
  v_entry := '【入金確認（Stripe） ' ||
    to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') || '】' ||
    v_amount::text || '円 / session: ' || p_session_id;

  update public.natori_projects
  set payment_confirmed_at = v_now,
      paid_at = v_now,
      paid_amount = v_amount,
      stripe_payment_session_id = p_session_id,
      payment_link_status = 'paid',
      note = concat_ws(E'\n\n', nullif(note, ''), v_entry),
      status = case when v_advanced then 'rough' else status end,
      next_action = case when v_advanced then 'ラフ提出' else next_action end
  where id = v_project.id;

  insert into public.natori_payment_transactions (
    project_id, quote_id, stripe_session_id, amount, status, received_at
  ) values (
    v_project.id, v_project.payment_quote_id, p_session_id, v_amount, 'received', v_now
  );

  return query select 'received'::text, v_advanced, true, v_amount;
end;
$$;

revoke all on function public.natori_record_stripe_payment(uuid, text, integer, uuid) from public;
grant execute on function public.natori_record_stripe_payment(uuid, text, integer, uuid) to service_role;

/* --------------------------------------------------------------------------
   Atomic quote issue/accept operations
---------------------------------------------------------------------------- */

create or replace function public.natori_issue_quote(
  p_user_id uuid,
  p_project_id uuid,
  p_title text,
  p_client_name text,
  p_to_email text,
  p_amount integer,
  p_subject text,
  p_body_snapshot text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_version integer;
begin
  perform 1 from public.natori_projects
  where id = p_project_id and user_id = p_user_id
    and payment_confirmed_at is null
    and status in ('inquiry','consulting','estimating','quoted')
  for update;
  if not found then raise exception 'invalid_quote_state'; end if;

  update public.natori_quotes
  set superseded_at = coalesce(superseded_at, now())
  where project_id = p_project_id and superseded_at is null;

  select coalesce(max(version), 0) + 1 into v_version
  from public.natori_quotes where project_id = p_project_id;

  insert into public.natori_quotes (
    project_id, user_id, version, title, client_name, to_email, amount,
    subject, body_snapshot, token_hash, expires_at
  ) values (
    p_project_id, p_user_id, v_version, p_title, p_client_name, p_to_email,
    p_amount, p_subject, p_body_snapshot, p_token_hash, p_expires_at
  ) returning id into v_quote_id;

  update public.natori_projects
  set active_quote_id = v_quote_id,
      client_email = p_to_email,
      amount = p_amount,
      quote_accept_token_hash = p_token_hash,
      quote_token_expires_at = p_expires_at,
      quote_accepted_at = null,
      quote_accepted_amount = null
  where id = p_project_id and user_id = p_user_id;

  return v_quote_id;
end;
$$;

revoke all on function public.natori_issue_quote(uuid, uuid, text, text, text, integer, text, text, text, timestamptz) from public;
grant execute on function public.natori_issue_quote(uuid, uuid, text, text, text, integer, text, text, text, timestamptz) to service_role;

create or replace function public.natori_accept_quote(p_token_hash text)
returns table(result text, quote_id uuid, project_id uuid, accepted_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.natori_quotes%rowtype;
  v_now timestamptz := now();
begin
  select * into v_quote
  from public.natori_quotes
  where token_hash = p_token_hash
  for update;

  if not found then
    return query select 'not-found'::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;
  if v_quote.superseded_at is not null then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, v_quote.accepted_at;
    return;
  end if;
  if v_quote.accepted_at is not null then
    return query select 'already-accepted'::text, v_quote.id, v_quote.project_id, v_quote.accepted_at;
    return;
  end if;
  if v_quote.expires_at < v_now then
    return query select 'expired'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  -- active_quote_id を同じトランザクションでロックしてから承諾する。別版の発行と
  -- 競合した場合、quote 側だけ accepted になる半端な状態を残さない。
  perform 1 from public.natori_projects
  where id = v_quote.project_id and active_quote_id = v_quote.id
  for update;
  if not found then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  update public.natori_quotes set accepted_at = v_now where id = v_quote.id;
  update public.natori_projects
  set quote_accepted_at = v_now,
      quote_accepted_amount = v_quote.amount,
      amount = v_quote.amount,
      next_action = '見積もり承諾済み・支払い依頼を送る',
      note = concat_ws(
        E'\n\n',
        nullif(note, ''),
        '【見積もり承諾 ' || to_char(v_now at time zone 'Asia/Tokyo', 'YYYY-MM-DD') ||
        '】' || to_char(v_quote.amount, 'FM999,999,999') || '円（承諾ページより）'
      )
  where id = v_quote.project_id and active_quote_id = v_quote.id;

  if not found then
    return query select 'superseded'::text, v_quote.id, v_quote.project_id, null::timestamptz;
    return;
  end if;

  return query select 'ok'::text, v_quote.id, v_quote.project_id, v_now;
end;
$$;

revoke all on function public.natori_accept_quote(text) from public;
grant execute on function public.natori_accept_quote(text) to service_role;

/* --------------------------------------------------------------------------
   Legacy quote-token backfill
---------------------------------------------------------------------------- */

insert into public.natori_quotes (
  project_id, user_id, version, title, client_name, to_email, amount, subject,
  body_snapshot, token_hash, expires_at, accepted_at, created_at
)
select
  p.id,
  p.user_id,
  1,
  p.title,
  p.client_name,
  coalesce(p.client_email, ''),
  coalesce(p.quote_accepted_amount, p.quoted_amount, p.amount),
  'Legacy quote',
  'Migrated from natori_projects',
  p.quote_accept_token_hash,
  coalesce(p.quote_token_expires_at, now()),
  p.quote_accepted_at,
  coalesce(p.updated_at, p.created_at, now())
from public.natori_projects p
where p.quote_accept_token_hash is not null
  and not exists (
    select 1 from public.natori_quotes q where q.token_hash = p.quote_accept_token_hash
  );

update public.natori_projects p
set active_quote_id = q.id
from public.natori_quotes q
where q.project_id = p.id
  and q.token_hash = p.quote_accept_token_hash
  and p.active_quote_id is null;

update public.natori_projects
set paid_at = payment_confirmed_at,
    paid_amount = coalesce(quoted_amount, amount)
where payment_confirmed_at is not null
  and paid_at is null;

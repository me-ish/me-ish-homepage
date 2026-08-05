-- Etorie P1-10: append-only project lifecycle activity ledger.
-- Human-authored internal notes remain on natori_projects.note.
-- This migration does not backfill or parse historical note text.

begin;

create table public.natori_project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source_type text not null,
  source_id text not null,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint natori_project_activity_event_type_check check (
    event_type in (
      'quote_issued',
      'mail_sent',
      'payment_recorded',
      'delivery_sent',
      'delivery_accepted'
    )
  ),
  constraint natori_project_activity_source_type_check check (
    source_type in ('quote', 'order_mail', 'payment_transaction', 'project')
  ),
  constraint natori_project_activity_source_id_check check (
    char_length(source_id) between 1 and 200
  ),
  constraint natori_project_activity_dedupe_key_check check (
    dedupe_key is null
    or (
      char_length(dedupe_key) between 8 and 240
      and dedupe_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,239}$'
    )
  ),
  constraint natori_project_activity_payload_object_check check (
    jsonb_typeof(payload) = 'object'
    and octet_length(convert_to(payload::text, 'UTF8')) <= 8192
  )
);

comment on table public.natori_project_activity is
  'Append-only machine lifecycle ledger for Etorie/Natori projects. Human notes remain in natori_projects.note; no historical note backfill.';
comment on column public.natori_project_activity.source_id is
  'Text form of the dedicated ledger row identifier (UUID or bigint). Never stores tokens, signed URLs, mail bodies, or raw PII.';
comment on column public.natori_project_activity.payload is
  'Small non-sensitive display metadata only. Dedicated quote/payment/mail/file rows remain the source of truth.';

create unique index natori_project_activity_project_dedupe_key_key
  on public.natori_project_activity(project_id, dedupe_key)
  where dedupe_key is not null;

create index natori_project_activity_project_occurred_at_idx
  on public.natori_project_activity(project_id, occurred_at desc, id desc);

create index natori_project_activity_user_occurred_at_idx
  on public.natori_project_activity(user_id, occurred_at desc, id desc);

alter table public.natori_project_activity enable row level security;
revoke all on table public.natori_project_activity from public, anon, authenticated;
grant select, insert on table public.natori_project_activity to service_role;

create function public.guard_natori_project_activity_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'project_activity_append_only';
end;
$$;

revoke all on function public.guard_natori_project_activity_append_only()
  from public, anon, authenticated;

create trigger trg_natori_project_activity_append_only
  before update or delete on public.natori_project_activity
  for each row execute function public.guard_natori_project_activity_append_only();

create function public.record_natori_quote_issued_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.natori_project_activity (
    project_id,
    user_id,
    event_type,
    source_type,
    source_id,
    dedupe_key,
    payload,
    occurred_at
  ) values (
    new.project_id,
    new.user_id,
    'quote_issued',
    'quote',
    new.id::text,
    'quote_issued:' || new.id::text,
    jsonb_build_object('version', new.version),
    coalesce(new.issued_at, new.created_at, now())
  )
  on conflict (project_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

revoke all on function public.record_natori_quote_issued_activity()
  from public, anon, authenticated;

create trigger trg_natori_quotes_record_activity
  after insert on public.natori_quotes
  for each row execute function public.record_natori_quote_issued_activity();

create function public.record_natori_mail_sent_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    insert into public.natori_project_activity (
      project_id,
      user_id,
      event_type,
      source_type,
      source_id,
      dedupe_key,
      payload,
      occurred_at
    )
    select
      new.project_id,
      p.user_id,
      'mail_sent',
      'order_mail',
      new.id::text,
      'mail_sent:' || new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'kind', new.kind,
        'quoteId', new.quote_id
      )),
      coalesce(new.sent_at, new.updated_at, new.created_at, now())
    from public.natori_projects p
    where p.id = new.project_id
    on conflict (project_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.record_natori_mail_sent_activity()
  from public, anon, authenticated;

create trigger trg_natori_order_mail_logs_record_activity
  after insert or update of status on public.natori_order_mail_logs
  for each row execute function public.record_natori_mail_sent_activity();

create function public.record_natori_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.natori_project_activity (
    project_id,
    user_id,
    event_type,
    source_type,
    source_id,
    dedupe_key,
    payload,
    occurred_at
  )
  select
    new.project_id,
    p.user_id,
    'payment_recorded',
    'payment_transaction',
    new.id::text,
    'payment_recorded:' || new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'status', new.status,
      'quoteId', new.quote_id
    )),
    coalesce(new.received_at, now())
  from public.natori_projects p
  where p.id = new.project_id
  on conflict (project_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

revoke all on function public.record_natori_payment_activity()
  from public, anon, authenticated;

create trigger trg_natori_payment_transactions_record_activity
  after insert on public.natori_payment_transactions
  for each row execute function public.record_natori_payment_activity();

create function public.record_natori_delivery_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivered_mail_at is not null and old.delivered_mail_at is null then
    insert into public.natori_project_activity (
      project_id, user_id, event_type, source_type, source_id,
      dedupe_key, payload, occurred_at
    ) values (
      new.id, new.user_id, 'delivery_sent', 'project', new.id::text,
      'delivery_sent:' || new.id::text,
      '{}'::jsonb, new.delivered_mail_at
    )
    on conflict (project_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  if new.delivery_accepted_at is not null and old.delivery_accepted_at is null then
    insert into public.natori_project_activity (
      project_id, user_id, event_type, source_type, source_id,
      dedupe_key, payload, occurred_at
    ) values (
      new.id, new.user_id, 'delivery_accepted', 'project', new.id::text,
      'delivery_accepted:' || new.id::text,
      '{}'::jsonb, new.delivery_accepted_at
    )
    on conflict (project_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.record_natori_delivery_activity()
  from public, anon, authenticated;

create trigger trg_natori_projects_record_delivery_activity
  after update of delivered_mail_at, delivery_accepted_at on public.natori_projects
  for each row execute function public.record_natori_delivery_activity();

commit;

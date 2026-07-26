-- Etorie/Natori schema-only baseline.
--
-- This is the active migration-history starting point for the approved hybrid
-- strategy. It intentionally contains no production rows, auth users, legacy
-- backfills, secrets, signed URLs, or migration-history writes.
--
-- IMPORTANT: this baseline is not releaseable by itself. Apply
-- 20260723111741_baseline_security_hardening.sql immediately afterwards.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

/* --------------------------------------------------------------------------
   Core case-management tables
---------------------------------------------------------------------------- */

create table public.natori_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  client_name text not null,
  client_email text,
  amount integer not null default 0
    constraint natori_projects_amount_check check (amount >= 0),
  type text not null
    constraint natori_projects_type_check
    check (type in ('icon', 'sd', 'standing', 'illustration')),
  status text not null default 'inquiry'
    constraint natori_projects_status_check
    check (status in (
      'inquiry', 'estimating', 'consulting', 'quoted', 'awaiting_payment',
      'rough', 'lineart', 'coloring', 'waiting', 'delivery_prep',
      'delivered', 'completed', 'closed'
    )),
  delivery_plan text not null default 'normal'
    constraint natori_projects_delivery_plan_check
    check (delivery_plan in ('normal', 'rush_14_days', 'rush_7_days')),
  priority text
    constraint natori_projects_priority_check
    check (priority in ('low', 'normal', 'high')),
  start_date date,
  due_date date not null,
  next_action text not null default '',
  note text,
  payment_confirmed_at timestamptz,
  payment_link_id text,
  quoted_amount integer,
  quote_accept_token_hash text,
  quote_token_expires_at timestamptz,
  quote_accepted_at timestamptz,
  quote_accepted_amount integer,
  delivery_token_hash text,
  delivery_token_expires_at timestamptz,
  delivered_mail_at timestamptz,
  delivery_accepted_at timestamptz,
  active_quote_id uuid,
  payment_quote_id uuid,
  payment_link_url text,
  payment_link_status text
    constraint natori_projects_payment_link_status_check
    check (
      payment_link_status is null
      or payment_link_status in ('issuing', 'ready', 'sent', 'send_failed', 'paid', 'void')
    ),
  paid_amount integer
    constraint natori_projects_paid_amount_check
    check (paid_amount is null or paid_amount >= 0),
  stripe_payment_session_id text,
  paid_at timestamptz,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.natori_projects is
  'Etorie/Natori case-management projects; deleted_at implements restorable archive state.';
comment on column public.natori_projects.deleted_at is
  'Soft-delete timestamp. Null rows are active; non-null rows remain restorable.';
comment on column public.natori_projects.quote_accept_token_hash is
  'SHA-256 hash only; the plaintext quote token is never stored.';
comment on column public.natori_projects.delivery_token_hash is
  'SHA-256 hash only; the plaintext delivery token is never stored.';

create table public.natori_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  task_key text not null,
  label text not null,
  stage text not null
    constraint natori_project_tasks_stage_check
    check (stage in ('material', 'rough', 'lineart', 'coloring', 'finish', 'delivery')),
  estimated_hours numeric(5,2),
  done boolean not null default false,
  sort_order integer not null default 0,
  constraint natori_project_tasks_project_id_task_key_key unique (project_id, task_key)
);

comment on table public.natori_project_tasks is
  'Per-project production steps. Template rows belong in verification fixtures, not this baseline.';

create table public.natori_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.natori_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  portfolio_url text,
  links_url text,
  daily_capacity_hours numeric(4,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.natori_pricing_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_key text not null,
  name text not null,
  config jsonb not null,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint natori_pricing_configs_user_id_preset_key_key unique (user_id, preset_key)
);

create table public.natori_portfolio_content (
  id text primary key default 'main',
  content jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.natori_portfolio_content is
  'Server-managed content for the public Natori portfolio page.';

create table public.natori_links_content (
  id text primary key default 'main',
  content jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.natori_links_content is
  'Server-managed content for the public Natori links page.';

create table public.natori_page_events (
  id bigint generated always as identity primary key,
  event text not null,
  label text not null default '',
  path text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.natori_page_events is
  'Server-only aggregate event input; no browser Data API access.';

/* --------------------------------------------------------------------------
   Quote, payment, mail, and file ledgers
---------------------------------------------------------------------------- */

create table public.natori_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null
    constraint natori_quotes_version_check check (version > 0),
  title text not null,
  client_name text not null,
  to_email text not null,
  amount integer not null
    constraint natori_quotes_amount_check check (amount >= 0),
  subject text not null,
  body_snapshot text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint natori_quotes_project_id_version_key unique (project_id, version)
);

alter table public.natori_projects
  add constraint natori_projects_active_quote_id_fkey
    foreign key (active_quote_id) references public.natori_quotes(id) on delete set null,
  add constraint natori_projects_payment_quote_id_fkey
    foreign key (payment_quote_id) references public.natori_quotes(id) on delete set null;

create table public.natori_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  quote_id uuid references public.natori_quotes(id) on delete set null,
  stripe_session_id text unique,
  amount integer not null
    constraint natori_payment_transactions_amount_check check (amount >= 0),
  status text not null
    constraint natori_payment_transactions_status_check
    check (status in (
      'received', 'amount_mismatch', 'quote_mismatch', 'duplicate_payment', 'manual'
    )),
  received_at timestamptz not null default now(),
  note text
);

create table public.natori_order_mail_logs (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  kind text not null,
  to_email text not null,
  amount integer not null,
  link_url text,
  sent_at timestamptz,
  request_id uuid not null,
  status text not null
    constraint natori_order_mail_logs_status_check
    check (status in ('pending', 'sent', 'failed', 'state_error')),
  subject text not null,
  body_snapshot text not null,
  quote_id uuid references public.natori_quotes(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.natori_inquiry_reference_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

comment on column public.natori_inquiry_reference_files.storage_path is
  'natori-inquiry-refs/{projectId}/{uuid}.{ext}; file bytes are not stored in this baseline.';

create table public.natori_delivery_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  folder text not null
    constraint natori_delivery_files_folder_check check (folder in ('rough', 'final')),
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.natori_delivery_files.storage_path is
  'natori-deliveries/{projectId}/{rough|final}/{uuid}.{ext}; downloads use signed URLs.';

create table public.processed_stripe_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

comment on table public.processed_stripe_events is
  'Server-only Stripe webhook idempotency claims keyed by event_id.';

/* --------------------------------------------------------------------------
   Indexes
---------------------------------------------------------------------------- */

create index natori_projects_user_idx
  on public.natori_projects(user_id);
create index natori_projects_user_due_idx
  on public.natori_projects(user_id, due_date);
create index natori_projects_active_owner_due_idx
  on public.natori_projects(user_id, due_date)
  where deleted_at is null;
create index natori_projects_deleted_owner_idx
  on public.natori_projects(user_id, deleted_at desc)
  where deleted_at is not null;
create index idx_natori_projects_quote_token
  on public.natori_projects(quote_accept_token_hash)
  where quote_accept_token_hash is not null;
create index idx_natori_projects_delivery_token
  on public.natori_projects(delivery_token_hash)
  where delivery_token_hash is not null;
create index natori_projects_active_quote_id_idx
  on public.natori_projects(active_quote_id);
create index natori_projects_payment_quote_id_idx
  on public.natori_projects(payment_quote_id);

create index natori_project_tasks_project_idx
  on public.natori_project_tasks(project_id);
create index natori_events_user_idx
  on public.natori_events(user_id);
create index natori_events_user_date_idx
  on public.natori_events(user_id, date);
create index natori_pricing_configs_user_idx
  on public.natori_pricing_configs(user_id);
create index natori_pricing_configs_user_sort_idx
  on public.natori_pricing_configs(user_id, sort_order);
create index idx_natori_page_events_created_at
  on public.natori_page_events(created_at desc);
create index idx_natori_page_events_event
  on public.natori_page_events(event, created_at desc);
create index idx_natori_quotes_project_created
  on public.natori_quotes(project_id, created_at desc);
create index idx_natori_quotes_user
  on public.natori_quotes(user_id);
create index idx_natori_payment_transactions_project
  on public.natori_payment_transactions(project_id, received_at desc);
create index natori_payment_transactions_quote_id_idx
  on public.natori_payment_transactions(quote_id);
create index idx_natori_order_mail_logs_project
  on public.natori_order_mail_logs(project_id, sent_at desc);
create unique index idx_natori_order_mail_logs_request
  on public.natori_order_mail_logs(request_id);
create index natori_order_mail_logs_quote_id_idx
  on public.natori_order_mail_logs(quote_id);
create index idx_natori_inquiry_reference_project
  on public.natori_inquiry_reference_files(project_id, created_at);
create index idx_natori_delivery_files_project
  on public.natori_delivery_files(project_id, folder);
create index idx_processed_stripe_events_received_at
  on public.processed_stripe_events(received_at);

/* --------------------------------------------------------------------------
   updated_at trigger functions
---------------------------------------------------------------------------- */

create function public.touch_natori_projects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.touch_natori_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.touch_natori_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.touch_natori_pricing_configs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.touch_natori_portfolio_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.touch_natori_links_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_natori_projects_touch
  before update on public.natori_projects
  for each row execute function public.touch_natori_projects_updated_at();
create trigger trg_natori_events_touch
  before update on public.natori_events
  for each row execute function public.touch_natori_events_updated_at();
create trigger trg_natori_user_profiles_touch
  before update on public.natori_user_profiles
  for each row execute function public.touch_natori_user_profiles_updated_at();
create trigger trg_natori_pricing_configs_touch
  before update on public.natori_pricing_configs
  for each row execute function public.touch_natori_pricing_configs_updated_at();
create trigger trg_natori_portfolio_content_touch
  before update on public.natori_portfolio_content
  for each row execute function public.touch_natori_portfolio_content_updated_at();
create trigger trg_natori_links_content_touch
  before update on public.natori_links_content
  for each row execute function public.touch_natori_links_content_updated_at();

-- Trigger functions are not callable application APIs.
revoke all on function public.touch_natori_projects_updated_at() from public, anon, authenticated;
revoke all on function public.touch_natori_events_updated_at() from public, anon, authenticated;
revoke all on function public.touch_natori_user_profiles_updated_at() from public, anon, authenticated;
revoke all on function public.touch_natori_pricing_configs_updated_at() from public, anon, authenticated;
revoke all on function public.touch_natori_portfolio_content_updated_at() from public, anon, authenticated;
revoke all on function public.touch_natori_links_content_updated_at() from public, anon, authenticated;

/* --------------------------------------------------------------------------
   RLS and current target policies
---------------------------------------------------------------------------- */

alter table public.natori_projects enable row level security;
alter table public.natori_project_tasks enable row level security;
alter table public.natori_events enable row level security;
alter table public.natori_user_profiles enable row level security;
alter table public.natori_pricing_configs enable row level security;
alter table public.natori_portfolio_content enable row level security;
alter table public.natori_links_content enable row level security;
alter table public.natori_page_events enable row level security;
alter table public.natori_quotes enable row level security;
alter table public.natori_payment_transactions enable row level security;
alter table public.natori_order_mail_logs enable row level security;
alter table public.natori_inquiry_reference_files enable row level security;
alter table public.natori_delivery_files enable row level security;
alter table public.processed_stripe_events enable row level security;

create policy natori_projects_own_select on public.natori_projects
  for select to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);
create policy natori_projects_own_insert on public.natori_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy natori_projects_own_update on public.natori_projects
  for update to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null)
  with check ((select auth.uid()) = user_id);
create policy natori_projects_own_delete on public.natori_projects
  for delete to authenticated
  using ((select auth.uid()) = user_id and deleted_at is null);

create policy natori_tasks_own_select on public.natori_project_tasks
  for select to authenticated
  using (exists (
    select 1
    from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_insert on public.natori_project_tasks
  for insert to authenticated
  with check (exists (
    select 1
    from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_update on public.natori_project_tasks
  for update to authenticated
  using (exists (
    select 1
    from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ))
  with check (exists (
    select 1
    from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));
create policy natori_tasks_own_delete on public.natori_project_tasks
  for delete to authenticated
  using (exists (
    select 1
    from public.natori_projects p
    where p.id = natori_project_tasks.project_id
      and p.user_id = (select auth.uid())
      and p.deleted_at is null
  ));

create policy natori_events_own_select on public.natori_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_events_own_insert on public.natori_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_events_own_update on public.natori_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_events_own_delete on public.natori_events
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy natori_user_profiles_own_select on public.natori_user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_insert on public.natori_user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_update on public.natori_user_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_user_profiles_own_delete on public.natori_user_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy natori_pricing_configs_own_select on public.natori_pricing_configs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_insert on public.natori_pricing_configs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_update on public.natori_pricing_configs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy natori_pricing_configs_own_delete on public.natori_pricing_configs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy natori_portfolio_content_public_read on public.natori_portfolio_content
  for select to anon, authenticated using (true);
create policy natori_links_content_public_read on public.natori_links_content
  for select to anon, authenticated using (true);

create policy natori_service_only on public.natori_delivery_files
  for all to anon, authenticated using (false) with check (false);
create policy natori_service_only on public.natori_inquiry_reference_files
  for all to anon, authenticated using (false) with check (false);
create policy natori_service_only on public.natori_order_mail_logs
  for all to anon, authenticated using (false) with check (false);
create policy natori_service_only on public.natori_page_events
  for all to anon, authenticated using (false) with check (false);
create policy natori_service_only on public.natori_payment_transactions
  for all to anon, authenticated using (false) with check (false);
create policy natori_service_only on public.natori_quotes
  for all to anon, authenticated using (false) with check (false);

-- processed_stripe_events deliberately has no client policy. Its final table
-- privileges are repeated in the immediately-following hardening migration.

/* --------------------------------------------------------------------------
   Server-only RPC contract
---------------------------------------------------------------------------- */

create function public.natori_create_project_with_tasks(
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

-- The baseline preserves the current callable contract. The immediately
-- following hardening migration replaces this implementation with soft delete.
create function public.natori_delete_project(
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

create function public.natori_update_task_and_status(
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

create function public.natori_confirm_manual_payment(
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

create function public.natori_record_stripe_payment(
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

create function public.natori_issue_quote(
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

create function public.natori_accept_quote(p_token_hash text)
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

-- SECURITY DEFINER functions are server APIs only. PostgreSQL grants EXECUTE
-- to PUBLIC by default, so every identity is explicitly closed before the
-- service_role grant is added.
revoke all on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.natori_delete_project(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.natori_confirm_manual_payment(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.natori_record_stripe_payment(uuid, text, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.natori_issue_quote(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.natori_accept_quote(text)
  from public, anon, authenticated;

grant execute on function public.natori_create_project_with_tasks(uuid, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.natori_delete_project(uuid, uuid)
  to service_role;
grant execute on function public.natori_update_task_and_status(uuid, uuid, text, boolean, text, text)
  to service_role;
grant execute on function public.natori_confirm_manual_payment(uuid, uuid, text)
  to service_role;
grant execute on function public.natori_record_stripe_payment(uuid, text, integer, uuid)
  to service_role;
grant execute on function public.natori_issue_quote(
  uuid, uuid, text, text, text, integer, text, text, text, timestamptz
) to service_role;
grant execute on function public.natori_accept_quote(text)
  to service_role;

-- The application accesses all Natori base tables through authenticated
-- server routes using service_role. Owner policies remain defense in depth.
revoke all privileges on table
  public.natori_delivery_files,
  public.natori_events,
  public.natori_inquiry_reference_files,
  public.natori_links_content,
  public.natori_order_mail_logs,
  public.natori_page_events,
  public.natori_payment_transactions,
  public.natori_portfolio_content,
  public.natori_pricing_configs,
  public.natori_project_tasks,
  public.natori_projects,
  public.natori_quotes,
  public.natori_user_profiles
from public, anon, authenticated;

grant all privileges on table
  public.natori_delivery_files,
  public.natori_events,
  public.natori_inquiry_reference_files,
  public.natori_links_content,
  public.natori_order_mail_logs,
  public.natori_page_events,
  public.natori_payment_transactions,
  public.natori_portfolio_content,
  public.natori_pricing_configs,
  public.natori_project_tasks,
  public.natori_projects,
  public.natori_quotes,
  public.natori_user_profiles
to service_role;

revoke all privileges on table public.processed_stripe_events
  from public, anon, authenticated;
grant select, insert, delete on table public.processed_stripe_events
  to service_role;

revoke all privileges on sequence public.natori_page_events_id_seq
  from public, anon, authenticated;
revoke all privileges on sequence public.natori_order_mail_logs_id_seq
  from public, anon, authenticated;
grant usage, select on sequence public.natori_page_events_id_seq
  to service_role;
grant usage, select on sequence public.natori_order_mail_logs_id_seq
  to service_role;

/* --------------------------------------------------------------------------
   Storage bucket configuration

   No storage.objects INSERT policy is created here. Natori writes are
   performed by service_role or by a path-scoped signed upload token.
---------------------------------------------------------------------------- */

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'natori-inquiry-refs',
  'natori-inquiry-refs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'natori-deliveries',
  'natori-deliveries',
  false,
  null,
  null
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'natori-portfolio',
  'natori-portfolio',
  true,
  null,
  null
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

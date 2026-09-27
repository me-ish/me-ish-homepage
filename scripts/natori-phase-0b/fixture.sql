-- Minimal disposable fixture only: never a production migration.
do $$ begin
  if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
  if to_regclass('public.natori_projects') is not null then raise exception 'Nonempty target'; end if;
end $$;
create table public.natori_page_events (id uuid primary key default gen_random_uuid(), event text, label text, path text, created_at timestamptz default now());
create table public.admin_emails (email text primary key);
create table public.natori_projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
  title text, client_name text, client_email text, amount integer, type text, status text,
  delivery_plan text, priority text, start_date date, due_date date, next_action text, note text,
  payment_confirmed_at timestamptz, paid_at timestamptz, paid_amount integer, completed_at timestamptz,
  deleted_at timestamptz, created_at timestamptz default now(), request_data jsonb, agreed_terms jsonb
);
create table public.natori_project_tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.natori_projects,
  task_key text, label text, stage text, estimated_hours numeric, done boolean, sort_order integer
);
create table public.natori_inquiry_reference_files (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.natori_projects,
  storage_path text, created_at timestamptz default now()
);
create table public.natori_project_reference_links (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.natori_projects,
  url text, normalized_url text, label text, provider text, sort_order integer, created_at timestamptz default now()
);
create table public.natori_payment_transactions (
  id uuid primary key default gen_random_uuid(), project_id uuid references public.natori_projects,
  amount integer, status text, received_at timestamptz, note text
);
create table public.natori_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
  title text, date date, note text
);
create table public.natori_user_profiles (
  user_id uuid primary key references auth.users, handle text, display_name text,
  portfolio_url text, links_url text, daily_capacity_hours numeric
);
create table public.natori_pricing_configs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
  preset_key text, name text, config jsonb, is_default boolean, sort_order integer,
  unique(user_id,preset_key)
);
-- This fixture verifies server authorization using service-role queries. It makes
-- no claim about historical application RLS; all direct anon/user table access is denied.
do $$ declare t text; begin
  foreach t in array array['natori_page_events','admin_emails','natori_projects','natori_project_tasks','natori_inquiry_reference_files','natori_project_reference_links','natori_payment_transactions','natori_events','natori_user_profiles','natori_pricing_configs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

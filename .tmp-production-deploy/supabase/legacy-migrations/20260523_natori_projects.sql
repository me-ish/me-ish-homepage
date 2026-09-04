-- Natori case-management tables (projects + tasks) with row-level security.
-- Each user only sees their own rows.

create table if not exists public.natori_projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  client_name     text not null,
  amount          integer not null default 0 check (amount >= 0),
  type            text not null check (type in ('icon','sd','standing','illustration')),
  status          text not null default 'consulting' check (status in (
                    'consulting','quoted','awaiting_payment','rough','lineart',
                    'coloring','waiting','delivery_prep','delivered','completed'
                  )),
  delivery_plan   text not null default 'normal' check (delivery_plan in (
                    'normal','rush_14_days','rush_7_days'
                  )),
  priority        text check (priority in ('low','normal','high')),
  start_date      date,
  due_date        date not null,
  next_action     text not null default '',
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists natori_projects_user_idx on public.natori_projects(user_id);
create index if not exists natori_projects_user_due_idx on public.natori_projects(user_id, due_date);

create table if not exists public.natori_project_tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.natori_projects(id) on delete cascade,
  task_key        text not null,
  label           text not null,
  stage           text not null check (stage in ('material','rough','lineart','coloring','finish','delivery')),
  estimated_hours numeric(5,2),
  done            boolean not null default false,
  sort_order      integer not null default 0,
  unique (project_id, task_key)
);

create index if not exists natori_project_tasks_project_idx on public.natori_project_tasks(project_id);

alter table public.natori_projects        enable row level security;
alter table public.natori_project_tasks   enable row level security;

create policy "natori_projects_own_select" on public.natori_projects
  for select using (auth.uid() = user_id);
create policy "natori_projects_own_insert" on public.natori_projects
  for insert with check (auth.uid() = user_id);
create policy "natori_projects_own_update" on public.natori_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "natori_projects_own_delete" on public.natori_projects
  for delete using (auth.uid() = user_id);

create policy "natori_tasks_own_select" on public.natori_project_tasks
  for select using (exists (
    select 1 from public.natori_projects p where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "natori_tasks_own_insert" on public.natori_project_tasks
  for insert with check (exists (
    select 1 from public.natori_projects p where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "natori_tasks_own_update" on public.natori_project_tasks
  for update using (exists (
    select 1 from public.natori_projects p where p.id = project_id and p.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.natori_projects p where p.id = project_id and p.user_id = auth.uid()
  ));
create policy "natori_tasks_own_delete" on public.natori_project_tasks
  for delete using (exists (
    select 1 from public.natori_projects p where p.id = project_id and p.user_id = auth.uid()
  ));

-- Auto-touch updated_at on update.
create or replace function public.touch_natori_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_projects_touch on public.natori_projects;
create trigger trg_natori_projects_touch
  before update on public.natori_projects
  for each row execute function public.touch_natori_projects_updated_at();

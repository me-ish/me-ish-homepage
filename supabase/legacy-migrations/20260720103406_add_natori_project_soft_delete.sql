alter table public.natori_projects
  add column if not exists deleted_at timestamptz;

create index if not exists natori_projects_active_owner_due_idx
  on public.natori_projects (user_id, due_date)
  where deleted_at is null;

create index if not exists natori_projects_deleted_owner_idx
  on public.natori_projects (user_id, deleted_at desc)
  where deleted_at is not null;

comment on column public.natori_projects.deleted_at is
  'Soft-delete timestamp. Null rows are active; non-null rows remain restorable.';

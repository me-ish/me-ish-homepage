-- Consultation replies belong to an existing inquiry/project. Message bodies are
-- intentionally kept out of the machine activity ledger and project notes.
begin;

create table public.natori_consultation_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  sender text not null check (sender in ('staff', 'client')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);
create index natori_consultation_messages_project_order_idx
  on public.natori_consultation_messages(project_id, created_at, id);

-- Multiple links may exist so an old email remains usable until its own expiry.
-- Only the hash is stored. Each link is sent to the project's client email.
create table public.natori_consultation_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index natori_consultation_access_project_idx
  on public.natori_consultation_access(project_id);

alter table public.natori_consultation_messages enable row level security;
alter table public.natori_consultation_access enable row level security;
revoke all on public.natori_consultation_messages from public, anon, authenticated;
revoke all on public.natori_consultation_access from public, anon, authenticated;
grant select, insert, update on public.natori_consultation_messages to service_role;
grant select, insert on public.natori_consultation_access to service_role;

commit;

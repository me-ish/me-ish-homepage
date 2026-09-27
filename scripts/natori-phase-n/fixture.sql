-- All data is synthetic. Must follow the Phase T/0B dedicated nonempty-target guard.
do $$ begin
  if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
alter table public.natori_projects add column active_quote_id uuid,
  add column quote_accepted_at timestamptz,add column quote_accepted_amount integer,
  add column delivery_token_hash text unique,add column delivery_token_expires_at timestamptz,
  add column delivery_accepted_at timestamptz,add column delivered_mail_at timestamptz,
  add column updated_at timestamptz default now();
create table public.natori_quotes (
  id uuid primary key default gen_random_uuid(),project_id uuid not null references public.natori_projects,
  user_id uuid not null references auth.users,version integer not null default 1,
  title text not null,client_name text not null,to_email text not null,amount integer not null,
  subject text not null,body_snapshot text not null,token_hash text not null unique,
  expires_at timestamptz not null,accepted_at timestamptz,superseded_at timestamptz,
  quote_terms jsonb,pricing_snapshot jsonb,created_at timestamptz default now(),unique(project_id,version)
);
alter table public.natori_projects add foreign key(active_quote_id) references public.natori_quotes;
alter table public.natori_quotes enable row level security;
revoke all on public.natori_quotes from public,anon,authenticated;
grant all on public.natori_quotes to service_role;
create table public.natori_delivery_files (
  id uuid primary key default gen_random_uuid(),project_id uuid references public.natori_projects,
  folder text,storage_path text,file_name text,size_bytes bigint,created_at timestamptz default now()
);
alter table public.natori_delivery_files enable row level security;
revoke all on public.natori_delivery_files from public,anon,authenticated;
grant all on public.natori_delivery_files to service_role;

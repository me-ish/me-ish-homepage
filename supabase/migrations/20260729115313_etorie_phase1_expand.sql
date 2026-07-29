-- Etorie Phase 1 additive schema expansion.
--
-- This migration changes schema metadata only. It does not update or backfill
-- existing rows, and it does not enable any Phase 1 writer.

begin;

alter table public.natori_projects
  add column request_data jsonb,
  alter column amount drop not null,
  alter column amount drop default,
  alter column due_date drop not null,
  alter column due_date drop default;

alter table public.natori_quotes
  add column request_snapshot jsonb,
  add column pricing_snapshot jsonb;

create table public.natori_project_reference_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  url text not null,
  normalized_url text not null,
  label text,
  provider text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint natori_project_reference_links_project_id_fkey
    foreign key (project_id)
    references public.natori_projects(id)
    on delete cascade
);

create function public.touch_natori_project_reference_links_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_natori_project_reference_links_touch
  before update on public.natori_project_reference_links
  for each row
  execute function public.touch_natori_project_reference_links_updated_at();

revoke all on function
  public.touch_natori_project_reference_links_updated_at()
from public, anon, authenticated;

alter table public.natori_project_reference_links enable row level security;

create policy natori_service_only
on public.natori_project_reference_links
for all
to anon, authenticated
using (false)
with check (false);

revoke all privileges on table public.natori_project_reference_links
from public, anon, authenticated;

grant select, insert, update, delete
on table public.natori_project_reference_links
to service_role;

comment on column public.natori_projects.request_data is
  'Versioned structured requester input captured at intake; NULL means legacy or unset.';
comment on column public.natori_projects.amount is
  'Current administrative amount in JPY; NULL means undecided and legacy zero does not mean undecided.';
comment on column public.natori_projects.due_date is
  'Administrator-confirmed due date; NULL means undecided.';
comment on column public.natori_projects.type is
  'Administrative project type; undecided means not yet confirmed by an administrator.';

comment on column public.natori_quotes.request_snapshot is
  'Immutable request_data snapshot captured when the quote is issued; NULL is valid for legacy quotes.';
comment on column public.natori_quotes.pricing_snapshot is
  'Immutable pricing snapshot captured when the quote is issued; NULL is valid for legacy quotes.';

comment on table public.natori_project_reference_links is
  'Server-managed external reference links associated with an Etorie/Natori project.';
comment on column public.natori_project_reference_links.normalized_url is
  'Server-normalized URL used only for stable duplicate detection within a project.';
comment on column public.natori_project_reference_links.provider is
  'Optional display-only provider hint; never used for authorization.';

commit;

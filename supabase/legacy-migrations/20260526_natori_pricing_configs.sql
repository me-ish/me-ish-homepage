-- Per-user pricing presets for the Natori estimate form.
-- Each user can have multiple presets (e.g. デフォルト / つなぐ用 / VGen用)
-- and switch between them in the UI.

create table if not exists public.natori_pricing_configs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  preset_key  text not null,
  name        text not null,
  config      jsonb not null,
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, preset_key)
);

create index if not exists natori_pricing_configs_user_idx
  on public.natori_pricing_configs(user_id);
create index if not exists natori_pricing_configs_user_sort_idx
  on public.natori_pricing_configs(user_id, sort_order);

alter table public.natori_pricing_configs enable row level security;

create policy "natori_pricing_configs_own_select" on public.natori_pricing_configs
  for select using (auth.uid() = user_id);
create policy "natori_pricing_configs_own_insert" on public.natori_pricing_configs
  for insert with check (auth.uid() = user_id);
create policy "natori_pricing_configs_own_update" on public.natori_pricing_configs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "natori_pricing_configs_own_delete" on public.natori_pricing_configs
  for delete using (auth.uid() = user_id);

create or replace function public.touch_natori_pricing_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_pricing_configs_touch on public.natori_pricing_configs;
create trigger trg_natori_pricing_configs_touch
  before update on public.natori_pricing_configs
  for each row execute function public.touch_natori_pricing_configs_updated_at();

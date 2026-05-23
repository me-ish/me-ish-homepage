-- Per-user dashboard profile so the Natori-style dashboard can host
-- multiple illustrators down the road. Each row keys off the auth user.

create table if not exists public.natori_user_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  handle               text unique,
  display_name         text,
  portfolio_url        text,
  links_url            text,
  daily_capacity_hours numeric(4,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.natori_user_profiles enable row level security;

create policy "natori_user_profiles_own_select" on public.natori_user_profiles
  for select using (auth.uid() = user_id);
create policy "natori_user_profiles_own_insert" on public.natori_user_profiles
  for insert with check (auth.uid() = user_id);
create policy "natori_user_profiles_own_update" on public.natori_user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "natori_user_profiles_own_delete" on public.natori_user_profiles
  for delete using (auth.uid() = user_id);

create or replace function public.touch_natori_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_user_profiles_touch on public.natori_user_profiles;
create trigger trg_natori_user_profiles_touch
  before update on public.natori_user_profiles
  for each row execute function public.touch_natori_user_profiles_updated_at();

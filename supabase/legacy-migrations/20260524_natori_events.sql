-- Natori personal calendar events (separate from project bars).

create table if not exists public.natori_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  date        date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists natori_events_user_idx on public.natori_events(user_id);
create index if not exists natori_events_user_date_idx on public.natori_events(user_id, date);

alter table public.natori_events enable row level security;

create policy "natori_events_own_select" on public.natori_events
  for select using (auth.uid() = user_id);
create policy "natori_events_own_insert" on public.natori_events
  for insert with check (auth.uid() = user_id);
create policy "natori_events_own_update" on public.natori_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "natori_events_own_delete" on public.natori_events
  for delete using (auth.uid() = user_id);

create or replace function public.touch_natori_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_events_touch on public.natori_events;
create trigger trg_natori_events_touch
  before update on public.natori_events
  for each row execute function public.touch_natori_events_updated_at();

alter table public.entries
  add column if not exists end_notified_at timestamptz;

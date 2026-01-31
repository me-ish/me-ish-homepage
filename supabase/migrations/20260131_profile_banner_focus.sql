-- Add banner focus/zoom fields to profiles for adjustable banner display.
alter table public.profiles
  add column if not exists banner_focus_x real,
  add column if not exists banner_focus_y real,
  add column if not exists banner_zoom real;

-- Backfill defaults for existing rows.
update public.profiles
set
  banner_focus_x = coalesce(banner_focus_x, 0.5),
  banner_focus_y = coalesce(banner_focus_y, 0.5),
  banner_zoom = coalesce(banner_zoom, 1)
where banner_focus_x is null
   or banner_focus_y is null
   or banner_zoom is null;

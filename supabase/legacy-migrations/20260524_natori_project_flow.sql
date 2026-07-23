-- Natori production flow alignment (2026-05-24):
--   依頼 → 見積り → 案件化 → 入金待ち → 入金確認 → ラフ → ...
--
-- - Adds `inquiry` and `estimating` to the natori_projects.status enum so the
--   pre-quote phase can be saved without losing fidelity.
-- - Keeps the legacy `consulting` value in the CHECK constraint so existing
--   rows (and the app's back-compat path) keep working.
-- - Changes the table-level default from `consulting` to `inquiry`.
-- - Adds `payment_confirmed_at` so "入金確認してラフ開始" can stamp a timestamp
--   when status moves out of `awaiting_payment`.

alter table public.natori_projects
  drop constraint if exists natori_projects_status_check;

alter table public.natori_projects
  add constraint natori_projects_status_check
  check (status in (
    'inquiry',
    'estimating',
    'consulting',
    'quoted',
    'awaiting_payment',
    'rough',
    'lineart',
    'coloring',
    'waiting',
    'delivery_prep',
    'delivered',
    'completed'
  ));

alter table public.natori_projects
  alter column status set default 'inquiry';

alter table public.natori_projects
  add column if not exists payment_confirmed_at timestamptz;

-- ナトリ公開ページのクリック計測イベント。
-- /natori/links のリンククリック、/natori/portfolio のフォーム送信・SNS/プランクリックを
-- API route (service role) 経由で記録し、ダッシュボードで集計表示する。
-- RLS は有効化のみ（ポリシー無し = 読み書きとも service role 限定）。

create table if not exists public.natori_page_events (
  id         bigint generated always as identity primary key,
  event      text not null,
  label      text not null default '',
  path       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.natori_page_events enable row level security;

create index if not exists idx_natori_page_events_created_at
  on public.natori_page_events (created_at desc);
create index if not exists idx_natori_page_events_event
  on public.natori_page_events (event, created_at desc);

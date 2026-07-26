-- Stripe Webhook のイベント単位 dedup テーブル。
-- 同一 event.id の二重配送（再送・同時配送）を webhook ハンドラ冒頭の
-- insert ... on conflict do nothing で検出し、二重処理を防ぐ。
-- 処理に失敗した event は行を削除して 500 を返し、Stripe の再送に委ねる
-- （src/lib/stripe/processedEvents.ts 参照）。
-- RLS は有効化のみ（ポリシー無し = 読み書きとも service role 限定）。

create table if not exists public.processed_stripe_events (
  event_id    text primary key,
  received_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;

-- 再送ウィンドウ（Stripe は最長 3 日）を過ぎた行は不要。定期削除する場合の索引。
create index if not exists idx_processed_stripe_events_received_at
  on public.processed_stripe_events (received_at);

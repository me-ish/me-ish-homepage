-- note の脱データベース化（タスク3）。
--
-- client_email: 依頼者のメールアドレスをカラム化する。これまで note の
--   「メール: xxx」行を正規表現で抽出しており、note を手編集すると入金導線が
--   壊れる構造だった。inquiry 起票時とメール送信時に保存し、以後はカラムを参照。
--   既存データの移行は supabase/scripts/backfill_natori_client_email.sql
--   （1回きり・手動実行）を参照。
--
-- natori_order_mail_logs: 見積もり / 支払い依頼メールの送信ログ。これまでは
--   note への追記が唯一の記録で、機械的パース（宛先・支払いリンクの抽出）が
--   note に依存していた。以後 note への追記は人間可読の履歴表示用に留める。
-- RLS は有効化のみ（ポリシー無し = 読み書きとも service role 限定）。

alter table public.natori_projects
  add column if not exists client_email text;

create table if not exists public.natori_order_mail_logs (
  id         bigint generated always as identity primary key,
  project_id uuid not null references public.natori_projects (id) on delete cascade,
  kind       text not null,
  to_email   text not null,
  amount     integer not null,
  link_url   text,
  sent_at    timestamptz not null default now()
);

alter table public.natori_order_mail_logs enable row level security;

create index if not exists idx_natori_order_mail_logs_project
  on public.natori_order_mail_logs (project_id, sent_at desc);

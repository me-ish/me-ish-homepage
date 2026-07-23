-- 見積もり承諾フロー（ワンクリック承諾ボタン）。
--
-- 見積もりメール送信時に承諾用のランダムトークンを発行し、そのハッシュと
-- 有効期限（発行から30日 = 見積もり有効期限と連動）を保存する。依頼者が
-- メール内のリンクから承諾ページを開き、ボタンを押すと quote_accepted_at と
-- 承諾時点の金額が記録される。
-- 見積もりを再送（再発行）するとトークンは新しくなり、旧リンクと過去の
-- 承諾記録はリセットされる（支払いリンクの再発行と同じ思想）。
-- トークン本体は保存せず SHA-256 ハッシュのみ保存する。

alter table public.natori_projects
  add column if not exists quote_accept_token_hash text,
  add column if not exists quote_token_expires_at timestamptz,
  add column if not exists quote_accepted_at timestamptz,
  add column if not exists quote_accepted_amount integer;

create index if not exists idx_natori_projects_quote_token
  on public.natori_projects (quote_accept_token_hash)
  where quote_accept_token_hash is not null;

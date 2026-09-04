-- 納品フロー（納品ページ + 受け取り確認 + 納品/ラフ確認ファイル）。
--
-- 納品メール送信時に納品ページ用のランダムトークンを発行し、そのハッシュと
-- 有効期限（発行から30日）を保存する。依頼者はメール内のリンクから納品ページを
-- 開いてファイルをダウンロードし、「受け取りました」ボタンで検収を確定する。
-- 検収が確定すると案件は自動で「対応完了」に進み、実績に積み上がる。
-- 納品メールを再送するとトークンは新しくなり、旧リンクはリセットされる
-- （見積もり承諾トークンと同じ思想）。トークン本体は保存せず SHA-256 ハッシュのみ。

alter table public.natori_projects
  add column if not exists delivery_token_hash text,
  add column if not exists delivery_token_expires_at timestamptz,
  add column if not exists delivered_mail_at timestamptz,
  add column if not exists delivery_accepted_at timestamptz;

create index if not exists idx_natori_projects_delivery_token
  on public.natori_projects (delivery_token_hash)
  where delivery_token_hash is not null;

-- ラフ確認・納品用のファイル台帳。実体は非公開バケット natori-deliveries に置き、
-- ここには元のファイル名とパスだけ持つ（storage のキーは ASCII の uuid にして
-- 日本語ファイル名の互換問題を避ける）。参照はすべて service role + 署名URL 経由。
create table if not exists public.natori_delivery_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.natori_projects(id) on delete cascade,
  -- 'rough' = ラフ確認用（メール本文に署名URLを差し込む） / 'final' = 納品ページ用
  folder      text not null check (folder in ('rough', 'final')),
  -- バケット内のオブジェクトキー（{projectId}/{folder}/{uuid}.{ext}）
  storage_path text not null unique,
  -- 依頼者に見せる元のファイル名
  file_name   text not null,
  size_bytes  bigint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_natori_delivery_files_project
  on public.natori_delivery_files (project_id, folder);

-- RLS: ポリシーを付けない = service role 専用（natori_projects と同じ方針）
alter table public.natori_delivery_files enable row level security;

-- 非公開バケット。ダウンロードは常に署名URL経由（公開URLなし）
insert into storage.buckets (id, name, public)
values ('natori-deliveries', 'natori-deliveries', false)
on conflict (id) do nothing;

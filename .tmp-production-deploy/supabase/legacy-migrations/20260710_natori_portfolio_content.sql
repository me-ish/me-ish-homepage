-- /natori/portfolio (コミッション用ポートフォリオ) の掲載内容をブラウザから
-- 編集できるようにするためのテーブルとストレージバケット。
-- 内容は1行の jsonb に集約し、公開ページは誰でも読める。
-- 書き込みポリシーは作らない（編集は API route 経由の service role のみ）。

create table if not exists public.natori_portfolio_content (
  id         text primary key default 'main',
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.natori_portfolio_content enable row level security;

drop policy if exists "natori_portfolio_content_public_read" on public.natori_portfolio_content;
create policy "natori_portfolio_content_public_read" on public.natori_portfolio_content
  for select using (true);

create or replace function public.touch_natori_portfolio_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_portfolio_content_touch on public.natori_portfolio_content;
create trigger trg_natori_portfolio_content_touch
  before update on public.natori_portfolio_content
  for each row execute function public.touch_natori_portfolio_content_updated_at();

-- 画像アップロード先の公開バケット（アップロードは service role のみ）
insert into storage.buckets (id, name, public)
values ('natori-portfolio', 'natori-portfolio', true)
on conflict (id) do nothing;

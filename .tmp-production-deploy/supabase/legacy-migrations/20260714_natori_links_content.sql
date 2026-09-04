-- /natori/links (リンク集) の掲載リンクをブラウザから編集できるようにする。
-- natori_portfolio_content と同じ構成: 1行の jsonb、公開ページは誰でも読める、
-- 書き込みは API route 経由の service role のみ。

create table if not exists public.natori_links_content (
  id         text primary key default 'main',
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.natori_links_content enable row level security;

drop policy if exists "natori_links_content_public_read" on public.natori_links_content;
create policy "natori_links_content_public_read" on public.natori_links_content
  for select using (true);

create or replace function public.touch_natori_links_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_natori_links_content_touch on public.natori_links_content;
create trigger trg_natori_links_content_touch
  before update on public.natori_links_content
  for each row execute function public.touch_natori_links_content_updated_at();

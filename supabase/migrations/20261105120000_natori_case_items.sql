-- 案件の品目（1つのご依頼の中の1点ずつ）。
--
-- 1つのご依頼（natori_projects の1行）に、①クリスマス等身・②正月等身・③SD の
-- ような品目を持たせる。見積・支払い・納品・受け取りは今まで通り案件に1回ずつで、
-- この表はそれらの守り（PAY-01 / 納品 / 支払いの関数）に一切触れない。
--
-- 品目ごとに持つもの：名前・種類・金額・納期・制作の進み・公開条件と公開してよい日。
-- 公開条件の値は、サイトの依頼フォームの publicationPolicy と同じ。
--
-- 読み書きはサーバー（service_role）だけ。所有者の確認はアプリ側で
-- natori_projects.user_id を見てから行う（参考リンクの表と同じ方式）。
-- 既存の行は書き換えない。品目が無い案件は今まで通りに扱う。

begin;

create table public.natori_case_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  position smallint not null,
  title text not null,
  project_type text,
  amount integer,
  due_date date,
  progress text not null default 'not_started',
  publication_policy text not null default 'unknown',
  publication_allowed_from date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint natori_case_items_project_id_fkey
    foreign key (project_id)
    references public.natori_projects(id)
    on delete cascade,
  constraint natori_case_items_position_check
    check (position between 1 and 20),
  constraint natori_case_items_project_position_key
    unique (project_id, position) deferrable initially immediate,
  constraint natori_case_items_title_check
    check (char_length(btrim(title)) between 1 and 200),
  constraint natori_case_items_project_type_check
    check (project_type is null or project_type in ('icon', 'sd', 'standing', 'illustration')),
  constraint natori_case_items_amount_check
    check (amount is null or amount between 0 and 10000000),
  constraint natori_case_items_progress_check
    check (progress in ('not_started', 'in_progress', 'done')),
  constraint natori_case_items_publication_policy_check
    check (publication_policy in ('allowed', 'delayed', 'work_private', 'fully_private', 'unknown')),
  constraint natori_case_items_publication_date_check
    check ((publication_policy = 'delayed') = (publication_allowed_from is not null)),
  constraint natori_case_items_note_check
    check (note is null or char_length(note) <= 2000)
);

create index natori_case_items_project_id_idx
  on public.natori_case_items (project_id, position);

create function public.touch_natori_case_items_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_natori_case_items_touch
  before update on public.natori_case_items
  for each row
  execute function public.touch_natori_case_items_updated_at();

revoke all on function public.touch_natori_case_items_updated_at()
from public, anon, authenticated;

alter table public.natori_case_items enable row level security;

create policy natori_service_only
on public.natori_case_items
for all
to anon, authenticated
using (false)
with check (false);

revoke all privileges on table public.natori_case_items
from public, anon, authenticated, service_role;

grant select, insert, update, delete
on table public.natori_case_items
to service_role;

comment on table public.natori_case_items is
  '案件の品目（1つのご依頼の中の1点ずつ）。見積・支払い・納品は案件単位のまま。';
comment on column public.natori_case_items.publication_policy is
  'サイトの依頼フォームの publicationPolicy と同じ値。delayed のときだけ publication_allowed_from を持つ。';
comment on column public.natori_case_items.publication_allowed_from is
  'この日より前は、この品目に結ばれた作品をポートフォリオに出さない。';

commit;

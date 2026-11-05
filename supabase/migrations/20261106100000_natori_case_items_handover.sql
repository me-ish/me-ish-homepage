-- 案件の品目に「先にお渡しした日」を持たせる（品目ごとの先渡し＝分納）。
--
-- 仕上がった品目のデータはトークで先にお客さまへ渡し、その日をこの列に記録する。
-- 正式な納品・受け取り確認・完了は今まで通り案件に1回だけで、納品・支払いの表と
-- 守りの関数（natori_delivery_* / PAY-01）には一切触れない。
-- 先渡しは「完成」した品目だけに付けられる（完成でなくなるなら日付を外す）。
-- 既存の行は日付なしのまま（先渡しなし）。

begin;

alter table public.natori_case_items
  add column handed_over_at date;

alter table public.natori_case_items
  add constraint natori_case_items_handover_check
    check (handed_over_at is null or progress = 'done');

comment on column public.natori_case_items.handed_over_at is
  '品目のデータを先にお客さまへ渡した日（分納）。正式な納品は案件単位のまま。完成の品目だけが持てる。';

commit;

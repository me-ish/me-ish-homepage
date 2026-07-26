-- 見送り（closed）ステータスの追加 (2026-07-11):
--   依頼受付〜見積もり提示の段階で金額・条件がまとまらなかった相談を、
--   削除せずにパイプラインから外すための終端ステータス。
--   実績（delivered / completed）には数えられず、案件ボード・カレンダー・
--   優先度リストからも除外される。履歴とメモは残る。

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
    'completed',
    'closed'
  ));

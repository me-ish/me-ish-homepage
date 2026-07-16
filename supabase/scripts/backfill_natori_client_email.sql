-- 【1回きり・手動実行】既存 natori_projects の client_email 移行スクリプト。
-- migrations には置かず、内容を確認・承認のうえ Supabase SQL Editor で実行する。
--
-- note から依頼者メールを抽出して client_email に埋める:
--   1. 自動起票の「メール: xxx」行を優先
--   2. 無ければ送信ログの「宛先: xxx」行のうち最新（最後）のもの
-- 既に client_email が入っている行と、note にメールが見つからない行は触らない。
-- 実行前に件数を確認したい場合は、まず下の SELECT だけを実行する。

-- 事前確認（何件が対象になるか）
-- select count(*) from public.natori_projects
--   where client_email is null and note ~ 'メール:\s*[^\s@]+@[^\s@]+';

begin;

-- 1. 自動起票の「メール: xxx」行
update public.natori_projects
set client_email = (regexp_match(note, 'メール:\s*([^\s@]+@[^\s@]+\.[^\s@]+)'))[1]
where client_email is null
  and note ~ 'メール:\s*[^\s@]+@[^\s@]+\.[^\s@]+';

-- 2. まだ空の行は、送信ログの「宛先: xxx」行の最新（最後）のもの
update public.natori_projects p
set client_email = (
  select t.m[1]
  from regexp_matches(p.note, '宛先:\s*([^\s@/]+@[^\s@/]+\.[^\s@/]+)', 'g')
    with ordinality as t(m, ord)
  order by t.ord desc
  limit 1
)
where p.client_email is null
  and p.note ~ '宛先:\s*[^\s@/]+@[^\s@/]+\.[^\s@/]+';

-- 結果確認
select id, client_name, client_email
from public.natori_projects
order by created_at desc;

commit;

# エトリエ Phase 0 安全なマイグレーション計画

本書は Phase 1 実装時の順序と検証を定める。今回の Phase 0 ではマイグレーションファイルを作成せず、DDL、migration repair、データ更新、Storage 変更を一切実行していない。末尾の SQL はすべて読み取り用 SELECT である。

## 1. 最優先の前提条件

### 1.1 接続先を確定する

調査できた Supabase プロジェクトは、名称とリポジトリから本サービスの本番相当と推定したものである。環境変数を読まずに確認したため、運用担当者が dashboard/project ref と本番ドメインの対応を確認するまで適用作業を開始しない。

### 1.2 migration history を reconcile する

実 DB には 20260720 系までの Natori table/function/constraint/index が概ね存在する一方、Supabase の migration history で確認できたのは5件だけで、ローカルの Natori migration 群が記録されていない。

この状態で通常の migration push をしてはいけない。既存 table、constraint、policy、function の再作成が衝突する可能性がある。

推奨手順:

1. 正しい project ref を確定。
2. 実 DB schema、function、policy、grant、bucket 設定の snapshot を保存。
3. ローカル migration ごとに、実 DB の object が同値か、未適用か、別経路で適用済みかを照合。
4. 同値性を確認できた version だけを「適用済み」として履歴調整するか、チームの Supabase 運用方針に沿った baseline を作る。
5. staging/branch DB で、修復済み履歴から migration diff が Phase 1 の意図した差分だけになることを確認。
6. 本番の PITR/backup と rollback 担当を確認してから Phase 1 migration を適用。

migration repair は DB の運用状態を変更するため、Phase 0 では実行しない。構造が似ているだけで version を適用済みにしてはならない。

### 1.3 事業判断を閉じる

少なくとも次を migration 作成前に決定する。

- 無料案件を許すか
- 公開見積に確定 due_date を必須とするか
- 基本料金軸を scope のまま維持するか、product type 料金を追加するか
- project activity を Phase 1 必須とするか
- Storage の無条件 INSERT policy の正当な利用者が他機能に存在するか

## 2. 展開方式

expand → compatibility reader → writer cutover → contract の順を採用する。古い reader が NULL/undecided を読めない状態で新 writer を有効にしない。

リリースを次の3段階に分ける。

| 段階 | DB | application | 新データ |
| --- | --- | --- | --- |
| A: compatibility | 現行 | NULL/undecided/request_data を読める。feature flag OFF | 現行形式のみ |
| B: expand | 新 column/table/RPC あり | dual read、旧 writer 可。feature flag OFF | 現行形式のみ |
| C: cutover | 同上 | v2 writer、structured UI、quote snapshot。段階的に flag ON | 新形式 |

rollback 先は必ず A 以降の compatibility build とする。NULL や undecided を保存した後、Phase 0 以前の build へ戻してはならない。

## 3. 推奨マイグレーション・リリース順

### Step 0: ベースラインと観測

- project ref と migration history を確定。
- 本書の preflight SELECT を保存。
- project/quote/payment/storage の非機微な件数と整合性を記録。
- feature flag を準備し、既定 OFF にする。
- 本番 backup/PITR、適用者、監視、rollback 判断時間を決める。

完了条件: ローカル履歴と実 DB の差分が説明でき、Phase 1 migration だけを dry-run できる。

### Step 1: application compatibility を先行配備

DB の新値はまだ書かない。

- NatoriProject の amount と dueDate を nullable、type に undecided を扱える内部型へ更新。
- calendar/scheduling/results/CSV/UI を NULL/undecided 安全にする。
- request_data がなければ既存 note parser を使う dual reader を追加。
- quote snapshot がなくても既存 quote を表示できるようにする。
- type undecided では task 作成/normalization を行わない。
- listNatoriAdminProjects から read-time task mutation を分離する。

完了条件: 現行 DB のまま test/build が通り、人工的な NULL/undecided fixture で UI が壊れない。

### Step 2: 既存セキュリティ問題を分離して是正

Natori schema migration と混ぜず、影響範囲を把握した独立 change とする。

- storage.objects の bucket 条件なし INSERT policy の所有者/利用箇所を確認。
- 必要な bucket ごとの狭い policy へ置換し、Natori private bucket への anon insert を拒否。
- processed_stripe_events の不要な anon/authenticated grant を revoke。
- natori_delete_project の EXECUTE を revoke するか、soft-delete RPC へ置換。呼び出しがないことを検索と log で確認。
- natori-deliveries の bucket size/MIME 制限を事業上の上限に合わせる。

完了条件: portfolio contact の server-side upload と既存各機能の正規 upload は成功し、anon 直接 upload は失敗する。

### Step 3: additive schema migration

最初の Phase 1 migration は、既存 reader を壊さない追加だけにする。

- natori_projects.request_data を nullable、default なしで追加。
- natori_quotes.request_snapshot / pricing_snapshot を nullable で追加。
- natori_project_reference_links を追加。
- Phase 1 採用時は natori_project_activity を追加。
- PK/FK/UNIQUE/CHECK/index を追加。
- 新 table の RLS、grant、service-only 方針を設定。
- natori_pricing_configs の user ごとの default uniqueness は既存データ検証後に追加。

追加直後は全既存 row が request_data/snapshot NULL で正常である。backfill はしない。

### Step 4: project constraint migration

compatibility build が全 instance に配備済みであることを確認後、別 migration で次を行う。

- type CHECK に undecided を追加し、default を undecided にする。
- amount の NOT NULL と default 0 を外し、NULL または0以上の CHECK にする。
- due_date の NOT NULL を外す。
- due_date 用 index を NULL 非対象の partial index に調整。

既存行の値は変更しない。CHECK の置換は既存 constraint 名を実 DB で確認し、同名を仮定しない。

### Step 5: versioned RPC の追加

旧 RPC を残して新名で追加する。

- natori_create_project_with_tasks_v2
  - project + request_data + reference paths + reference links を1 transaction で作成
  - public form は type undecided、amount/due NULL、task なし
  - link は最大5件、HTTPS、normalized duplicate なし
- natori_confirm_project_type_v1
  - project lock、concrete type へ確定、task template を一度だけ作成
  - 制作開始後の type 変更を拒否
- natori_issue_quote_v2
  - concrete type、正額、確定 due_date、snapshot、明細合計を検証
  - version 発行と project mirror/activity を同じ transaction で更新
- 採用時は delivery accept の atomic RPC 化を別 migration で行う

全 SECURITY DEFINER RPC は空 search_path、完全修飾名、service_role only EXECUTE、明示 owner check を満たす。

同名 overload は PostgREST の引数解決と rollback を複雑にするため避ける。旧 RPC の削除は contract phase まで行わない。

### Step 6: 生成型を更新・一本化

- 実 schema から Database 型を再生成。
- canonical file を1つに決める。
- src/lib/supabase/database.types.ts と src/types/supabase.ts の二重化を解消し、全 import を canonical export へ寄せる。
- request/quote snapshot は生成 JSON 型だけに依存せず、共有 Zod schema の infer 型を使う。

完了条件: stale 側にしか存在しない import がなく、strict typecheck が通る。

### Step 7: dual-read application を配備

- structured request detail と legacy note fallback。
- link CRUD と access error 案内。
- amount NULL、due NULL、undecided の全画面表示。
- type 確定 UI と task 生成。
- stable option ID を Portfolio content/editor と pricing config に導入。
- activity を採用した場合は timeline を read-only 表示。

まだ public form writer は feature flag OFF にする。

### Step 8: structured form writer を有効化

- 新フォーム/Zod/API を v2 request 型へ切替。
- upload → v2 RPC → mail の既存 cleanup/失敗方針を維持。
- 最初は内部/限定トラフィック、次に割合 rollout。
- create success、validation failure、mail failure、orphan cleanup、RPC failure を PII なしで計測。

新規 project の期待値:

- request_data.schemaVersion = 1
- type = undecided
- amount/due_date = NULL
- status = inquiry
- task = 0
- reference link = 0〜5

### Step 9: 見積候補と quote snapshot を有効化

- keyword engine の silent bust_up fallback を停止。
- stable ID mapping と warning を導入。
- 管理者が type/amount/due/warning を確定後だけ v2 quote を発行。
- request_snapshot/pricing_snapshot が完全な新 quote から段階適用。
- 旧 quote は snapshot NULL の fallback 表示を維持。

### Step 10: 観測期間と contract

少なくとも1リリース周期、次を監視する。

- 新旧 project 作成数
- invalid request_data
- undecided 滞留時間
- NULL amount/due のまま quote 発行しようとした回数
- quote total mismatch
- payment mismatch/duplicate
- orphan reference file/link
- mail state_error
- Storage 403/5xx

安定後にだけ contract を検討する。

- 旧 public writer の停止
- 旧 create/issue RPC の EXECUTE revoke
- note への機械ログ追記停止
- legacy project mirror の read 優先度低下

legacy columns、旧 note、旧 quote snapshot NULL 行は Phase 1 で削除しない。

## 4. 既存データへの影響

調査時点では project 11件、amount 0 と due_date NULL は0件、type は現行4分類だけだった。したがって nullable 化と undecided 追加は既存値を書き換えない additive/relaxing change になる。

方針:

- request_data は全既存 row で NULL のまま。
- 過去 note を parse して request_data へ backfill しない。
- 過去 reference URL を note から自動抽出しない。
- 既存 quote は request_snapshot/pricing_snapshot NULL のまま。
- completed backfill 由来 project に transaction row を捏造しない。
- 既存 type、amount、due_date、task を変更しない。
- archived row も同じく不変。

必要なら管理者が案件単位で「旧形式から新 revision を作成」する機能を将来提供するが、原 note は残す。

## 5. ロールバック方針

### 5.1 application

1. 新 form/quote feature flag を OFF。
2. writer を旧 RPC または compatibility writer へ戻す。
3. reader は dual-read build を維持。
4. mail、payment、delivery の現行経路は触らない。

Phase 0 以前の NULL 非対応 build へ戻さない。

### 5.2 DB

- 追加 column/table/RPC は残す。緊急 rollback で DROP しない。
- 新 RPC の EXECUTE を止め、旧 RPC を利用可能なままにする。
- NULL/undecided を一度保存した後に NOT NULL/旧 CHECK を戻さない。
- request_data/link/snapshot/activity row を削除しない。
- constraint の tightening は観測後の別 release にし、同一 release で戻す必要をなくす。

### 5.3 Storage/security

無条件 INSERT policy の復元を通常 rollback にしない。正規 upload が壊れた場合は対象 bucket/role だけを限定した一時 policy を用意し、全 bucket 許可へ戻さない。

## 6. 本番適用時の注意

- migration は低トラフィック時間帯に実施し、lock timeout/statement timeout を設定する。
- constraint/index の変更は実データ件数と lock 影響を staging で確認する。
- new table/column 名が実 DB に既にないことを metadata SELECT で確認する。
- function は identity arguments まで含めて差分確認する。
- quote/payment webhook の release 中断がないよう、旧 RPC を先に残す。
- service role key を browser bundle/log へ出さない。
- request_data や URL に個人情報がありうるため、application log に JSON 本文を記録しない。
- signed URL を snapshot/activity/note に保存しない。storage_path だけを保持する。
- URL は保存だけにし、server から fetch しない。
- migration 適用後に型生成し、生成物と実 DB の差分が0であることを確認する。
- Supabase advisor は補助であり、Storage の広い policy のように advisor が拾わない設定も metadata で確認する。

## 7. 検証 SQL（SELECT のみ）

以下は環境名・件数だけを返し、依頼者の本文・メール・URLを取得しない。future column を参照する query は Phase 1 schema 適用後に実行する。

### 7.1 migration history

~~~sql
select version, name
from supabase_migrations.schema_migrations
order by version;
~~~

ローカルの migration filename 一覧と比較し、実体があるだけで applied と断定しない。

### 7.2 対象 table と column

~~~sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'natori_projects',
    'natori_project_tasks',
    'natori_inquiry_reference_files',
    'natori_project_reference_links',
    'natori_quotes',
    'natori_payment_transactions',
    'natori_order_mail_logs',
    'natori_delivery_files',
    'natori_pricing_configs',
    'natori_project_activity',
    'processed_stripe_events'
  )
order by table_name, ordinal_position;
~~~

### 7.3 CHECK、FK、UNIQUE

~~~sql
select
  c.conrelid::regclass::text as table_name,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid, true) as definition
from pg_catalog.pg_constraint c
where c.connamespace = 'public'::regnamespace
  and c.conrelid::regclass::text like 'natori_%'
order by table_name, c.conname;
~~~

### 7.4 index

~~~sql
select tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and (
    tablename like 'natori_%'
    or tablename = 'processed_stripe_events'
  )
order by tablename, indexname;
~~~

### 7.5 RLS policy と table grant

~~~sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename like 'natori_%'
    or tablename in ('processed_stripe_events', 'objects')
  )
order by schemaname, tablename, policyname;
~~~

~~~sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  and (
    table_name like 'natori_%'
    or table_name in ('processed_stripe_events', 'objects')
  )
order by table_schema, table_name, grantee, privilege_type;
~~~

### 7.6 SECURITY DEFINER と EXECUTE ACL

~~~sql
select
  n.nspname as schema_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig,
  p.proacl
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'natori_%'
order by p.proname, arguments;
~~~

確認点は service_role 以外に EXECUTE がなく、security definer の search_path が空、関数本文が完全修飾名を使うことである。関数本文を確認する場合も pg_get_functiondef の SELECT だけを使う。

### 7.7 Storage bucket

~~~sql
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in (
  'natori-inquiry-refs',
  'natori-deliveries',
  'natori-portfolio'
)
order by id;
~~~

### 7.8 project の未確定値・整合性

~~~sql
select
  count(*) as total,
  count(*) filter (where deleted_at is null) as active,
  count(*) filter (where deleted_at is not null) as archived,
  count(*) filter (where amount is null) as amount_undecided,
  count(*) filter (where amount = 0) as zero_amount,
  count(*) filter (where amount < 0) as invalid_amount,
  count(*) filter (where due_date is null) as due_date_undecided,
  count(*) filter (where type = 'undecided') as type_undecided,
  count(*) filter (
    where type not in (
      'undecided', 'icon', 'sd', 'standing', 'illustration'
    )
  ) as invalid_type
from public.natori_projects;
~~~

### 7.9 request_data envelope

~~~sql
select
  count(*) filter (where request_data is null) as legacy_rows,
  count(*) filter (
    where request_data is not null
      and jsonb_typeof(request_data) <> 'object'
  ) as non_object_rows,
  count(*) filter (
    where request_data is not null
      and request_data ->> 'schemaVersion' <> '1'
  ) as unknown_version_rows,
  count(*) filter (
    where request_data is not null
      and octet_length(request_data::text) > 65536
  ) as oversized_rows
from public.natori_projects;
~~~

### 7.10 reference link 制約

~~~sql
select project_id, normalized_url, count(*) as duplicate_count
from public.natori_project_reference_links
group by project_id, normalized_url
having count(*) > 1;
~~~

~~~sql
select project_id, count(*) as link_count
from public.natori_project_reference_links
group by project_id
having count(*) > 5;
~~~

~~~sql
select count(*) as invalid_link_rows
from public.natori_project_reference_links
where url !~* '^https://'
   or char_length(url) > 2048
   or char_length(coalesce(label, '')) > 100
   or sort_order < 0;
~~~

### 7.11 quote 発行条件と snapshot

cutover 時刻を運用記録の値に置き換える。

~~~sql
select
  count(*) filter (
    where q.created_at >= timestamptz '2026-01-01 00:00:00+00'
      and (
        q.request_snapshot is null
        or q.pricing_snapshot is null
      )
  ) as post_cutover_missing_snapshot,
  count(*) filter (
    where q.amount <= 0
  ) as non_positive_quote,
  count(*) filter (
    where p.type = 'undecided'
      or p.due_date is null
  ) as quote_with_unresolved_project
from public.natori_quotes q
join public.natori_projects p on p.id = q.project_id;
~~~

### 7.12 payment/complete mirror の整合性

~~~sql
select
  count(*) filter (
    where paid_at is not null and payment_confirmed_at is null
  ) as paid_without_confirmation,
  count(*) filter (
    where payment_confirmed_at is not null and paid_at is null
  ) as confirmed_without_paid_at,
  count(*) filter (
    where paid_at is not null and paid_amount is distinct from amount
  ) as paid_amount_differs_from_current_amount,
  count(*) filter (
    where status = 'completed' and completed_at is null
  ) as completed_without_timestamp,
  count(*) filter (
    where delivery_accepted_at is not null and completed_at is null
  ) as accepted_without_completion
from public.natori_projects;
~~~

current amount は新版見積作業で変わりうるため、paid_amount differs は即エラーではなく調査対象である。支払いの最終照合は payment_quote_id と transaction の quote_id/amount で行う。

### 7.13 orphan と soft delete

~~~sql
select
  count(*) filter (where p.id is null) as orphan_tasks
from public.natori_project_tasks t
left join public.natori_projects p on p.id = t.project_id;
~~~

~~~sql
select
  count(*) filter (where p.id is null) as orphan_links
from public.natori_project_reference_links l
left join public.natori_projects p on p.id = l.project_id;
~~~

~~~sql
select status, deleted_at is not null as archived, count(*)
from public.natori_projects
group by status, deleted_at is not null
order by archived, status;
~~~

## 8. 適用可否の release gate

次のすべてを満たした時だけ新フォームを有効化する。

- 正しい project ref と migration history の reconcile 完了
- Storage の無条件 INSERT policy の影響確認と是正
- compatibility reader が全 instance に配備済み
- nullable/undecided の unit/component test が成功
- v2 RPC の privilege/search_path/owner check を確認
- request/link/quote snapshot の integration test が成功
- legacy project/quote/note の表示が成功
- Stripe webhook、quote accept、delivery の既存 regression test が成功
- pre/post SELECT に説明不能な不整合がない
- feature flag を即時 OFF にできる

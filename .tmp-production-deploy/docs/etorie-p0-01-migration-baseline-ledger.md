# エトリエ P0-01 migration baseline ledger

調査日: 2026-07-23（JST）
対象リポジトリ: `me-ish/me-ish-homepage`
調査対象Supabase project ref: `lvnfspyainrxtztjytbo`
調査方法: ローカルファイルおよびSupabase/Postgresカタログへの読み取り専用照会

## 1. 結論

- archive前の調査時点で、ローカルの旧migrationは **55ファイル、34個の一意なversion** だった。現在は55件を`supabase/legacy-migrations/`へbyte-identicalでarchiveし、`supabase/migrations/`はactive 2件だけである。
- `supabase_migrations.schema_migrations` は **5行** だけで、ローカルとversionが一致するのは `20250120` と `20250124` の2件である。
- ローカルにありremote historyにないファイルは53件、remote historyにありローカルファイルがないversionは3件である。
- Natoriの主要なtable、column、constraint、index、RLS、policy、grant、function、Storage bucketは実DBに存在し、構造migrationの多くはローカル最終状態と同値である。ただし、履歴が記録されていない。
- 同一versionを持つローカルファイルが6グループある。Supabaseのmigration historyはversion単位であるため、これらをファイル単位でそのままrepairすることはできない。
- データ更新を含むmigrationは、現在のデータが期待形であっても、そのmigrationが実行された事実までは証明できないため `cannot_verify` とした。
- remote-only 3件は `schema_migrations.statements` からSQL本文を回収し、現行DBのcolumn、NULL、default、constraint、indexと比較して同値を確認した。
- 重複versionはGit commitの祖先関係で一部を14桁versionへ対応付けできたが、同一commit内の順序不明行は `cannot_determine` とした。
- 履歴方式は、current schemaの新baselineとlegacy evidence保存を分離する `hybrid` を推奨する。
- この調査ではmigration repair、DDL、DML、Storage書き込み、migrationファイル作成を行っていない。

## 2. 接続先の確認

| 確認元 | 確認値 | 判定 |
| --- | --- | --- |
| `supabase/.temp/project-ref` | `lvnfspyainrxtztjytbo` | ローカルlink先 |
| Supabase project API | ref `lvnfspyainrxtztjytbo`、`me-ish's Project`、`ap-northeast-1`、`ACTIVE_HEALTHY` | 接続中project |
| Supabase API URL | `https://lvnfspyainrxtztjytbo.supabase.co` | ref一致 |
| Vercel Production `NEXT_PUBLIC_SUPABASE_URL` | `https://lvnfspyainrxtztjytbo.supabase.co` | 一致 |
| Vercel Production `SUPABASE_URL` | `https://lvnfspyainrxtztjytbo.supabase.co` | 一致 |

Vercel projectは `me-ishs-projects/me-ish-homepage-vsiv`（project ID `prj_kmLUjzMOcRofMAVsNL2O97Q3GQRj`）で確認した。値の確認対象は上記URLだけであり、keyやsecretは取得していない。

結論: **現在調査しているSupabase project refとVercel Productionの接続先は一致する。**

## 3. remote migration history

`supabase_migrations.schema_migrations` の読み取り結果は次の5行である。

| version | name | ローカルファイル |
| --- | --- | --- |
| `20250120` | `entry_processing_jobs` | あり |
| `20250124` | `mypage_extension` | あり |
| `20260214050324` | `create_card_requests_table` | なし |
| `20260223113216` | `create_aura_projects` | なし |
| `20260225122344` | `add_avatar_shape_bg_pattern_to_aura_projects` | なし |

## 4. version重複

| version | ローカルファイル数 | ファイル |
| --- | ---: | --- |
| `20260208` | 4 | `fix_fee_rounding`、`payout_tables`、`performance_indexes`、`rls_unprotected_tables` |
| `20260209` | 2 | `admin_audit_log`、`gallery_stats_rpc` |
| `20260211` | 15 | RLS、view、function、grant、citext関連の15ファイル |
| `20260524` | 2 | `natori_events`、`natori_project_flow` |
| `20260716` | 2 | `natori_payment_link_columns`、`processed_stripe_events` |
| `20260717` | 2 | `natori_client_email_and_mail_logs`、`natori_quote_acceptance` |

同じversionの複数ファイルに対して `migration repair --status applied <version>` を実行しても、どのファイルを記録したかをhistory上で区別できない。したがって、定義が同値でも `repair_candidate` にはしていない。

## 5. 判定ルール

- `実DBに存在` は、対象の全要素を確認できた場合を「はい」、一部だけを確認できた場合を「一部」、証拠が足りない場合を `cannot_verify` とする。
- `定義同値` は、名前だけでなく、対象に応じてcolumn、NULL、default、constraint、index、RLS、policy、grant、function属性、Storage設定を比較した。
- 「yes（累積）」は、当該migrationが導入した要素が存在し、後続ローカルmigrationによる変更を含む最終状態まで一致したことを表す。
- Natori以外のremote未記録migrationは、主要objectの存在確認は行ったが全定義比較を完了していないため、推測せず `cannot_verify` とした。
- data-only migrationは、現在の行が期待形でも実行経路を一意に証明できないため `cannot_verify` とした。

## 6. baseline ledger

| version | filename | 対象オブジェクト | 実DBに存在 | 定義同値 | remote history | 判定 | 推奨処置 |
| ------- | -------- | -------- | ------ | ---- | -------------- | -- | ---- |
| `20250120` | `20250120_entry_processing_jobs.sql` | `entry_processing_jobs`、queue/index、RLS/policy | はい | 一部（後続RLS変更あり） | recorded | `applied_and_recorded` | `none` |
| `20250124` | `20250124_mypage_extension.sql` | `portfolio_profiles`、`likes`、`entry_view_events`、`entry_view_stats` | 一部（`portfolio_profiles`と2 indexが不在） | no | recorded | `partially_applied` | `manual_investigation` |
| `20250125` | `20250125_sales_payout_management.sql` | `sales`、`v_my_sales_summary`、`v_pending_payouts`、sales RPC | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20250201` | `20250201_ending_soon_notification.sql` | `entries.end_notified_at`、ending-soon index | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260131` | `20260131_profile_banner_focus.sql` | `profiles`のbanner focus列 | はい（table） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260201` | `20260201_entries_email_rls.sql` | `entries_select_by_email` policy | はい（対象table） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260202` | `20260202_admin_entry_workflow_view.sql` | `v_admin_entry_workflow` | はい | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260203` | `20260203_entry_plan_payment.sql` | `entries`のplan/payment列・CHECK・index | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260205` | `20260205_view_stats.sql` | artist/viewer stats views・RPC | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260206` | `20260206_entry_comments.sql` | `entry_comments`、index、RLS/policy、count view | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260207` | `20260207_add_guarantee_and_daily_slots.sql` | `entries`保証列、`entry_daily_slots`、index、RLS/policy | はい（主要object） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260208` | `20260208_fix_fee_rounding.sql` | `finalize_sale` | はい | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260208` | `20260208_payout_tables.sql` | `payouts`、`payout_items`、`payout_batches` | はい（主要object） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260208` | `20260208_performance_indexes.sql` | entries/sales/aura/entry-view indexes | はい（抽出index） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260208` | `20260208_rls_unprotected_tables.sql` | portfolio/bank/aura/profiles/admin/inquiries RLS/policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260209` | `20260209_admin_audit_log.sql` | `admin_audit_log`、index、RLS/policy | はい（主要object） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260209` | `20260209_gallery_stats_rpc.sql` | `get_gallery_stats()` | はい | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260210` | `20260210_end_notified_at.sql` | `entries.end_notified_at` | はい（table） | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_add_rls_deny_policies_server_only.sql` | admin/bank/cert/payout deny policies | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_artists_bank_accounts_rls.sql` | `artists_bank_accounts` RLS/grant/policy | はい（table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_enable_rls_server_only_tables.sql` | aura claim/counter、processing jobs RLS | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_entries_update_own_policy.sql` | `entries_update_own` policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_aura_select_own_email_policy.sql` | `aura_select_own_email` policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_function_search_path.sql` | sales/gallery/stats/cert/touch系function search_path | はい（function） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_rls_inquiries_insert.sql` | inquiries INSERT policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_rls_policies_entries_inquiries.sql` | entries/inquiries policies | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_sales_select_buyer_policy.sql` | `sales_select_buyer` policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_security_advisor_remaining_views.sql` | announcements/entry/aura/cert/admin views | はい（抽出view） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_security_advisor_views.sql` | sales/artist/viewer views | はい（抽出view） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_v_pending_payouts_security_invoker.sql` | `v_pending_payouts` | はい | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_fix_view_grants_minimal.sql` | public viewsのgrant | はい（対象view） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_move_citext_to_extensions_schema.sql` | `citext` extension/schema依存 | `cannot_verify` | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260211` | `20260211_mypage_rls_sales_and_jobs.sql` | `sales`、`entry_processing_jobs` RLS/policy | はい（対象table） | `cannot_verify` | unrecorded・version重複 | `cannot_verify` | `manual_investigation` |
| `20260308` | `20260308_get_auth_user_id_by_email.sql` | `get_auth_user_id_by_email` | はい | `cannot_verify` | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260523` | `20260523_natori_projects.sql` | `natori_projects`、`natori_project_tasks`、constraint/index/RLS/policy/trigger | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260524` | `20260524_natori_events.sql` | `natori_events`、index/RLS/policy/trigger | はい | yes（累積） | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260524` | `20260524_natori_project_flow.sql` | `natori_projects.status`、default、CHECK、`payment_confirmed_at` | はい | yes（累積） | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260525` | `20260525_natori_user_profiles.sql` | `natori_user_profiles`、UNIQUE/FK/RLS/policy/trigger | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260526` | `20260526_natori_pricing_configs.sql` | `natori_pricing_configs`、UNIQUE/index/RLS/policy/trigger | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260527` | `20260527_natori_unified_character_tasks.sql` | icon/sd/standingの6-step task data | はい（現行対象行は6-step） | `cannot_verify`（実行経路） | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260528` | `20260528_natori_illustration_rough_submit.sql` | illustrationの6-step task data | はい（現行対象行は6-step） | `cannot_verify`（実行経路） | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260710` | `20260710_natori_portfolio_content.sql` | content table/policy/trigger、`natori-portfolio` bucket | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260711` | `20260711_natori_closed_status.sql` | project status `closed` CHECK | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260713` | `20260713_natori_page_events.sql` | `natori_page_events`、index/RLS | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260714` | `20260714_natori_links_content.sql` | content table/policy/trigger | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260716` | `20260716_natori_payment_link_columns.sql` | `payment_link_id`、`quoted_amount` | はい | yes | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260716` | `20260716_processed_stripe_events.sql` | `processed_stripe_events`、RLS、index | はい | yes（grant問題は別記） | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260717` | `20260717_natori_client_email_and_mail_logs.sql` | `client_email`、`natori_order_mail_logs`、index/RLS | はい | yes（累積） | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260717` | `20260717_natori_quote_acceptance.sql` | legacy quote token/accept列、partial index | はい | yes（累積） | unrecorded・version重複 | `applied_but_unrecorded` | `baseline_candidate` |
| `20260720` | `20260720_natori_delivery.sql` | delivery列/table/index/RLS、`natori-deliveries` bucket | はい | yes（累積） | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `202607200001` | `202607200001_natori_beta_safety.sql` | quotes/payment/mail/reference、7 RPC、bucket、data backfill | はい（構造・RPC） | `cannot_verify`（data更新を含む） | unrecorded | `cannot_verify` | `manual_investigation` |
| `202607200002` | `202607200002_natori_backfill_legacy_completed_results.sql` | completed projectのdata backfill | はい（現行行は条件充足） | `cannot_verify`（実行経路） | unrecorded | `cannot_verify` | `manual_investigation` |
| `20260720102549` | `20260720102549_harden_natori_rpc_privileges.sql` | 7 RPCのEXECUTE ACL | はい | yes | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260720103406` | `20260720103406_add_natori_project_soft_delete.sql` | `deleted_at`、partial index、comment | はい | yes | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260720104033` | `20260720104033_harden_natori_data_api_and_indexes.sql` | Natori table grant/policy、touch function search_path、FK index | はい | yes | unrecorded | `applied_but_unrecorded` | `repair_candidate` |
| `20260214050324` | `(remote only; SQL recovered in docs)` | `card_requests`、PK、3 index | はい | yes（19列の型/NULL/default、PK、indexを比較） | recorded・remote only | `applied_and_recorded` | `none` |
| `20260223113216` | `(remote only; SQL recovered in docs)` | `aura_projects`、PK、slug UNIQUE | はい | yes（base 27列の型/NULL/default、PK、UNIQUEを比較） | recorded・remote only | `applied_and_recorded` | `none` |
| `20260225122344` | `(remote only; SQL recovered in docs)` | `aura_projects.avatar_shape/bg_pattern` | はい | yes（型、NOT NULL、defaultを比較） | recorded・remote only | `applied_and_recorded` | `none` |

## 7. Natori定義比較の証拠

### 7.1 table、column、constraint

実DBには次の14 tableが存在する。

`natori_projects`、`natori_project_tasks`、`natori_events`、`natori_user_profiles`、`natori_pricing_configs`、`natori_portfolio_content`、`natori_links_content`、`natori_page_events`、`natori_order_mail_logs`、`natori_delivery_files`、`natori_quotes`、`natori_payment_transactions`、`natori_inquiry_reference_files`、`processed_stripe_events`

カタログから全columnの型、NULL、defaultを取得し、Natoriローカルmigrationの累積結果と比較した。主な確認結果は次のとおり。

- `natori_projects`: 36列。`amount integer NOT NULL DEFAULT 0`、`due_date date NOT NULL`、`status text NOT NULL DEFAULT 'inquiry'`、quote/payment/delivery列、`deleted_at`が存在する。
- project type CHECKは `icon / sd / standing / illustration`、status CHECKは `inquiry`から`closed`まで13値、delivery planとpriority、非負amount/paid amount、payment-link statusのCHECKが一致する。
- project/task/quote/payment/mail/reference/deliveryのFKは、ローカル指定どおり `CASCADE` または `SET NULL` である。
- `UNIQUE (project_id, task_key)`、`UNIQUE (user_id, preset_key)`、`UNIQUE (project_id, version)`、quote token、Stripe session、Storage path、handleのUNIQUEが存在する。
- `natori_order_mail_logs.sent_at`はnullableかつdefaultなし、追加されたrequest/status/snapshot列はNOT NULLであり、beta safety後の定義と一致する。
- `processed_stripe_events`は `event_id text PRIMARY KEY`、`received_at timestamptz NOT NULL DEFAULT now()` で一致する。

### 7.2 index

ローカルで定義されたNatori indexを、column順、DESC、partial predicate、UNIQUEを含めて照合した。owner/due、deleted、quote/payment FK、quote/delivery token、task、event、mail、payment、reference、delivery、page event、processed eventの各indexは実DBに存在し、定義が一致する。

### 7.3 RLS、policy、table grant

- 上記Natori tableと`processed_stripe_events`はすべてRLS enabledである。
- owner tableにはowner policy、service-only tableには `natori_service_only` deny policyが存在する。
- `natori_portfolio_content` と `natori_links_content` にはpublic read policyが存在するが、後続hardeningにより `anon` / `authenticated` のtable grantはない。
- Natoriの13 tableは `service_role` のみに全table権限があり、`anon` / `authenticated` のtable grantはない。
- 例外として `processed_stripe_events` は `anon`、`authenticated`、`service_role` の全table権限が残っている。これはmigrationの存在判定とは分離してセキュリティ課題とする。

### 7.4 function

7個のNatori RPCについて、identity arguments、戻り値、`SECURITY DEFINER`、`search_path`、EXECUTE ACL、function bodyを比較した。ローカルSQLから抽出したbodyのMD5と実DB `pg_proc.prosrc` のMD5は7件すべて一致した。

| function identity | SECURITY DEFINER | search_path | EXECUTE |
| --- | --- | --- | --- |
| `natori_create_project_with_tasks(uuid,jsonb,jsonb,jsonb)` | yes | `public` | `postgres`, `service_role` |
| `natori_delete_project(uuid,uuid)` | yes | `public` | `postgres`, `service_role` |
| `natori_update_task_and_status(uuid,uuid,text,boolean,text,text)` | yes | `public` | `postgres`, `service_role` |
| `natori_confirm_manual_payment(uuid,uuid,text)` | yes | `public` | `postgres`, `service_role` |
| `natori_record_stripe_payment(uuid,text,integer,uuid)` | yes | `public` | `postgres`, `service_role` |
| `natori_issue_quote(uuid,uuid,text,text,text,integer,text,text,text,timestamptz)` | yes | `public` | `postgres`, `service_role` |
| `natori_accept_quote(text)` | yes | `public` | `postgres`, `service_role` |

6個の`touch_natori_*_updated_at()`は`SECURITY DEFINER`ではなく、実DBではすべて空の`search_path`である。triggerの対象table、`BEFORE UPDATE`、実行functionもローカルと一致する。

### 7.5 Storage

| bucket | public | file_size_limit | allowed_mime_types | ローカル同値 |
| --- | --- | --- | --- | --- |
| `natori-inquiry-refs` | false | 10,485,760 bytes | jpeg/png/webp/gif | yes |
| `natori-deliveries` | false | NULL | NULL | yes |
| `natori-portfolio` | true | NULL | NULL | yes |

Natori bucket専用の`storage.objects` policyはない。実DB全体には、後述するbucket条件なしのINSERT policyが存在する。

### 7.6 data-only migrationの現在状態

- projectは11件、すべてactive。amount 0、amount負数、due_date NULLは0件。
- completedは10件で、`payment_confirmed_at`、`paid_at`、`paid_amount`、`completed_at`の不足は0件。
- taskは全projectで6件。illustrationは `rough / rough-submit / line / color / finishing / delivery`、sdは `rough / rough-submit / lineart / color / review / delivery` で期待形と一致する。

これは現在状態の確認であり、20260527、20260528、202607200001、202607200002が実行された履歴証明ではない。

## 8. セキュリティ確認（独立項目）

### 8.1 bucket条件なしのStorage INSERT policy

`storage.objects` に次のpolicyが存在する。

- policy: `Allow Insert 1exduyn_0`
- role: `public`
- command: `INSERT`
- `WITH CHECK (true)`
- `anon` と `authenticated` は `storage.objects` のINSERTを含むtable権限を持つ。

bucket条件がないため、Natoriのprivate bucketを含む任意bucketへの匿名uploadを許し得る。今回は修正していない。

### 8.2 `processed_stripe_events` のgrant

- RLS enabled、policyなし。
- `anon`、`authenticated`、`service_role` に全table権限がある。
- RLSにより通常のanon/auth行操作は拒否されるが、意図したservice-only grantとは一致しない。
- Security Advisorは `rls_enabled_no_policy`、anon/authのGraphQL公開を検出している。

参照: [RLS enabled no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)、[anon GraphQL exposure](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)、[authenticated GraphQL exposure](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed)

### 8.3 `natori_delete_project`

- `SECURITY DEFINER`、identity argumentsは `(p_user_id uuid, p_project_id uuid)`、`search_path=public`。
- EXECUTEは`postgres`と`service_role`だけである。
- function bodyはローカルと一致するが、動作は`deleted_at`更新ではなく物理`DELETE`である。
- アプリ側で未使用であっても、service roleから実行可能なhard-delete RPCとして残る。今回は修正していない。

### 8.4 `card_requests` のRLS

- tableは存在するがRLS disabled。
- `anon` / `authenticated` に全table権限があり、`session_token`列がある。
- Security AdvisorはRLS disabled、sensitive column exposure、anon/auth GraphQL公開を検出している。

参照: [RLS disabled in public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)、[sensitive columns exposed](https://supabase.com/docs/guides/database/database-linter?lint=0023_sensitive_columns_exposed)

### 8.5 `aura_projects` のRLS

- tableは存在するがRLS disabled。
- `anon` / `authenticated` に全table権限があり、`session_token`列がある。
- Security AdvisorはRLS disabled、sensitive column exposure、anon/auth GraphQL公開を検出している。

### 8.6 Advisorで検出されたNatori関連項目

Security Advisorで直接Natori関連として検出されたものは、`processed_stripe_events`のpolicyなしとGraphQL公開である。Natori named tableのRLS disabledやSECURITY DEFINER ACL警告は検出されていない。

Performance Advisorは次のNatori indexを`unused_index`として報告している。調査時点の利用統計に基づくため、この結果だけで削除してはならない。

`natori_projects_active_owner_due_idx`、`natori_projects_deleted_owner_idx`、`natori_order_mail_logs_quote_id_idx`、`natori_payment_transactions_quote_id_idx`、`natori_projects_active_quote_id_idx`、`natori_projects_payment_quote_id_idx`、`natori_events_user_idx`、`natori_pricing_configs_user_idx`、`idx_natori_page_events_event`、`idx_processed_stripe_events_received_at`、`idx_natori_projects_quote_token`、`idx_natori_projects_delivery_token`、`idx_natori_delivery_files_project`、`idx_natori_quotes_user`、`idx_natori_payment_transactions_project`

## 9. 調査上の限界

- Natori以外の53件すべてについて、全DDLを逐語的に再現するレベルの比較は行っていない。主要objectの存在を確認し、不明は台帳で `cannot_verify` とした。
- remote-only 3 migrationのstatement本文は回収済み。ただし失われた元ファイルのコメント、セミコロン、改行コードを含むbyte-for-byteの復元ではない。回収記録は`docs/migration-recovery/`を正とする。
- `20250124`はcurrent object状態として`partially_applied`だが、その原因は`cannot_determine`である。target schemaで`portfolio_profiles`を廃止/復元する判断が必要である。
- backup/PITRの有効状態、最新backup時刻、restore可能範囲は確認できていない。
- Supabase Branch一覧は権限検証APIがproject ref欠落エラーを返したため、利用可能な検証branchの有無は確認できていない。
- P0-02 ADRの決定内容は変更していない。

## 10. archive確定記録

| 項目 | 確定値 |
| --- | --- |
| active directory | `supabase/migrations/` |
| legacy directory | `supabase/legacy-migrations/` |
| active migration count | 2 |
| legacy local migration count | 55 |
| remote-only evidence count | 3 |
| active duplicate version count | 0 |
| baseline | `20260723111730_etorie_baseline.sql` |
| security hardening | `20260723111741_baseline_security_hardening.sql` |
| checksum method | exact raw file bytesのSHA-256、改行・encoding変換なし |
| archive verification | 55/55 filename・size・SHA-256一致、content change 0 |

旧55件の判定、replay可否、replacementは変更していない。pathだけをactive laneからlegacy evidence laneへ移し、`supabase/baseline/legacy-migrations.json`に移動前path、archive path、version、SHA-256、sizeを記録した。remote-only 3件はmigration file化していない。

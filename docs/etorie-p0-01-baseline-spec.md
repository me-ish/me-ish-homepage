# エトリエ P0-01 schema baseline仕様

調査日: 2026-07-23（JST）
status: draft / production適用禁止
採用戦略: `hybrid`

## 1. 目的

現在の検証済みtarget schemaをfresh Supabase環境へ再現できるschema-only baselineの仕様を定義する。これはSQL migration fileではなく、将来作成するbaseline artifactのreview contractである。

## 2. scope

今回のEtori baselineに含める:

- Natori/Etorie関連のapplication-owned `public` table、sequence、constraint、index、function、trigger、comment。
- RLS enabled/disabled state、policy、table/function grant、function owner-sensitive属性。
- Natoriが必要とするextension、`auth.users`参照、Storage bucket設定。
- `processed_stripe_events`とNatori 7 RPC。
- shared projectのsecurity correction対象である`card_requests`/`aura_projects`はbaselineで再作成せず、full current-state cloneに存在する場合だけ独立hardeningで保護する。

baselineから除外する:

- Natori/Etorieに依存しないapplication table/view/function。旧55 migrationを推測順で再生して全schemaを作らない。
- business data、user data、Stripe event、mail log、audit log、task row等のDML。
- `supabase_migrations.schema_migrations`の旧5行。
- `auth.users`等Supabase managed data。
- `storage.objects`のファイルmetadata rowと実ファイル。
- API key、JWT secret、service-role key、Vault secret、Stripe/Vercel secret。
- Supabase platform設定、Auth provider設定、SMTP、redirect URL、custom domain。
- realtime publication/subscription状態は、application要件が確定するまで`operator_confirmation_required`。

## 3. current object inventory

### 3.1 table

current productionの`public` table 42件:

`admin_audit_log`、`admin_emails`、`announcements`、`artists_bank_accounts`、`aura_first20_redemptions`、`aura_meish_free_claims`、`aura_projects`、`aura_promo_counters`、`aura_requests`、`card_requests`、`cert_links`、`entries`、`entry_comments`、`entry_daily_slots`、`entry_processing_jobs`、`entry_view_events`、`inquiries`、`kpi_jobs`、`kpi_posts`、`likes`、`natori_delivery_files`、`natori_events`、`natori_inquiry_reference_files`、`natori_links_content`、`natori_order_mail_logs`、`natori_page_events`、`natori_payment_transactions`、`natori_portfolio_content`、`natori_pricing_configs`、`natori_project_tasks`、`natori_projects`、`natori_quotes`、`natori_user_profiles`、`payout_batches`、`payout_items`、`payouts`、`portfolio_settings`、`processed_stripe_events`、`profiles`、`sales`、`special_thanks`、`youtube_videos`。

`portfolio_profiles`は廃止が承認済みであり、current productionにも存在しないためbaselineへ含めない。現行アプリ参照と手書きschema型は除去し、旧migrationと調査資料だけをlegacy evidenceとして保持する。

### 3.2 view

`announcements_public`、`aura_first20_stats`、`entry_comment_counts`、`entry_view_stats`、`v_admin_entry_workflow`、`v_artist_view_stats`、`v_cert_links_active`、`v_my_external_user_ids`、`v_my_sales_summary`、`v_pending_payouts`、`v_public_portfolio_entries`、`v_viewer_stats`。

view definitionだけでなく`security_invoker`、owner、grantを含める。

### 3.3 sequence

`artists_bank_accounts_id_seq`、`entries_id_seq`、`natori_order_mail_logs_id_seq`、`natori_page_events_id_seq`。identity/serial ownershipとtable column defaultを同時に検証する。

### 3.4 function

少なくとも次のfunction familyを全overload・identity arguments単位で含める。

- sales/payout: `admin_mark_sales_paid`、`finalize_sale`の2 overload。
- AURA: `aura_claim_first20_free`、`aura_claim_meish_free`。
- cert/entry/portfolio: `consume_cert_token`、`get_public_portfolio`、`increment_entry_likes`、`set_entry_portfolio_hidden`、`toggle_like`。
- stats: `get_gallery_stats`、`get_my_artist_view_stats`、`get_my_viewer_stats`、`get_my_works_view_stats`。
- Auth lookup: `get_auth_user_id_by_email`。
- Natori RPC: `natori_accept_quote`、`natori_confirm_manual_payment`、`natori_create_project_with_tasks`、`natori_delete_project`、`natori_issue_quote`、`natori_record_stripe_payment`、`natori_update_task_and_status`。
- trigger helper: `entry_processing_jobs_set_updated_at`、`normalize_unlimited_total`、`set_updated_at`、`touch_*`、`update_updated_at_column`。

各functionについて、`pg_get_function_identity_arguments`、return type、language、body、volatility、strict、SECURITY DEFINER/INVOKER、owner、`proconfig`の`search_path`、EXECUTE ACLを比較する。function名だけでは同値としない。

### 3.5 Natori object set

table 15件:

`natori_projects`、`natori_project_tasks`、`natori_events`、`natori_user_profiles`、`natori_pricing_configs`、`natori_portfolio_content`、`natori_links_content`、`natori_page_events`、`natori_order_mail_logs`、`natori_delivery_files`、`natori_quotes`、`natori_payment_transactions`、`natori_inquiry_reference_files`、`processed_stripe_events`、およびNatoriが参照する`profiles`。

全column、CHECK、PK/FK/UNIQUE、partial/covering index、RLS、policy、grant、trigger、comment、上記7 RPCを含める。P0-02 ADRのdomain decisionは変更しない。

## 4. creation order

1. Supabase managed base (`auth`、`storage`、roles)が存在することを確認。
2. application用schemaとextension。
3. FK参照元になるbase table: `profiles`、`entries`、`aura_requests`、`natori_projects`等。
4. child table: likes/comments/jobs/sales/payout、Natori task/quote/payment/mail/reference/delivery/content/event。
5. 循環を避けるため後付けFK、UNIQUE、CHECK。
6. sequence ownership、通常index、partial index。
7. pure helper function、RPC、trigger function。
8. trigger。
9. viewを依存順に作成。
10. RLS enabled/disabled state、policy。
11. table/view/function grantとdefault privilege。
12. `storage.objects` policy。
13. 別manifestでbucket設定。実ファイルは別restore手順。

baseline generatorの出力順をそのまま信用せず、fresh databaseでこの依存順が成立することを確認する。

## 5. extension

current installed extension:

| extension | schema | baseline treatment |
| --- | --- | --- |
| `citext` | `extensions` | 明示的に必要。配置schemaを固定 |
| `pgcrypto` | `extensions` | UUID/crypto依存を確認 |
| `uuid-ossp` | `extensions` | 使用有無を確認後もcurrent parityのため含める |
| `pg_stat_statements` | `extensions` | platform availabilityを確認 |
| `pg_graphql` | `graphql` | Supabase managed。version互換確認 |
| `plpgsql` | `pg_catalog` | platform managed |
| `pgsodium` | `pgsodium` | platform managed |
| `supabase_vault` | `vault` | extensionのみ。secret dataは除外 |

extension versionはpre-snapshotへ記録し、検証環境で利用できないversionを無理に指定しない。

## 6. Storage

current bucket manifest:

| id | public | file size limit | allowed MIME |
| --- | --- | ---: | --- |
| `artworks` | true | `null` | `null` |
| `aura-assets` | false | `null` | `null` |
| `avatars` | true | `null` | `null` |
| `banners` | true | `null` | `null` |
| `card-assets` | false | `null` | `null` |
| `natori-deliveries` | false | `null` | `null` |
| `natori-inquiry-refs` | false | `10485760` | `image/jpeg,image/png,image/webp,image/gif` |
| `natori-portfolio` | true | `null` | `null` |
| `processing-meta` | false | `null` | `null` |

bucketはschema dumpに含まれないdata rowであるため、baseline SQLと分離したreviewed config manifestで管理する。`storage.objects` policyはschema artifactへ含める。

実ファイル、object metadata、signed URLはbaseline対象外。backup/restoreは別checklistに従う。

現在のbucket条件なし`Allow Insert 1exduyn_0`はtarget security stateが未承認であり、そのままbaselineへ固定してはならない。security follow-upの結論を先に反映する。

Natori向けtarget案:

- `natori-inquiry-refs`と`natori-deliveries`はprivateを維持し、直接public read/write policyを付与しない。server-side adminまたは短寿命signed URLだけを利用する。
- `natori-portfolio`はpublic read用途を維持するが、write/deleteはserver-side owner確認済み経路に限定する。
- bucket条件なしのpublic INSERTはNatori要件に含めない。
- 最終policy名、role、USING/WITH CHECKはsecurity reviewとsigned upload E2E後にfreezeする。

## 7. Auth

- public tableの`auth.users(id)` FKは含めるが、`auth.users`のDDLをapplication baselineで再作成しない。
- Auth user data、identity、session、MFAはseed対象外。
- provider、SMTP、site URL、redirect URL、JWT expiry、CAPTCHA、email template、hook設定は`operator_confirmation_required`。
- fresh dry-runでは専用test userを通常Auth APIで作り、fixtureのFKを満たす。production userをcopyしない。

## 8. schema-only / seed / fixture

### schema-only

- CREATE/ALTER/COMMENT/GRANT/REVOKEとpolicy/function/viewを対象とする。
- business rowを作るINSERT/UPDATE/DELETEを含めない。
- bucket config rowは別manifest。

### seed

- 本番識別子、email、Stripe ID、token hash、Storage pathを含めない。
- enum-like master dataが実在する場合も、source ownershipとidempotencyをレビューして別seedへ置く。

### dry-run fixture

Natoriはinquiry、quote前、accepted quote、paid、completed、archived、legacy completedを匿名test dataで作る。data migrationが作った可能性のあるtask構成はfixture expectationとして明記し、migration実行済みの証拠には使わない。

## 9. baseline後のmigration

順序:

1. baseline。
2. 独立した`baseline_security_hardening`。baseline直後に必ず連続適用し、baseline単体を成功状態とみなさない。
3. P0-02 ADRに従うPhase 1 schema migration。
4. 型再生成とapplication change。

旧55 migrationをbaselineの後にreplayしない。

## 10. validation query contract

以下は読み取り専用validation用であり、migration SQLではない。

### relation/column/default

```sql
select table_schema, table_name, ordinal_position, column_name,
       data_type, udt_schema, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;
```

### constraint/index

```sql
select n.nspname, c.relname, con.conname, con.contype,
       pg_get_constraintdef(con.oid, true)
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by n.nspname, c.relname, con.conname;

select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### RLS/policy/grant

```sql
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

### function

```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid), l.lanname, p.prosecdef,
       p.provolatile, p.proisstrict, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, pg_get_function_identity_arguments(p.oid);
```

### bucket

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;
```

## 11. expected schema checksum

1. 上記queryの値をJSON Linesへ変換する。
2. key順を固定し、row順はqueryのORDER BYで固定する。
3. timestamp表示をUTC、booleanを`true/false`、NULLをJSON `null`へ正規化する。
4. LF改行、UTF-8、末尾LFありでserializeする。
5. object categoryごとのSHA-256と、それらを`category=hash`形式で並べたmanifest全体のSHA-256を保存する。
6. generated dump file checksumだけで同値判定せず、catalog checksumと両方を比較する。
7. production pre-snapshot、current-state clone、fresh baseline DBの3者で期待対象が一致することをsuccess条件にする。

checksum期待値はbaseline SQLを実際に生成・reviewした時点で確定する。現時点は`operator_confirmation_required`。

## 12. freeze blocker

- `portfolio_profiles`の廃止、baseline除外、active参照除去は決定・artifact反映済み。
- security target stateは独立hardening migrationへ反映済み。ただし検証環境で未適用。
- Auth/Realtime/platform config確認。
- baseline generatorとCLI version pin。
- expected checksum確定。
- fresh/current-clone両方のdry-run成功。

baseline migrationとsecurity hardening migrationはローカルartifactとして作成済みである。fresh/current-clone双方のPattern B/C、expected checksum確定、backup/rollback gateが完了するまで本番適用しない。

## 13. active migration contract

- active migration directoryは`supabase/migrations/`である。
- 現在のactive sequenceはbaseline、baseline-security-hardeningの2件である。
- 旧55件は`supabase/legacy-migrations/`にbyte-identicalでarchiveし、baseline生成元のevidenceとしてのみ保持する。
- fresh databaseはactive sequenceと、その後に追加される14桁UTC timestamp migrationから構築する。
- Pattern Bはactive directoryのmanifest-listed migrationだけを使用し、legacy SQLをコピーまたは実行しない。
- Pattern Cは旧migrationをreplayせず、current-state cloneのschemaとreview済みhistory transitionを前提にする。
- archive前後の全55件のSHA-256一致は`artifacts/legacy-migration-archive/verification.json`を正とする。
- 本番適用、history更新、repair、DDL、DMLは本archive作業の対象外である。

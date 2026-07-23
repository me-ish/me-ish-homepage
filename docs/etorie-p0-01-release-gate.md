# エトリエ P0-01 release gate

調査日: 2026-07-23（JST）
詳細台帳: [`etorie-p0-01-migration-baseline-ledger.md`](./etorie-p0-01-migration-baseline-ledger.md)

## 1. gate summary

| gate | 状況 | 判定 |
| --- | --- | --- |
| 本番project ref | ローカルlink、Supabase project、Vercel Productionの2つのSupabase URLが `lvnfspyainrxtztjytbo` で一致 | pass |
| migration history | remote 5行に対してlocal 55ファイル。local-only 53、remote-only 3 | fail |
| remote-only SQL recovery | 3件とも`schema_migrations.statements`から本文を回収し、current DBと定義比較済み | pass |
| local version一意性 | 6つのversion重複グループ、55ファイルに対して一意versionは34 | fail |
| Natori schema同値性 | 構造、constraint、index、RLS、policy、grant、RPC、bucketの主要部分は一致 | pass with exceptions |
| data migration証明 | 現在状態は期待形だが、4 migrationの実行経路を証明できない | open |
| 非Natori migration同値性 | 主要object存在のみ。完全定義比較未完了 | open |
| baseline artifact | CLI生成のbaselineと独立security hardening、manifest、fixture、checksum/diff/helperを作成 | pass for local artifact |
| `portfolio_profiles` | 廃止、baseline除外、active runtime/type参照除去 | pass |
| 検証環境dry-run | 未実施。利用可能なSupabase Branchも未確認 | fail |
| backup/PITR | 有効状態、restore point、復旧手順が未確認 | fail |
| rollback owner | 未割当 | fail |
| セキュリティ例外 | broad Storage INSERT、processed grant、hard-delete RPC、card/aura RLSが未解消 | fail for release |

## 2. 本番project ref確認状況

本番接続先は確認済みである。

- ローカル `supabase/.temp/project-ref`: `lvnfspyainrxtztjytbo`
- Supabase project: `me-ish's Project`、ref `lvnfspyainrxtztjytbo`、`ap-northeast-1`、healthy
- Vercel project: `me-ishs-projects/me-ish-homepage-vsiv`
- Vercel Production `NEXT_PUBLIC_SUPABASE_URL`: `https://lvnfspyainrxtztjytbo.supabase.co`
- Vercel Production `SUPABASE_URL`: `https://lvnfspyainrxtztjytbo.supabase.co`

keyやsecretは確認対象にしていない。

## 3. migration historyの確定状況

確定している事実:

- remote historyは `20250120`、`20250124`、`20260214050324`、`20260223113216`、`20260225122344` の5行。
- local historyは55ファイル、34個の一意version。
- `20250124_mypage_extension.sql` はremoteにrecordedだが、実DBではmigrationが作る `portfolio_profiles` とその2 indexが不在である。同じmigrationの`likes`、`entry_view_events`、`entry_view_stats`は存在する。
- remote-only 3 migrationは`schema_migrations.statements`からSQL本文を回収した。statement canonical checksumはそれぞれ`83fac131...ffe1`、`0da2f8a8...f57b`、`4018aba6...f01`で、current DBのcolumn型、NULL、default、constraint、indexと同値である。
- Natoriの構造migrationは実DBに反映された状態だが、remote historyには1件もない。

したがって、historyは**未確定**であり、この状態で通常の`db push`や一括repairを行ってはならない。

## 4. repair / baseline候補

ここでの「候補」は実行承認ではない。検証環境で同じ判断を再現し、責任者レビューを通過するまで本番repairは禁止する。

追加調査後の推奨戦略は`hybrid`である。current schemaをschema-only baselineへ固定し、以下の既存candidate、旧55 file、remote 5 rowをlegacy evidenceとして保存する。一意version 11件を個別repairする案は比較対象として残すが、現在の推奨実行案ではない。

### 4.1 旧`repair_candidate`（個別repairは非推奨）

versionが一意で、Natoriの構造または権限定義が実DBと一致したもの:

- `20260523_natori_projects.sql`
- `20260525_natori_user_profiles.sql`
- `20260526_natori_pricing_configs.sql`
- `20260710_natori_portfolio_content.sql`
- `20260711_natori_closed_status.sql`
- `20260713_natori_page_events.sql`
- `20260714_natori_links_content.sql`
- `20260720_natori_delivery.sql`
- `20260720102549_harden_natori_rpc_privileges.sql`
- `20260720103406_add_natori_project_soft_delete.sql`
- `20260720104033_harden_natori_data_api_and_indexes.sql`

### 4.2 `baseline_candidate`

実DB定義は一致するが、同一versionの別ファイルがあり、現行versionのままでは個別にhistoryへ記録できないもの:

- `20260524_natori_events.sql`
- `20260524_natori_project_flow.sql`
- `20260716_natori_payment_link_columns.sql`
- `20260716_processed_stripe_events.sql`
- `20260717_natori_client_email_and_mail_logs.sql`
- `20260717_natori_quote_acceptance.sql`

### 4.3 repair / baselineにまだ入れないもの

- `20260527_natori_unified_character_tasks.sql`
- `20260528_natori_illustration_rough_submit.sql`
- `202607200001_natori_beta_safety.sql`
- `202607200002_natori_backfill_legacy_completed_results.sql`

上記はdata更新を含む。現在状態は期待形だが、そのmigrationが実行されたことを一意に証明できない。

Natori以外のremote未記録migrationも、全定義比較を完了するまでrepair対象にしない。

### 4.4 採用するbaseline candidate

current productionのapplication-owned schema、function、RLS、policy、grant、Storage設定を一体のschema-only baseline candidateとする。object scope、作成順、除外data、checksum方法は[`etorie-p0-01-baseline-spec.md`](./etorie-p0-01-baseline-spec.md)を正とする。

remote-only回収SQLは正本証拠として`docs/migration-recovery/`に保持するが、current DBへ再適用しない。

## 5. dry-run前に必要な作業

1. 完了: remote-only 3 migrationのstatement本文とcanonical checksumを`docs/migration-recovery/`へ保存した。
2. `20250124_mypage_extension.sql`の原因は`cannot_determine`のままlegacy evidenceへ固定する。`portfolio_profiles`は廃止、baseline対象外、active参照除去で決定済みであり、原因確定をbaseline blockerにしない。
3. Natori以外のremote未記録migrationについて、table/view/function/policy/grant/extensionの完全定義差分を取得する。
4. version重複6グループの対応表とchecksumをレビューする。順序を確定できない同一commit内fileは`cannot_determine`のままlegacy archiveへ置き、架空のtimestampを割り当てない。
5. data migration 4件について、対象行数、前提条件、事後条件、再実行時の作用を検証環境で記録する。
6. repair候補ごとに「現在定義の証拠SQL」「期待checksum」「repair後のhistory期待値」を用意する。
7. broad Storage INSERT、`processed_stripe_events` grant、`natori_delete_project`、`card_requests`/`aura_projects` RLSは独立した`20260723111741_baseline_security_hardening.sql`へ実装済み。Pattern B/Cのpositive/negative testとsecurity reviewer承認は未完了。
8. schema-onlyのdry-runと、代表データを入れたapplication/E2E dry-runを分けて実施する。
9. `hybrid`方式、baseline spec、Pattern A/B/C runbookを承認する。

## 6. Supabase Branchまたは検証環境の準備条件

最低条件は次のとおり。

- 本番projectと同じPostgres major/minor、必要extension、Auth/Storage schema互換性を持つ。
- 本番データを持ち込まない場合でも、Natoriの代表fixtureを用意する。少なくともundecided inquiry、quote前、accepted quote、paid、completed、archived、legacy completedを含める。
- Storage bucket 3件と`storage.objects` policy/grantを含め、private/publicとsigned URLの挙動を検証できる。
- Vercel Previewまたは専用検証deployをbranchへ接続し、本番URL/keyと混在しない。
- branch作成直後のschemaを本台帳のcatalog queryで再取得する。remote historyが不完全なため、「main projectからbranchを作れば本番schemaが再現される」と仮定しない。
- 次の順でrehearsalする: 現状再現、history正規化、schema diff 0確認、idempotency確認、application smoke/E2E、rollback rehearsal。
- branch ID、project ref、作成時刻、適用したcommit SHA、実行者、全SQL出力を保存する。

Supabase Branchの利用可否は今回確認できていない。Branch一覧APIがpermission validation時のproject-ref欠落エラーを返したため、管理画面または権限を修正したAPIで別途確認する。

## 7. backup / PITR確認事項

本番操作を承認する前に、次を証跡付きで確認する。

- 現在planでdatabase backupとPITRのどちらが有効か。
- retention期間、最古/最新のrestore可能時刻、最新backup成功時刻。
- history repair直前に利用できるrestore pointまたはbackup ID。
- DBだけでなくStorage objectをどう復旧するか。database backupはStorage object本体の代替ではない。
- restore先、必要権限、想定RTO/RPO、復旧後のVercel接続切替方法。
- 少なくとも検証環境でrestore rehearsalが成功していること。

参照: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)

現時点では有効状態とrestore可能時刻を確認できていないため、gateは閉じたままとする。

## 8. rollback責任者に必要な情報

rollback責任者には少なくとも次を渡す必要がある。

- 対象Supabase/Vercel project IDとproject ref。
- release commit SHA、migration filename/version/checksum、repair対象version一覧。
- 実行前後の`schema_migrations` snapshotとcatalog diff。
- backup IDまたはPITR restore point、retention、復旧手順、必要権限。
- 変更ごとのforward-fix SQLとrollback SQL。不可逆DMLの場合は復元手順。
- application compatibility範囲、feature flag、Vercel rollback対象deployment。
- 中止条件: schema diff、RLS/ACL異常、RPC smoke失敗、Storage upload漏れ、quote/payment/delivery不整合。
- 監視query、log/alert、観測期間、意思決定者と連絡経路。
- restoreとforward fixのどちらを選ぶかの基準、RTO/RPO。

責任者、実行者、承認者は分けて明記し、少なくとも二者レビューにする。

## 9. セキュリティrelease gate

今回修正していないが、公開前に独立して判断が必要な項目:

| 項目 | 現状 | release条件 |
| --- | --- | --- |
| Storage INSERT policy | `public`、`WITH CHECK true`、bucket条件なし | bucket/owner条件へ限定し、anon upload negative testを通す |
| `processed_stripe_events` grant | anon/auth/serviceに全権限、RLS policyなし | service-only grantへ揃え、Advisor再確認 |
| `natori_delete_project` | service-only SECURITY DEFINERだが物理DELETE | soft-delete方針との整合を決め、不要なら無効化または置換 |
| `card_requests` RLS | disabled、anon/auth全権限、`session_token`あり | access modelを決めてRLS/policy/grantを同時に整備 |
| `aura_projects` RLS | disabled、anon/auth全権限、`session_token`あり | access modelを決めてRLS/policy/grantを同時に整備 |
| Advisor | 上記公開、processed policyなし、Natori unused index | security ERROR/WARNをreviewし、performance項目は実測で判断 |

RLSはpolicy設計なしに単独で有効化すると既存フローを遮断し得るため、今回はDDLを適用していない。

## 10. Phase 1 migration作成可否

### 最終判定: `まだ作成不可`

理由:

1. remote historyがlocal 55ファイルのうち2 versionしか記録していない。
2. 6グループのversion重複があり、同一commit内の一部は順序を確定できない。
3. `portfolio_profiles`のtarget domain処置は廃止で決定したが、recordedな`20250124`の部分適用状態はlegacy historyの不整合証拠として残る。
4. data migration 4件とNatori以外のunrecorded migrationが `cannot_verify` のままである。
5. baseline SQLとlocal file checksumは作成済みだが、Pattern B適用後のexpected normalized schema checksumは未確定である。
6. Supabase Branch/検証環境でのPattern B/C dry-runとrollback rehearsalが未実施である。
7. backup/PITRとrollback責任者が`operator_confirmation_required`である。

blockerを解消し、検証環境で「history正規化後のschema diffが0」「既存Natori flowの回帰なし」「rollback rehearsal成功」を確認した時点で、Phase 1 migration作成可否を再判定する。

P0-02 ADRの決定内容は変更しない。今回は検証用migration fileをローカル作成したが、migration repair、接続DBへのDDL/DML、history変更は行っていない。

## 11. 本番history変更可否

### `検証環境でPattern Bのみ実行可能`

remote-only recovery、normalization proposal、baseline/security artifact、legacy archive、manifest、fixture、checksum/diff、Pattern B/C helperは揃った。別project refの検証環境を準備した後のPattern Bへ進める。本番history変更は、Pattern B成功、review済みPattern C SQLとrollback手順、expected checksum確定、backup/PITR/Storage restore確認、責任者割当まで禁止する。

旧55 migrationは`supabase/legacy-migrations/`へarchive済みで、移動前後のraw-byte SHA-256は全件一致した。active laneはbaselineとsecurity hardeningから始まり、active version重複は0である。Pattern Cは`blocked_missing_reviewed_history_transition_sql`が現blockerである。

## 12. local artifact validation

2026-07-23に次を実行した。

| check | result |
| --- | --- |
| `node scripts/etorie-baseline-static-check.mjs` | pass。active 2、legacy 55、archive path/size/SHA-256、remote-only 3、active順序・重複0、manifest checksumを確認 |
| `npx tsc --noEmit` | pass |
| `npm run lint` | pass。既存ファイル由来のwarningは残るがerror 0 |
| `npm test` | pass。38 files / 435 tests |
| `npm run build` | pass。169 static pages生成 |
| Pattern B helper dry-run | pass。fake non-production ref、active 2 / legacy 55 / duplicate 0を確認し、実SQL適用なし |
| Pattern C helper guard | pass。review済みSQL未指定時に`blocked_missing_reviewed_history_transition_sql`で停止 |
| Supabase CLI read-only help | pass。v2.98.2で`migration`、`migration list`、`db`のhelpを確認 |
| `supabase migration list --local` | `not_run_no_local_stack`。127.0.0.1:54322への接続が拒否され、linked/remote接続なし |
| PostgreSQL migration parse/apply | `not_run_no_test_environment` |
| RLS/RPC/Storage positive-negative test | `not_run_no_test_environment` |
| schema checksum/diff against database | `not_run_no_test_environment` |

build/lintの既存warningは本artifactのblockerではない。PostgreSQL実行試験が未完了のため、production gateは閉じたままである。

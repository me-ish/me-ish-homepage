# エトリエ P0-01 migration history dry-run runbook

作成日: 2026-07-23（JST）
status: procedure only / 未実施

## 1. 目的

schema baselineとhistory切替が、fresh replay、current-state互換、application運用、rollbackの全てで成立することを、production以外で検証する。

本runbookはSupabase Branch/projectの作成、SQL適用、history repairを承認しない。環境が別途準備され、operator/approver/rollback ownerが確定した後に使用する。

## 2. 使用可能な環境

優先順:

1. productionのschema-only/current-state cloneを安全に作れるSupabase Branch。
2. productionと同じPostgres major、必要extension、Auth/Storage互換性を持つ専用verification project。
3. pinned Supabase CLIのlocal stack。platform差があるためAの補助とし、production相当の最終証拠には単独で使わない。

必要条件:

- production ref `lvnfspyainrxtztjytbo`とは異なるproject ref。
- project nameに`p0-01-dry-run`と日付を含める。
- Vercel Previewだけを接続し、Production envを変更しない。
- production data、key、service-role keyをdocument/logへコピーしない。
- PostgreSQL `17.6.1`と同一versionを第一選択とし、不可能な場合は同一majorで差分riskを記録する。
- CLI version、Docker image/version、Postgres version、commit SHAを固定する。
- extensionはbaseline spec記載の`citext`、`pgcrypto`、`uuid-ossp`、`pg_stat_statements`、`pg_graphql`、`pgsodium`、`supabase_vault`のavailability/schema/versionを確認する。
- Authはtest user、provider、redirect URL、SMTP/CAPTCHA/hook設定をverification専用にし、production user/settingsをcopyしない。
- Storageは9 bucketの設定とpolicyをverification用に再現し、test objectだけを使用する。
- Branchがmain schemaを完全複製すると仮定せず、作成直後にcatalog snapshotを採る。

必要な環境変数名:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- server-side Supabase key変数（repoで使用する正式名称を実行前に確認）
- `NATORI_OWNER_USER_ID`（非productionの専用Auth test user ID。未設定でownerを一意解決できない場合はNatori server APIが500となる）
- Stripe test modeのpublishable/secret/webhook変数
- verification用site URL
- mail sandbox変数、または送信無効flag

値はverification専用secret storeへ設定し、本runbookやartifactへ出力しない。正式な変数名一覧とownerは`operator_confirmation_required`。

fixture方針:

- production rowをcopyしない。
- Natoriのinquiry、quote前、accepted quote、paid、completed、archived、legacy completedを匿名IDで用意する。
- 現行baselineではP0-02のnullable amount/due_dateと`undecided` typeをまだ導入しないため、「undecided相当」は現行互換値で表現する。Phase 1 fixtureは承認済みadditive migration後に別途追加する。
- Card/AURA/portfolio/Stripe webhook用にもtest-only fixtureを用意する。
- data migrationの実行事実をfixtureの現在値から推定しない。

## 3. 共通preflight

| check | required evidence |
| --- | --- |
| operator | 氏名/連絡先 |
| approver | operatorと別担当 |
| rollback owner | 復旧判断権限を持つ担当 |
| target guard | verification project refとproduction refが不一致 |
| source commit | exact Git SHA |
| CLI | exact version、checksum、実行host |
| baseline artifact | reviewed SQL checksum。現時点は未作成 |
| legacy evidence | local 55 file checksum、remote 5 row export、recovery docs |
| backup | dry-run targetのrestore方法 |
| fixture | 匿名test dataのみ |
| Storage | bucket configとtest object。production objectなし |

target refがproduction refと一致したら即時中止する。

## 4. 共通snapshot

実行前後に次を保存する。

- `schema_migrations`: version、name、statement count、statement checksum。
- relation/column/default、constraint、index、trigger、view definition。
- RLS、policy、table/view/function ACL。
- function identity arguments、body、SECURITY DEFINER、search_path、EXECUTE ACL。
- extension name/schema/version。
- bucket config、`storage.objects` policy、bucket別object count。
- table別row count。個人データ内容は保存しない。
- Advisor結果。
- application deployment IDとVercel env target。

queryは`etorie-p0-01-baseline-spec.md`のread-only validation contractを使う。

## 5. Pattern A: repair方式

経路:

```text
空DB
→ 正規化済み過去migration
→ remote-only migration
→ 全migration適用
→ schema比較
```

目的: 案Aを採用した場合に、過去migrationだけからcurrent production schemaを再現できるか検証する。

前提:

- duplicate 27 fileへ一意versionと順序が確定している。
- remote-only 3 SQLをreview済みmigration artifactとして用意している。
- data migrationのfixture、precondition、postcondition、再実行作用を個別承認している。
- 現在`cannot_determine`の同一commit内順序が残るため、この前提は満たされていない。

手順:

1. empty verification environmentを準備する。
2. normalized legacy migrationを一意version順で適用する。
3. recovered remote-only 3 migrationを元のremote version/orderに従って適用する。
4. 残る全post migrationを適用する。
5. data migrationごとに対象row、変更row、postconditionを記録する。
6. current production catalog snapshotと全categoryを比較する。
7. 同じ手順を2回目のempty環境で再現し、determinismを確認する。
8. migration再実行/idempotencyはthrowaway copyでのみ確認する。

checks:

- duplicate version/orderが0。
- remote-only card/auraのcolumn/default/constraint/indexが一致。
- function identity/body/ACL、RLS/policy/grant、trigger、Storageが一致。
- data migration結果がfixture expectationと一致し、想定外rowを変更しない。
- `20250124`の承認済みtarget処置と結果が一致。

成功条件:

- 説明不能なschema diff 0。
- 2回のfresh replayでmanifest checksum一致。
- migration再実行がreview済み範囲で安全。
- 全application E2E pass。

現在の判定: `cannot_determine`順序とdata migration証明が未解消のため実施不可。比較案としてのみ保持する。

## 6. Pattern B: baseline方式

経路:

```text
空DB
→ baseline
→ baseline-security-hardening
→ baseline後migration
→ fixture
→ schema比較
```

目的: legacy 55 migrationをreplayせず、reviewed baselineから新規環境を再現できること。

手順:

1. empty verification environmentを準備する。
2. Supabase managed schema/roles/extension availabilityを記録する。
3. `20260723111730_etorie_baseline.sql`を適用する。
4. 間を空けず`20260723111741_baseline_security_hardening.sql`を適用する。baseline単体では続行判定しない。
5. bucket設定とStorage policyを確認する。
6. baseline後migrationをversion順に適用する。
7. 専用Auth test userを作成し、guard付き匿名fixtureを投入する。
8. Previewの`NATORI_OWNER_USER_ID`を専用Auth test user IDに設定する。値はartifactへ記録しない。
9. checksumを取得し、review済みreference snapshotとdiffする。
10. Vercel Previewを接続し、smoke/E2Eを実行する。
11. `migration list`と`db push --dry-run`でpending 0を確認する。
12. environmentを破棄する前に全artifactを保存する。

checks:

- table/view/function/policy/grantの期待checksum一致。
- missing dependency、順序error、duplicate object errorが0。
- Natori baseline objectがcurrent targetと一致する。remote-only card/aura定義とconditional hardeningはfull current-state cloneのPattern Cで確認する。
- Natori quote/payment/delivery/portfolio flowが成功。
- `portfolio_profiles`がschemaとactive runtimeの双方に存在しない。
- Storage private/public/signed URLのpositive/negative test。
- Auth test userのRLS境界。

owner解決のpreflight:

- login済みSupabase userがある場合は、そのuser IDを最優先で使用する。
- login userがなく`NATORI_OWNER_USER_ID`が設定済みの場合は、その値を使用する。
- いずれもない場合は`natori_user_profiles`、`natori_projects`、`natori_events`から各table最大10行の`user_id`を探索し、取得成功した行のunionがexactly 1 ownerのときだけ解決する。query errorとなったtableは探索結果へ含まれない。このfallbackは全件監査ではないため、Pattern B smoke testでは依存せず専用ownerを明示する。
- 既存ownerが0件または複数なら解決結果はnullとなり、ownerを必要とするNatori server APIはHTTP 500と`NATORI_OWNER_UNRESOLVED_MESSAGE`を返す。Pattern Bの空DB/fixture作成前後はこの経路に該当し得る。
- 本番反映前にVercel production環境で`NATORI_OWNER_USER_ID`の設定有無をoperatorが確認する。今回のローカル検証ではVercelへ接続していないため、これは`operator_confirmation_required`の未確認blockerである。

成功条件:

- catalog checksumがreview済みexpected値と一致。
- 説明不能なschema diff 0。
- baselineより前のlegacy migrationが実行されていない。
- row fixture以外のdata dependencyがない。
- 全smoke/E2E、Advisor reviewがpass。

## 7. Pattern C: 現行本番相当からのupgrade

経路:

```text
現在状態を再現
→ history正規化
→ Phase 1予定差分
→ application regression
```

目的: current schema/dataを変えずにhistoryをbaselineへ切り替え、その後のPhase 1差分とapplication release/rollbackをend-to-endで検証する。

手順:

1. production current-stateを再現したverification cloneを準備する。
2. pre-snapshotを取得する。
3. legacy remote history 5行をexportし、checksumを確認する。
4. 承認予定のhistory normalization procedureを実行する。
5. baseline markerの期待状態を確認し、schema/data/Storage diff 0を確認する。
6. P0-02 ADRに従うPhase 1予定migrationを適用する。
7. post-snapshotを取得し、説明可能なPhase 1差分だけであることを確認する。
8. Vercel Previewを接続しapplication smoke/E2Eを行う。
9. application rollback、Phase 1 rollback/forward fix、history rollbackをrehearseする。
10. recovery後にchecksum、row count、Storage、historyを再確認する。

checks:

- history切替だけの段階では`schema_migrations`以外のschema/data/storage diff 0。
- Phase 1後は承認済み差分だけ。
- baselineより前のlegacy migrationがpendingへ戻らない。
- function identity/body/ACL、RLS/policy/grant、index、trigger。
- Natori form、project create、quote、accept、Stripe test mode、webhook dedup、delivery、archive/restore、legacy project display。
- anon/authenticated不要accessなし、service-role flow正常。
- Vercel rollback後の旧application互換性。

成功条件:

- history正規化時の説明不能diff 0。
- Phase 1差分が設計どおり。
- legacy flow回帰なし。
- rollback rehearsal成功、RTO/RPO内。
- CLI/hosted CI間でpending判定一致。
- operator以外のapproverがartifactを確認。

## 8. application smoke/E2E

最低限:

- owner解決preflight: login user、`NATORI_OWNER_USER_ID`、既存dataからの一意解決の各経路と、解決不能時のHTTP 500をverification環境で確認する。
- Natori: inquiry作成、task更新、quote発行/承認、manual/Stripe payment記録、delivery、archive/restore、portfolio公開/非公開、reference upload/signed URL。
- Stripe webhook: 同一eventのdedup、失敗時retry、`processed_stripe_events`のservice-only access。
- Card/AURA（Pattern Cのみ）: session tokenによるowner access、public slug/public id、upload/signed URL、unauthorized negative case。
- Existing portfolio: `portfolio_settings` read/write、作品visibility、`portfolio_profiles` target decisionに対応する挙動。
- admin/audit/payout:必要view/RPCをauthorized roleだけが利用できること。

実決済、実メール、production Storageは使用しない。Stripe test mode、mail sandbox、test bucketを使う。

## 9. abort criteria

次のいずれかで直ちに中止する。

- target refがproductionと一致。
- checksum対象外のschema/data変更。
- legacy migrationがpendingとして実行対象になる。
- duplicate version、remote-only missing、history primary key conflict。
- row countまたはStorage object countの予期しない差。
- RLS/ACL negative test失敗。
- Natori payment/quote/delivery整合性の破損。
- rollback artifact、owner、restore pointのいずれかが欠ける。
- CLIとhosted CIのmigration判定が不一致。

## 10. 記録template

```text
run_id:
pattern: A | B | C
target_project_ref:
source_commit:
baseline_checksum:
cli_version:
postgres_version:
operator:
approver:
rollback_owner:
started_at_utc:
finished_at_utc:
pre_manifest_checksum:
post_manifest_checksum:
history_pre_checksum:
history_post_checksum:
storage_manifest_checksum:
e2e_result:
advisor_result:
rollback_result:
decision: pass | fail
artifact_location:
```

## 11. 現在の実施可否

- Pattern A: 順序不明とdata migration証明未完了のため実施不可。
- Pattern B: active lane固定とarchive検証が完了。別project ref、Auth test user、reference snapshotが未準備のためDB実行は未実施。
- Pattern C: review済みhistory transition SQLとrollback SQLが存在しないため`blocked_missing_reviewed_history_transition_sql`で停止する。

現時点で可能なのはartifact reviewと、production ref以外の検証環境を準備した後のPattern B実行である。Pattern Cはreview済みSQLが揃うまで実行不可である。

## 12. helper command

通常はdry-runで計画だけを出力する。実行時は`ETORIE_TARGET_PROJECT_REF`、`ETORIE_DATABASE_URL`、`CONFIRM_NON_PRODUCTION=YES`をverification専用secret storeから渡す。値をlogへ出力しない。

```text
node scripts/etorie-baseline-pattern-b.mjs --project-ref <non-production-ref> --reference-snapshot <normalized.json>
node scripts/etorie-baseline-pattern-c.mjs --project-ref <non-production-ref> --history-rehearsal-sql <reviewed.sql> --history-rollback-sql <reviewed-rollback.sql>
```

実行には`--execute`を追加する。production ref `lvnfspyainrxtztjytbo`または同refを含むDB URLはhelperが拒否する。fixture Auth user IDは`00000000-0000-4000-8000-000000000001`とし、verification Auth APIで事前作成する。SQLは`auth.users`を変更しない。

verification hostにはSupabase CLIと`psql`を用意する。CLIがPATH外の場合は`SUPABASE_CLI_BIN`へ実行ファイルpathを設定する。Pattern Bは`supabase/baseline/manifest.json`とactive directoryの一致、active/legacy件数、active version重複0、baseline/hardening順序を開始時に検査する。その後、legacy 55件を含まない一時active migration sourceを作り、CLIの`db push --dry-run`成功後にactive migrationだけをhistory-awareに適用する。

Storage object本体のfixtureはSQLへ埋め込まない。`natori-inquiry-refs`と`natori-deliveries`へ小さなダミーPNGを正規のserver/signed-upload経路で投入し、path、size、MIME、signed URL期限を記録する。

## 13. archive後の事前確認

1. `npm run check:etorie-migrations`が成功すること。
2. `supabase/migrations/`の先頭2件がbaseline、hardeningで、active version重複が0であること。
3. `supabase/legacy-migrations/`のSQLが55件で、active側に同名fileがないこと。
4. `artifacts/legacy-migration-archive/verification.json`が`allChecksumsMatch: true`であること。
5. `supabase migration list --local`相当をverification hostで確認し、legacy versionがpendingに現れないこと。
6. target project ref、DB URL、`CONFIRM_NON_PRODUCTION`の3 guardを確認すること。
7. Pattern Cはreview済みhistory transition SQLとrollback SQLの両方がない限り開始しないこと。

# エトリエ P0-01 migration history戦略比較

調査日: 2026-07-23（JST）

## 1. 推奨

`hybrid`

ここでのhybridは、active migration historyを現在schemaの新規schema-only baselineへ切り替えつつ、既存55ファイル、remote 5行、remote-only回収SQL、checksum、Git evidenceを削除せずlegacy archiveとして保持する方式を指す。53件を個別repairする方式との混用はしない。

本書は方式提案であり、production historyの変更承認ではない。今回、repair、baseline登録、DDL、DML、migration file変更は実行していない。

## 2. 前提事実

- local: 55 migration file、34 unique version、6 duplicate-version group。
- remote: 5 history row。localと一致するのは2 version、remote-onlyは3 version。
- remote-only 3件は`schema_migrations.statements`からSQL本文を回収済み。
- local-onlyの多くはcurrent schemaへ反映されているが、data migrationの実行経路は証明できない。
- `20250124`はrecordedだが、現行DBでは`portfolio_profiles`群だけ不在。
- duplicate group内の一部は同じGit commitで追加され、file間順序を確定できない。

## 3. 方式比較

| 比較軸 | A: repair existing history | B: create new baseline | hybrid評価 |
| --- | --- | --- | --- |
| production risk | 53 local-only versionを大量にhistoryへ追加し、誤分類を固定化する | 1つの検証済みbaseline markerへ集約できるが、history切替自体は重大操作 | B寄り。production実行はbackup/rehearsal後だけ |
| fresh replay reproducibility | duplicate version、順序不明、remote-only欠落で現状のまま再現不可 | current catalogから依存順のschema-only replayを作れる | baselineを唯一のactive replay pathにする |
| audit/history preservation | file単位の古い履歴を保ちやすいが、実行事実を推測repairする危険 | active historyは短くなる | legacy archive、checksum、remote row snapshotで監査証拠を別保存 |
| data migrations | 実行済みか不明なDMLをapplied扱いにする誤りが起きる | schema-only baselineから除外できる | DMLはevidence ledger/fixtureへ分離 |
| remote-only migrations | 3 local file欠落を補う必要がある | current target schemaへ統合可能 | recovered SQLはarchiveし、baselineはcurrent catalogから生成 |
| duplicate versions | version単位historyではfile単位repair不能 | 解消できる | legacy orderを捏造せず最終schemaをbaseline化 |
| CLI behavior | `migration list`はtimestamp比較のみ。重複fileを区別できない | clean active historyなら通常CLI workflowへ戻せる | pinしたCLIでbranch上のlist/dry-runを確認 |
| CI/branching | hosted/local CLI差や大量repair stateをCIが解釈できない可能性 | baseline+post-baselineの単純な直列にできる | hosted previewを含めて検証 |
| rollback | history rowを多数戻す必要があり、誤り位置の特定が難しい | baseline切替前history snapshotへ戻す操作は大きいが範囲は限定 | pre/post snapshotとrestore rehearsalを必須化 |
| implementation effort | 全55 fileの完全同値・DML・順序検証が必要 | catalog dump reviewとfresh replayが中心 | baseline作成に集中し、legacyは証拠保存 |
| misclassification impact | `repair_candidate`の誤判定が将来ずっと隠れる | baseline object漏れがfresh replayで検出可能 | diff 0とapplication E2Eをgate化 |
| long-term maintainability | 8/12桁legacy version、重複、欠落が残る | 14桁一意versionへ統一可能 | baseline以後を一意14桁・append-onlyにする |

## 4. Aを採用しない理由

1. repairはschemaを変更せずhistory rowだけを変更するため、誤った`applied`判定を検出してくれない。
2. duplicate versionは同じversionに複数SQLがあり、remote historyの1行でどのfileを表したか保持できない。
3. 同一commit内の順序不明fileへ架空のtimestampを割り当てる必要が生じる。
4. data migration 4件は現在値から実行経路を証明できず、repairは推測になる。
5. `20250124`の因果が未確定で、全履歴を正しい過去の再現として扱えない。

## 5. hybridの構成

### Legacy evidence lane

- 現在の55 migration fileはGit commitとchecksumで凍結し、内容を変更しない。
- remote 5 history rowはversion、name、statements、checksumを切替前にexportする。
- remote-only 3 SQLは`docs/migration-recovery/`で保存する。
- duplicate mappingは`etorie-p0-01-version-normalization-plan.md`で保存する。
- data migrationは「実行済み」と推定せず、目的、対象条件、現在のpostconditionだけを記録する。

### Active migration lane

- current production target schemaからschema-only baselineを1本生成する。
- baseline以後のmigrationだけをactive replay対象にする。
- baseline versionと以後のversionは一意な14桁UTC timestampにする。
- Storage bucket row、Auth/platform settings、seed/fixture、data backfillをschema SQLと分離する。
- security correctionはbaselineへ混在させず、独立した`baseline_security_hardening`を直後に必須適用する。2本の間へ通常migrationを挟まない。

## 6. 将来のproduction切替案

以下は実行順の設計であり、現時点では全て禁止である。

1. change freeze、責任者、承認者、rollback ownerを確定する。
2. remote 5 history rowと全catalog、bucket、policy、grantをpre-snapshotする。
3. 検証環境でcurrent-state cloneとfresh databaseの両方にbaselineを検証する。
4. fresh databaseでbaseline replay後のschema checksumが期待値に一致し、app E2Eが成功することを確認する。
5. current-state cloneでhistoryだけを切り替え、schema diff 0、row count不変、Storage object count不変を確認する。
6. rollback rehearsalを成功させる。
7. productionでは承認済みrunbookどおりに、旧remote historyを保存したうえでactive baseline markerへ切り替える。
8. 切替後、`migration list`、`db push --dry-run`、catalog checksum、E2E、Advisorを再確認する。

手順7はmigration historyを変更するため、現gateでは実行不可である。

## 7. 採用条件

- `etorie-p0-01-baseline-spec.md`の全項目がレビュー済み。
- 3パターンのdry-runが成功。
- backup/PITR、Storage別backup、restore rehearsalが確認済み。
- 完了: `portfolio_profiles`は廃止し、baseline対象外、active参照除去済み。`20250124`の原因確定は採用条件にしない。
- 完了（artifactのみ）: broad Storage INSERT、`processed_stripe_events`、hard-delete RPC、card/aura RLSのtargetを独立hardening migrationへ実装。
- CLI version、CI path、Supabase hosted branching behaviorが固定・検証済み。

## 8. 現時点の許可範囲

検証環境用baseline、security hardening、manifest、fixture、checksum/diff、Pattern B/C helperを作成済み。許可できるのは別project refでのPattern Bまでであり、production history変更、baseline登録、通常の`db push`は許可しない。Pattern Cはreview済みhistory transition SQLとrollback SQLが揃うまで実行不可とする。

## 9. legacy archiveとactive laneの確定

- 旧local migration 55件はSQL本文、filename、versionを変更せず`supabase/legacy-migrations/`へarchiveした。
- 移動前後のraw bytesに対するSHA-256、size、filenameは全55件で一致した。証跡は`artifacts/legacy-migration-archive/`に保存する。
- `supabase/migrations/`はactive laneであり、先頭は`20260723111730_etorie_baseline.sql`、直後は`20260723111741_baseline_security_hardening.sql`である。
- legacy 55件はevidence-onlyまたはunsupportedであり、通常のreplay対象にしない。
- remote-only 3件は`docs/migration-recovery/`とmanifestで保存し、active migrationを新規作成しない。
- baseline以降の正規migrationだけをactive laneへappendする。active versionの重複は許可しない。
- archive後も本番DB、本番migration history、Storage、Vercel環境変数は変更していない。

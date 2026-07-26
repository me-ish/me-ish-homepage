# エトリエ P0-01：Supabase・migration ベースライン

更新日: 2026-07-23（JST）
対象リポジトリ: `me-ish/me-ish-homepage`
対象ブランチ: `main`
確認対象 Supabase project ref: `lvnfspyainrxtztjytbo`
プロジェクト名: `me-ish's Project`
リージョン: `ap-northeast-1`
状態: `ACTIVE_HEALTHY`
PostgreSQL: 17.6.1

## 1. 判定

**調査完了。本番history変更は未許可。**

実DB、主要Natoriオブジェクト、migration history、Security Advisor、Performance Advisorの読み取り確認は完了した。

Vercel Productionの`NEXT_PUBLIC_SUPABASE_URL`と`SUPABASE_URL`は、どちらも`https://lvnfspyainrxtztjytbo.supabase.co`であることを確認済みである。keyやsecretは取得していない。

接続先照合は完了したが、history正規化、baseline dry-run、backup/PITR、rollback ownerのgateが残るため、migration repair、baseline登録、DDL適用、通常のmigration pushを行ってはならない。

## 2. 確認済みの事実

### 2.1 接続プロジェクト

| 項目 | 値 |
| --- | --- |
| project ref | `lvnfspyainrxtztjytbo` |
| name | `me-ish's Project` |
| region | `ap-northeast-1` |
| status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1` |
| created_at | `2025-03-02T09:18:50.983652Z` |

ローカルlink、Supabase project、Vercel Productionの2つのSupabase URLが同じproject refを示すことを直接照合済み。

### 2.2 Natori主要オブジェクト

実DBには少なくとも以下が存在し、現行アプリの主要フローと整合している。

- `natori_projects`
- `natori_project_tasks`
- `natori_inquiry_reference_files`
- `natori_quotes`
- `natori_payment_transactions`
- `natori_order_mail_logs`
- `natori_delivery_files`
- `natori_pricing_configs`
- `processed_stripe_events`

主要RPC:

- `natori_create_project_with_tasks`
- `natori_issue_quote`
- `natori_accept_quote`
- `natori_confirm_manual_payment`
- `natori_record_stripe_payment`
- `natori_update_task_and_status`
- `natori_delete_project`

実DBの主要制約・関数は、GitHub上の2026年7月20日前後のNatori hardening migrationと概ね一致する。

### 2.3 migration history

実DBの `supabase_migrations.schema_migrations` で確認できた履歴は5件。

- `20250120`
- `20250124`
- `20260214050324`
- `20260223113216`
- `20260225122344`

一方、GitHubにはNatori関連migrationとして、少なくとも以下が存在する。

- `202607200001_natori_beta_safety.sql`
- `20260720102549_harden_natori_rpc_privileges.sql`
- その他、2026年5月23日から2026年7月20日までのNatori migration群

したがって、**実体は存在するがmigration historyへ記録されていないオブジェクトがある**。

### 2.4 migrationに関する結論

通常の `supabase db push` / migration pushをそのまま行ってはならない。

理由:

- 既存テーブル、関数、制約、ポリシーを再作成しようとして衝突する可能性がある
- 同名オブジェクトでも、定義の完全同値性が保証されていない
- 誤ったmigration repairは、未適用変更を適用済みとして隠す

採用方針:

1. 本番project refを手動確定
2. 実DB schema/function/policy/grant/bucket snapshotを保存
3. ローカルmigrationごとに実DBとの同値性を確認
4. 同値性が確認できたversionだけを履歴調整候補にする
5. Supabase Branchまたは検証DBでdry-run
6. Phase 1差分だけが残ることを確認
7. 本番backup/PITRとrollback責任者を確定後に適用

## 3. セキュリティ・Advisorベースライン

### 3.1 Natoriに直接関係する重要事項

#### Critical: Storageの広すぎるINSERT policy

`storage.objects`にbucket条件なしでINSERTを許しうるpolicyが存在する。

影響:

- `natori-inquiry-refs`
- `natori-deliveries`
- その他同一project内のbucket

読み取り公開を直接意味しないが、匿名または広いroleから不要なobjectを書き込まれる可能性がある。

対応:

- 全Storage upload callerを棚卸し
- browser直uploadが必要なbucketとservice-role uploadだけのbucketを分類
- bucket IDと認証主体を限定したpolicyへ置換
- Natori private bucketへのanon直接INSERTを拒否
- 変更はPhase 1 schema migrationと分離する

#### High: `processed_stripe_events`

- RLS enabled
- policyなし
- Advisorはanon/authenticatedからGraphQL schema上で発見可能と警告
- anon/authenticated grantの見直しが必要

推奨:

- service-role専用であることを確認
- anon/authenticatedの不要なtable privilegeをrevoke

#### High: `natori_delete_project`

実DBには物理削除RPCが残る一方、アプリの現行運用は`deleted_at`によるsoft delete。

推奨:

- 呼び出し箇所がないことをコードとログで確認
- EXECUTE revokeまたは関数削除
- UI削除経路をarchive/restoreへ統一

### 3.2 Natori外だが同一project上の重大事項

Security Advisorは以下をERRORとして検出した。

- `public.card_requests`: RLS disabled
- `public.aura_projects`: RLS disabled
- `public.aura_projects.session_token`: RLSなしでAPI露出の可能性
- `public.card_requests.session_token`: RLSなしでAPI露出の可能性

これらはエトリエPhase 1の直接変更対象ではないが、同一Supabase projectの安全性に関わるため、別セキュリティチケットとして扱う。

### 3.3 Performance Advisor

Natori関連では複数のindexが「未使用」と報告された。

例:

- `natori_projects_active_owner_due_idx`
- `natori_projects_deleted_owner_idx`
- `natori_order_mail_logs_quote_id_idx`
- `natori_payment_transactions_quote_id_idx`
- `natori_projects_active_quote_id_idx`
- `natori_projects_payment_quote_id_idx`

現時点ではデータ量と稼働期間が小さいため、未使用という理由だけで削除しない。Phase 1のクエリ形が固まった後に再評価する。

## 4. 型ベースライン

GitHub内にSupabase Database型が2系統ある。

- `src/types/supabase.ts`: 実DBの最新Natori構造に比較的近い
- `src/lib/supabase/database.types.ts`: Natoriの新しいquote/payment/delivery関連が不足

判定:

- 生成元を1つに統一する必要がある
- Phase 1 schema適用後に実DBから再生成
- application固有のJSON型は共有Zod schemaからinferし、生成型の`Json`だけを直接信用しない

## 5. P0-01 release gate

以下を全て満たすまでPhase 1 DB migrationを実行しない。

- [x] 本番Vercel環境のproject refが`lvnfspyainrxtztjytbo`であることを確認
- [x] 実DBの主要Natori table/RPC/constraintを確認
- [x] 実DBのmigration historyを取得
- [x] GitHub上に未記録のNatori migration群があることを確認
- [x] Security Advisorを取得
- [x] Performance Advisorを取得
- [x] 全ローカルmigrationと実DB objectの同値性台帳を作成（不明は`cannot_verify`）
- [ ] repair/baseline方式をレビュー承認
- [ ] Supabase Branchまたは検証DBでdry-run
- [ ] backup/PITR、適用者、rollback責任者を確定
- [ ] dry-run後のschema diffがPhase 1差分だけであることを確認

## 6. 次の実作業

### P0-01A：環境照合（完了）

以下の接続元を照合し、project ref一致を確認した。

- Vercel Production environmentの`NEXT_PUBLIC_SUPABASE_URL`
- server-only `SUPABASE_URL`
- Supabase dashboardで本番ドメインとprojectを照合

期待値:

```text
https://lvnfspyainrxtztjytbo.supabase.co
```

秘密鍵やservice-role keyの値は文書・チャットへ貼らない。

### P0-01B：migration同値性台帳

各ローカルmigrationについて以下を記録する。

| version | filename | 実DB object | 同値 | remote history | 処置 |
| --- | --- | --- | --- | --- | --- |
| 例 | xxx.sql | table/function/policy | yes/no/partial | present/missing | repair/baseline/apply |

### P0-01C：検証環境dry-run

- 本番データを持たないSupabase Branchまたは検証projectを使用
- migration historyを承認方針どおりに再現
- migration dry-run
- schema diff、RPC identity、ACL、RLS、Storage policyを比較

## 7. 完了定義

P0-01は、次の状態で完全完了とする。

> 正しい本番project refが確定し、ローカルmigrationと実DB objectの対応が説明可能で、検証環境のdry-runによりPhase 1の意図した差分だけが生成されることを確認済みである。

現在は「DB/接続先調査済み・baseline dry-run/rollback準備待ち」であり、本番history変更は未許可である。

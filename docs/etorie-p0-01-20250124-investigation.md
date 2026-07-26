# エトリエ P0-01 `20250124_mypage_extension.sql` 調査

調査日: 2026-07-23（JST）
対象project ref: `lvnfspyainrxtztjytbo`

## 1. 最終判定

`cannot_determine`

現行schemaがmigration内容の一部だけを保持していることは確定したが、「初回適用が途中で終わった」のか、「全適用後に`portfolio_profiles`だけが削除された」のか、「historyが手動記録された」のかを一意に示す証拠がない。

baseline ledgerの`partially_applied`は現在のobject存在状態を表す。一方、本書の`cannot_determine`はその原因と正しい履歴処置を確定できないことを表し、意味を分ける。

## 2. 確定した事実

### 2.1 remote historyとSQL

- remote historyにversion `20250124`、name `mypage_extension`がrecordedである。
- `schema_migrations.statements`には31 statementが保存されている。
- 保存SQLには`portfolio_profiles`、2 index、trigger、RLS、4 policy、commentに加え、`likes`、`entry_view_events`、`entry_view_stats`の全定義が含まれる。
- statement配列をLFで連結したUTF-8列のSHA-256は`034218c843f92a69166dc831bb63bd93c05197d413a423eaded8d9702da0db89`である。
- archive pathにある現在の正準Git blob byte列のSHA-256は`a47df960080e1e562425b05c997f18fa6d56a8dafbfe4c9bdb9a2ad0b06bcab2`である。これをauthoritative checksumとする。`.gitattributes`の`supabase/** -text`により現在のworking tree raw byte列も同一だが、属性適用前のCRLF working treeやtext読込後の値はauthoritativeではない。remote historyのstatement配列表現とはchecksum対象が異なるため、2値の直接一致は期待しない。

### 2.2 Git履歴

- `20250124_mypage_extension.sql`は元の`supabase/migrations/`へcommit `7a11343499ec4b8394d7cae1bc126a244d42455d`、author date `2026-01-23T21:54:20+09:00`で追加された。現在はSQL本文・filename・versionを変えず`supabase/legacy-migrations/`へarchiveしている。
- `git log --follow`では追加後の変更commitは検出されなかった。
- 全branchを対象に`portfolio_profiles`のDROP、table rename、`portfolio_settings`への移行を行うmigrationは検出されなかった。
- 現在のmigration群には`portfolio_settings`をCREATEするSQLも検出されない。一方、実DBには`public.portfolio_settings`が存在する。

### 2.3 現行DB

| migration object | 現行DB |
| --- | --- |
| `public.portfolio_profiles` | 不在 |
| `idx_portfolio_profiles_slug` | 不在 |
| `idx_portfolio_profiles_user` | 不在 |
| `public.likes` | 存在 |
| `public.entry_view_events` | 存在 |
| `public.entry_view_stats` | 存在 |

`portfolio_profiles`が不在のため、そのtrigger、RLS、policy、constraintも存在しない。残る3 object群は現在のDBで利用されている。

### 2.4 DDL監査証跡

- `pgaudit`等のaudit extensionはインストールされていない。
- `sql_drop` event triggerは存在するが、関数定義はPostgREST schema reloadまたはGraphQL schema version更新用であり、削除objectを履歴tableへ保存しない。
- `auth.audit_log_entries`はAuth audit、`public.admin_audit_log`は後発のアプリ管理操作用であり、過去DDLの一般監査ログではない。
- 接続ツールで取得できるPostgres logは直近24時間のみであり、2026年1月前後のDDLを検証できない。

したがって、手動DROPが行われたことも、行われなかったことも証明できない。

## 3. transaction / 部分適用可能性

### 事実

- migrationファイル自体に明示的な`BEGIN`/`COMMIT`はない。
- remote historyには全31 statementの本文が保存されている。
- 当時使用したSupabase CLI version、`db push`かSQL Editorか、手動history登録かは記録から確定できない。

### 推論

- 標準的な一括実行で全statementとhistory記録が原子的なら、初回の途中適用より、後日のDROPのほうが説明しやすい。
- ただし、当時の実行経路とtransaction境界が不明なため、この推論を事実扱いしない。
- `schema_migrations.statements`に全文があることは「そのSQLが履歴へ保存された」証拠であり、各statementのcommit成功を個別に証明しない。

結論: 初回の部分適用可能性は否定できないが、肯定もできず`cannot_verify`である。

## 4. rename・統合・後継tableの調査

### 事実

- `src/lib/portfolio/queries.ts`は`portfolio_settings`を公開設定のsource of truthと明記し、`getPortfolioSettings`/`upsertPortfolioSettings`で使用する。
- 同じfileは`portfolio_profiles`をslug/mode/AURA連携の将来用途として残し、`getPortfolioProfile`、`getPublicPortfolioBySlug`、`isSlugAvailable`、`upsertPortfolioProfile`を定義する。
- `PortfolioSettingsClient.tsx`は初期表示時に`getPortfolioProfile`を実際に呼ぶが、設定保存は`upsertPortfolioSettings`へ送る。
- `getPublicPortfolioBySlug`、`isSlugAvailable`、`upsertPortfolioProfile`のrepo内呼び出しは検出されなかった。
- account delete routeには`portfolio_profiles`がAuth user削除にCASCADEするというコメントが残る。
- `portfolio_settings`と`portfolio_profiles`は列集合が異なる。前者は公開表示名、bio、contact、works filter、sort key等、後者はpublic slug、mode、AURA request link等を持つ設計であり、schema上の単純renameではない。

### 推論

- 公開ON/OFFと表示設定については`portfolio_settings`が実運用上の後継である可能性が高い。
- slug/mode/AURA連携については`portfolio_profiles`の契約がコードに残るため、domain全体が完全にsupersedeされたとは断定できない。
- 現行UIの初期readはtable不在エラーを内部でnullへ落とすため、表面上動作していても不要性の証明にはならない。

結論: `superseded_by_other_table`を採用できるだけの完全な対応関係はない。

## 5. 7観点の判定

| 観点 | 結果 |
| --- | --- |
| 1. later deletion | Git migration、永続DDL auditの証拠なし。`cannot_verify` |
| 2. rename/integration | 明示renameなし。`portfolio_settings`は一部機能のsource of truthだが非同型 |
| 3. Git SQL changes | 追加後の変更を検出せず |
| 4. transaction/partial | 実行経路とCLI version不明。`cannot_verify` |
| 5. manual DDL audit | 保存型監査なし。過去log取得不可 |
| 6. app references | 1つの現行UI read、複数helper、delete commentが残る。save先は`portfolio_settings` |
| 7. domain need | 公開設定は`portfolio_settings`。slug/mode/AURA契約を廃止するか復元するか未決 |

## 6. dry-run前に必要な決定

1. product/application ownerが、slug/mode/AURA連携を廃止するか保持するか決める。
2. 廃止する場合は、`getPortfolioProfile`の現行呼び出し、未使用helper、type、account delete commentを別changeで整理する。
3. 保持する場合は、`portfolio_profiles`をcurrent target schemaに含める設計を別migrationとしてレビューする。過去SQLの無検証再適用はしない。
4. `portfolio_settings`の生成元と正本DDLをDB catalogからbaselineへ取り込む。
5. いずれの場合も`20250124`をrepair対象として再実行・revert扱いせず、legacy evidenceとして保持する。

本調査ではDDL、DML、history repair、migration file変更を行っていない。

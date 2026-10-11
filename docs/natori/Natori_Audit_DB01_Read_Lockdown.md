# DB-01 旧作品の匿名参照と証明書の権限迂回を止める修正

2026年10月12日。監査対象main `9abcd131`からの修正。

## 問題と変更後の動作

旧`entries`の公開作品向けSELECT policyは行だけを限定し、メール・内部属性の列も匿名roleへ返す。本番カタログでは匿名とauthenticatedにテーブルSELECTがあり、SELECT向けrestrictive policyはなかった。顧客の実値は取得していない。

今回の追加migrationは匿名とPUBLICのテーブル・列SELECTをrevokeし、匿名SELECTを拒否するrestrictive policyを加える。authenticatedには既存のSELECTを残し、既存の全permissive policyと交差する本人限定policyを追加する。

本人判定はAuthのuser IDを使う。既にuser IDが紐付いた作品ではそのIDが優先する。user ID未設定の旧記録だけ、Authのメールで照合できる。subjectなしのメールだけや編集可能なuser_metadataでは権限を得られない。

### 証明書経路の追加修正

初回コミット`aa0cce6e`はDB権限の遮断だけを対象にした。ユーザーの指摘で、`/cert/[id]`は無効・欠落トークンでも`issueReissueLink`を呼んでservice roleで閲覧リンクを発行し、`getEntryForCoA`の`select('*')`結果をClient Componentへ渡すことを確認した。DBの匿名権限を止めても、このサーバー経路には効かない。初回確認の「token検証後の証明書参照を保持」という説明だけでは安全性を示せていなかった。

今回、ページ表示中の再発行を削除した。無効・欠落・別作品のトークンでは作品を取得せず、問い合わせ先だけを案内する。再発行は従来の管理用ヘッダー認証に限定し、APIだけでなく発行関数自身でも実行時に認証する。購入者向けの自己再発行機能は追加していない。`CERT_REQUIRE_TOKEN=0`も検証を迂回できなくした。URLの安全な整数IDとトークンのentry IDを一致させ、one-time設定時は未使用リンクの条件付き更新が成功した場合だけ許可する。

証明書のDB取得列とブラウザへ渡すDTOを`id,title,artist_name,edition_total,created_at,confirmed_at`の6列に限定した。取得関数とページの両方で明示的に投影し、メール・user ID・external user ID・原画像URLなどを除外する。`server-only`境界を付け、関連診断APIも同じ管理認証で保護し、生のDBエラーや環境設定を返さない。証明書URLは解析除外・noindex・no-referrer・private/no-storeの対象にする。

実顧客の証明書・トークン・作品内容は取得していない。読み取り専用の本番メタデータ確認では`cert_links`は存在し、`v_cert_links_active`は存在しなかった。このため、本番で全列取得まで到達したとは断定しない。存在しないviewの作成、検証失敗時の元表へのfallback、旧ダウンロード機能の再開は行わない。正規リンクの通し確認は、viewの期限・失効条件を確認できる隔離環境へ引き継ぐ。

## 残存機能の確認

| 経路 | 既存の参照方法 | 修正後 |
| --- | --- | --- |
| `/settings/bank` | browserのauthenticated、user_idまたはemailからexternal_user_idを取得 | 本人の紐付け済み・未紐付け記録を参照可能。他人の紐付け済み記録は拒否 |
| 証明書 `src/lib/coa/server.ts` | service roleでentriesを参照。初回は無効tokenの自動再発行と全列転送を見落としていた | tokenとURL ID一致が必須。自動再発行なし。6列のDTOのみ。既存server権限そのものは保持 |
| 領収書 `/receipt/[sessionId]` | serverのservice roleでsalesとentriesを参照 | 既存server権限を保持 |
| 旧管理記録・精算・account削除 | server管理クライアント | 既存server権限を保持 |
| entriesを参照する3つのview | 本番はsecurity_invoker=true | 元表の本人限定を継承 |
| ナトリのフォーム・制作管理・Storage | natori専用表とbucket | 本migrationの変更対象外 |

旧ギャラリーの公開DB参照を再開しない。公開作品情報を再開する別要件が生じた場合も、内部列を含む元表の匿名SELECTを戻す方法は使わない。

## 追加ファイルと生成方法

- `supabase/migrations/20261011221028_lockdown_legacy_entries_reads.sql`
- Supabase CLI2.81.3の`migration new lockdown_legacy_entries_reads`で生成。
- 既存31migrationと凍結baselineのbytes/checksumは保持し、manifestに新migrationだけ追加。
- 現行RLS・identity列・既存owner/server権限をpreflightで確認。読取可能なdefiner/materialized viewや残存の匿名継承権限があれば、処理を止めてtransactionをrollbackする。
- 既存policyの削除、既存行のDML、Storage操作、roleやsecretの作成はない。再適用は既存policyを検出して拒否する。

## 検証

ローカルは一時的なPGlite0.3.14（PostgreSQL17.5）で、コミットするfixture/before/checks/catalog SQLと実migrationを実行した。製品依存は追加していない。外部DB・決済・メールは使っていない。

確認済み：匿名と他ownerの内部列参照を修正前に再現。修正後は匿名のtable/column/count/invoker-viewを拒否。本人のuser_idと未紐付けemail、2人目と無関係者、subjectなし、emailなし、user_metadata差し替え、既存INSERT/UPDATE停止、service-roleの証明書・会計参照、ナトリ・金融・Storageのfixture行とカタログ維持を確認。匿名へ広いGRANTを戻してもrestrictive policyが行を拒否する。

RLSなし、公開されたdefiner view、想定外の継承権限、再適用、非postgres実行を拒否した。継承権限をpostconditionで検出した場合もACL・policy変更が残らないことを確認。

専用CI `Legacy entry read security`はネットワークなし、TCP待受なしの一時PostgreSQL17.6コンテナで同じSQLを検証する。実行の成功と対象headはPRのchecksに紐付ける。これはREST・GraphQL・実Authの全工程を実行した証拠ではない。

証明書は全て架空データ・モックDBで回帰検証する。旧実装に対するページ/サーバー31テストでは21件失敗・10件成功を確認した。修正後は無効tokenの発行/参照停止、URL ID差し替え拒否、全列データが誤って戻ってもDTO/Client propsへ流れないこと、明示的な管理者だけの再発行、未設定認証の拒否、DB/view障害時のfail closed、one-timeの競合、証明書URL/Referrerの解析拒否を検証する。これらは実Supabaseの期限・失効viewを実行した証拠ではない。

ローカルの関連6ファイル103テスト、TypeScript `--noEmit --incremental false`、変更範囲のESLint、`git diff --check`は成功。全体のユニットテストと最新headのCI結果はPRの説明と引き継ぎ記録に残す。初回`aa0cce6e`では15種類のworkflowが成功したが、その結果を追加修正後のCI成功とは扱わない。

## 本番反映と完了条件

PRマージだけではDB権限は変わらない。最新本番SHAとカタログ、バックアップ、本人照合条件を確認し、承認されたDB反映作業でこの追加migrationだけを適用する。全migrationを再実行しない。

反映後は`has_any_column_privilege('anon','public.entries','SELECT')=false`、2つのrestrictive SELECT policy、既存authenticated/service-role SELECTをread-onlyで確認。隔離環境のREST/GraphQL直接アクセスと本人/他人のテストを通し、証明書・口座設定を通常の権限で確認する。実データを無作為に読み出して動作試験しない。

本番の修正完了には、適用migration記録、対象SHA、事後権限と正規閲覧の確認を残す。現時点のローカル検証は本番のP0解消を意味しない。

rollbackで匿名SELECTを戻すと漏洩経路を再開する。正規機能に不具合が出た場合は匿名遮断を維持し、本人照合またはserver経路を前進修正する。緊急の権限復旧が必要でも、取得しておいたbefore ACLをレビューし、公開の全列SELECTを無条件にrestoreしない。

## dot側Workへの引き継ぎ

このWorkはPR #162のDB-01と証明書経路の修正・テスト・PR保存で停止する。新しい改善項目、マージ、本番DB適用、本番デプロイは行わない。PR更新に伴う既存連携の自動Previewビルドは、本番反映と区別して記録する。

引き継ぐ未完了事項は、レビュー/マージ判断、隔離環境での実Auth・REST/GraphQL・正規証明書の通し確認、対象viewの期限/失効条件、承認された本番DB適用とコード反映、反映後の権限確認。値を共有しない形で`ADMIN_API_TOKEN`の設定有無と期限/one-time設定を確認し、管理者が再発行前に購入者照合する。元表の全列公開や無効リンクの自己再発行を復旧手段として使わない。

## dot側Workの受入追試（2026年10月12日）

引き継ぎ元HEADは`49e3a5b68f560d2aca2e72d259c15c8afe972216`。PR #162はDraft・未マージで、同HEADの16 workflowはPhase 5の再実行を含め全成功を確認した。Phase 5の初回失敗原因を解明した証拠とは扱わない。この追試の変更後HEADには新しいCI結果が必要。

AstraのP2指摘を架空データで再現し、次を追加修正した。

- private definer viewを公開wrapperやmaterialized viewで包むと、旧preflightは見逃してmigration後も匿名roleが内部5行を参照できた。ACLのない中間viewも含めて依存を再帰的に調べ、危険な公開終端があればtransactionを拒否する。公開invoker wrapper、authenticatedへ公開した間接materialized copyの拒否と、純粋なinvoker chainの本人限定参照を検証し、専用CI fixtureにも追加した。既に本番適用済みのmigrationを書き換えたものではない。
- 証明書URLへ`natori-key`を付けると、正しい/不正なキーの早期returnでprivacy headersが欠落した。共通の応答処理を両分岐へ適用し、キーなし・正しいキー・不正キー・locale redirectを検証した。管理者認証自体の変更ではない。

### 実サービスを使った隔離検証

このexecutorが新規作成した内部Docker network、tmpfs上のPostgreSQL17.6、GoTrue2.196.0、PostgREST14.17、公式pg_graphql1.6.2だけを使用した。Supabaseの大きなDB imageは展開容量制約で取得できず、公式pg_graphqlのPG17版を専用PostgreSQLへ追加した。署名鍵・管理ヘッダー・Authユーザー・作品・口座は全て架空。外部SMTPは到達不能なローカル宛先とし、顧客情報取得、本番接続、既存テストprojectの起動は行っていない。フルSupabase復元環境・本番同一サービスversionの検証とは区別する。

| 対象 | 結果 |
| --- | --- |
| 実Auth→REST/GraphQL | 変更前の匿名取得を再現し、変更後はREST権限拒否・GraphQL collection取得不可。本人UIDと未紐付けemailだけ許可、別ownerと無関係者を拒否 |
| user_metadataと未確認email | 実Auth APIでmetadataを変更しtokenを更新しても他人の参照権限を得ない。未確認emailはパスワードloginでsession発行拒否 |
| 口座の識別ID | 画面と同じUID lookup、未紐付けemail lookupでexternal_user_idを取得可能 |
| 実証明書view | schema.sqlの実定義をSQL実行し、旧migrationに合わせsecurity_invoker=true・service-only grantとした。正常hex/base64、期限切れ、期限境界、失効、使用済み、別作品を検証。expires_at=NULLは元定義通り許可 |
| ONE_TIME | 8並行claimの成功は1件だけ。その後の再利用拒否、別作品URLでは消費しないことを実DBで検証 |
| 正規発行とHTTP | 管理ヘッダー付き発行→実view→6列取得→実Next devのHTML/RSC返却が成功。欠落/無効tokenと無認証/誤認証の発行は件数不変 |
| ブラウザへ渡す情報 | 実HTML/RSCで内部email・payment session・画像URLの架空canaryがないことを確認。RSCはtext/x-component応答 |
| privacy | 実HTTPでキーなし/不正/正しいキー、locale redirect、証明書HTML/RSCへno-referrerとno-storeが付く |

証明書の実SDK/DB検証は11件成功（frameworkのserver-only markerだけをテスト環境用に解決し、DB・SDK・viewはモックしていない）。HTTP検証では外部font取得のみfixtureに置き換え、製品route・middleware・service・RSCの実装を使用した。ブラウザ実機、旧作品ファイルdownloadの再開、証明書PDFのブラウザ操作は対象外。active viewがない本番の正規リンクを復旧したという意味ではない。失効/期限変更とclaimが同時に発生する別の競合仕様までは検証していない。

### 残る受入条件

口座表はアーカイブのserver-only方針をそのまま再現すると、ブラウザauthenticatedのread/saveを変更前後とも拒否した。DB-01による差分ではないが、正規口座保存の互換性確認完了とは扱わない。運用上の正規保存経路と承認済みの現在カタログが必要。今回、許可policyを追加して通すことや本番の口座値/権限取得は行っていない。

引き継ぎ報告で存在しないとされたv_cert_links_activeの復旧、正規リンクの運用方針、承認された本番適用と事後確認は引き続き別途必要。P0は本番適用まで解消扱いにしない。SEC-01/SEC-01Bの製品実装は始めていない。

修正後のローカル全unitは237ファイル/2,295件成功（maxWorkers=2）。初回の既定並列では既存PortfolioEditorの2件が5秒timeoutとなったが、単独2件成功と低並列全体成功を確認した。関連6ファイル108件、TypeScript noEmit、変更範囲ESLint、baseline静的検証（32 active/55 archived）、diff checkも成功。型・Lintの実行後に製品コードの追加変更はない。架空の隔離コンテナ/networkとNext devを片付け、元checkoutのbranch/HEAD/差分を保持した。

[受入の記録](../artifacts/pr162-acceptance/README.md)に秘密値を含まない結果と実行viewを保存した。監査原文Libraryの全文564行と引き継ぎPageは読取可能だった。Libraryの正規ファイル転送は通信拒否となり、このexecutorに保存したのは全文読取の記録（原本bytesの取得成功とは扱わない）。

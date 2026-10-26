# 非本番の案件読み取り統合検証

実ページ `/natori/dashboard/cases` とGET `/api/natori/admin/case-workspace` を、既存の管理認証・固定readerへ接続する検証。
両経路はdevelopment/testのみ有効。productionでは無効で、既存ダッシュボードや操作ボタンは変更しない。

## 接続契約

正式forward migrationは`supabase/migrations/20261020224935_natori_case_workspace_read.sql`。
`scripts/natori-case-preview/readContract.ts`と既存の固定SELECTから生成したSQLを、単体テストでバイト単位に照合する。
将来のSQL変更は新しいforward migrationで行い、適用済みファイルを書き換えない。
今回の実行先はnetwork-none・ポート公開なし・tmpfsだけの所有ラベル付き隔離PostgreSQL。
実サービスへの適用・権限反映は行わない。
2関数はSTABLE / SECURITY INVOKER / search_path=''、実行許可は所有者の権利を除きservice_roleだけ。
PUBLIC/anon/authenticatedの実行不可、service_roleへのgrant optionなし、既存テーブル権限変更なし。
同一トランザクション内で権限を検査し、余分な明示EXECUTE権限やブラウザroleの継承権限が残る場合は失敗させる。
同名関数が存在する場合も上書きせず全体をロールバックする。
アプリの既存サーバー資格情報を使い、ブラウザへ渡さない。新しい資格情報・認可の例外・任意SQLの実行口は追加しない。

50案件を上限とする。超過は取得不能を返し、切り詰めた一覧を完全な一覧として返さない。
同じSQL応答の全owner/IDを検証してから既存readerとadapterに渡す。
表示名・登録納期は同じスナップショットのprojectから取得し、未登録の納期を補わない。

## 再現

Node 22、既存node_modules、ローカルに既存のPostgreSQL17イメージとChromiumが必要。
実サービスへのアクセスやimage pullは行わない。

```sh
node scripts/natori-case-app-read/build-fixture.mjs /tmp/meish-case-app-read
node scripts/natori-case-app-read/run.mjs /tmp/meish-case-app-read
```

検証先はlocalhostの4184/4185のみ。既存プロセスが使っている場合は停止せず検証を止める。
fixtureアプリは実ページ・API・dashboard layout・認証ヘルパーと、固定バージョンのSupabase SDKをそのまま使用する。
全アプリ環境変数は起動時に架空値だけを指定する。元チェックアウトの.env類を読み込まない。
AuthとPostgRESTのHTTP応答部分のみローカルで模擬し、SQLは実PostgreSQLのREAD ONLYトランザクションで実行する。
fixture生成バンドルにだけ認証モジュールの未使用スタブを置く。Next検証アプリの認証コードには差し替えを行わない。

縮小schemaはreaderが使う列だけで構成する。既存migrationのreplayや、本番schema/trigger/functionの同等性検証ではない。
架空8案件、他owner1案件、情報の一部が上限を超える相談記録を生成する。本番データをコピーしない。
生成したSQLではなく正式migrationファイルを適用する。広いfixture既定権限からの遮断、余分なroleへの既定権限・
継承権限・同名関数の衝突によるロールバック、owner分離、同一snapshot、50/51件境界を確認する。
適用前後のテーブル定義/制約/トリガー/ACL、RLS/ポリシー、schema/default ACL、role属性/所属、業務行の不変も比較する。

検証後は自分が作ったNextプロセス群とHTTPサーバーを終了し、所有ラベルを照合して自分のDBコンテナだけ削除する。
`migration-results.json`、`integration-results.json`、`applied-migration.sql`、`next-dev.log`、`cleanup.json`、PC/mobile画像を出力先に保存する。

## 未検証

実GoTrueの署名検証・セッション更新、PostgREST本体、通常アプリ全体のmiddleware/ルーティング、実サービスのschema/権限、iPhone実機。
実Authへの受入には指定された非本番環境が必要。今回の成功を本番公開の受入完了とは扱わない。

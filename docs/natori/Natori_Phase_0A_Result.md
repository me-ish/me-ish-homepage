# Natori Phase 0A Result

作業日: 2026-09-27。状態: 実装と隔離実Storage試験が完了。本番適用は未実施、Draft PRでレビュー待ち。

## 開始点とPhase T

- Phase T Draft PR [#95](https://github.com/me-ish/me-ish-homepage/pull/95) を最終レビューし、ユーザー承認に基づきmainへ取り込み済み。
- PR95レビュー開始時main: `21d4e34587d062cebe361acfb6557ad15daa69e3`。
- Phase 0A開始main/merge SHA: `e59e48ae51544217fdd141840b3b754200bd90cf`。PR95最終head: `a639a41199edc06f8db63bcd47a5ffaa74e72aa1`。
- PR95 ready後のPhase T再実行 [36284336717](https://github.com/me-ish/me-ish-homepage/actions/runs/36284336717) 成功。main側CI [36284495914](https://github.com/me-ish/me-ish-homepage/actions/runs/36284495914) 全ジョブ成功。Vercelの通常自動Production配信も同じmerge SHAでREADYを確認した。
- 作業ブランチ: `codex/natori-phase-0a`。Phase 0Aは [Draft PR #96](https://github.com/me-ish/me-ish-homepage/pull/96) で止める。本番適用・本PRのmergeは未実施。

## 実装

F01/NEW-01に対応する4つのPUBLIC書込policyを閉じる前提として、匿名ギャラリー応募をprivate署名upload→server画像検証→artworks新規保存へ移した。案件管理フローは変更しない。相談TUSは署名を検証する専用endpointへ接続する。

新private bucketのadditive migrationと、既存4policyを削除する承認guard付きcutover SQLを分離した。後者は自動migration対象外。既存のbucket公開性、object名、URL、token、Auth、quote、支払、納品、受取、相談の業務行を変更しない。

詳細な操作行列、定義照合、テスト/再実行、移行順序、rollbackは [Phase 0A runbook](../../scripts/natori-phase-0a/README.md) を参照。

## 検証結果

実装検証head: `c14cd8ea29969a43a6d62943b8072abe5d596e4e`。Actionsがcheckoutして実際に試験したPR merge ref SHA: `64a7589641e71cf330b4a605f603494d1143fa27`。報告書追記後の最終head/checksはPR #96の記録も参照。本報告の試験結果を別SHAの結果と混同しない。

| 実行 | 結果 | 内訳 |
| --- | --- | --- |
| [Phase 0A run 5](https://github.com/me-ish/me-ish-homepage/actions/runs/36286735855) | 成功 | 135件成功 / 失敗0 / skip0 |
| 上記の隔離接続試験 | 17 / 0 / 0 | 本番風URLの通信前拒否、子プロセス・IPv4/IPv6・DNS遮断 |
| 現行policy | 35 / 0 / 0 | 匿名書込・第三者更新削除の再現と正常経路 |
| 互換コード、policy変更前 | 24 / 0 / 0 | 実API/service・画像実体・実tus-js-client |
| 限定policy | 35 / 0 / 0 | 匿名書込/第三者操作拒否、正常主体成功、既存リンクと実体の保全 |
| 互換コード、policy変更後 | 24 / 0 / 0 | 改ざん・画像検証・公開・再送・race・TUS再開 |
| cutover否定試験（135件と別集計） | 2成功 | 承認フラグ欠落、同名policy定義driftの両方を拒否、部分削除なし |
| [Phase T回帰](https://github.com/me-ish/me-ish-homepage/actions/runs/36286735877) | 成功 | 元の87件を維持 |
| [CI](https://github.com/me-ish/me-ish-homepage/actions/runs/36286735856) | 全5ジョブ成功 | unit/component 1,151件、型検査・lint・audit成功。E2E 15成功 / 失敗0 / 既存4 skip（新規2件成功） |

DB/Auth/Storage/Kongの起動、11bucketと全policy/GRANT/RLSの一致、切替後13policy、後始末exit=0まで確認した。egress evidenceは許可した隔離API:8000への通信と拒否8packetを記録し、IPv6 OUTPUTはDROP。結果artifact 14ファイルを読み取り、JWT/secret-key形の文字列を含まないことも確認した。

artifact: `natori-phase-0a-36286735855-1`、ID `10919949343`、ZIP SHA256 `c384ca1350c9920d4c7a995f089edf9468738a5832eabd0d23b1cdabdf69a183`、保存期限2026-10-04。期限後もrunbookの同じworkflow/fixtureで再実行可能。

### 現行設定と限定設定の比較

| 操作 | 現行再現 | 限定policy適用後 |
| --- | --- | --- |
| 既存10bucketへの匿名任意INSERT | 成功してしまう | 拒否、実体未作成 |
| artworksへの第三者PUT/DELETE | 他人の実体が変更/削除される | PUT拒否、DELETEは対象なし。元のbytesを維持 |
| avatar/banner所有者操作 | 成功 | 成功。第三者の更新・削除拒否を維持 |
| 管理service CRUD・copy・processing-meta | 成功 | 成功 |
| 公開画像、private署名読取、切替前発行リンク | 成功 | 同じファイルbytesを取得可能 |
| 新gallery署名経路・JPEG/PNG公開・finish再送/競合 | 成功 | 成功。任意path・改ざん・不正画像は拒否 |
| 新private仮置きへの署名なし書込 | 旧PUBLIC INSERTがあっても拒否 | 拒否 |
| 相談signed TUS（6MiB超・再開） | 成功 | 成功。HEADで再開offsetを検証 |

実API/serviceは製品moduleを直接読み込み、実Storageへ接続した。HTTP web server/実ブラウザとの結合は通信mockのPlaywright試験と分けている。製品コードのStorage mockで135件を代替していない。本番gateway・実メール・Stripe・iPhone実機・顧客案件の全E2Eは未検証。

### 使用バージョン

Node 22.23.2（既存 `.node-version`）、Supabase CLI 2.118.0、Docker 28.0.4、GitHub ubuntu-24.04 image 20260920.314.1、Postgres 17.6（image 17.6.1.171）、Auth v2.197.0、Storage v1.77.0、PostgREST v16.3、Kong 2.8.1。SDK 2.76.1 / tus-js-client 4.3.1 / sharp 0.35.4 / esbuild 0.28.1。製品package/lockfile変更なし（lock SHA256 `9535aebeec49c6c2ee7a2b4dd2cf6a11b728018805606798b13863560f808e7a`）。

実行時image digest:

| image | SHA256 |
| --- | --- |
| Storage | `3999cfa4f3286f945fa68069fc9b8b6bf3929a6bd53916dcf2e8c209801173c0` |
| Auth | `1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b` |
| Postgres | `658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9` |
| PostgREST | `ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962` |
| Kong | `1b53405d8680a09d6f44494b7990bf7da2ea43f84a258c59717d4539abf09f6d` |
| Node | `48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9` |


### 試験中に修正した点

- migration管理台帳への新規1件の追加（既存の台帳一致テストを維持）。
- バージョン収集時のpackage exports制限を避け、インストール済みpackage metadataから取得。
- 実APIを読み込むtest bundleで、Reactの実験的なreact-server条件を外した。製品APIのserver-only境界は維持。
- ブラウザ試験で、規約の末尾までスクロールする既存の操作手順を追加。UIの同意条件は変更なし。
- storage-jsのdownload失敗はJSONを解決せずHTTP Responseをラップするため、試験側で元HTTP応答を確認。private bucketの秘匿404と、実際の不存在・通信失敗を混同しない。service/署名readの同一bytesをpositive controlにする。

失敗した実行を成功扱いにはせず、修正を通常commitで積み上げた。専用試験・既存CIのskipやcontinue-on-errorは追加していない。

## 変更ファイルの範囲

- 製品: `FormWrapper.tsx`、`ConsultationThread.tsx`、`consultationUploadEndpoint.ts`、`src/app/api/entry/upload/route.ts`、`src/lib/entryUpload.ts`・`entryUploadClient.ts`、`src/lib/server/entryUploadGrant.ts`・`entryUploadService.ts`。
- DB定義: 新規1migration、既存 `supabase/baseline/manifest.json` への1件追記、`supabase/operations/natori-phase-0a/restrict-storage.sql`。
- 試験: `scripts/natori-phase-0a/` の専用fixture/build/catalog/integration、既存Phase T runnerへの選択式hook、専用workflow、receiptと相談UIのテスト、`e2e/entry-upload.spec.ts`。
- 文書: 本報告書とrunbook。全23ファイルの正確な差分はPR #96に記録。既存CI workflow・依存関係・業務tableは変更していない。

## 本番への残課題

1. 全カタログの直前再照合とColab鍵のrole確認（値は表示しない）。
2. 新private bucket追加→互換コード配信→正常経路確認→policy切替の個別承認。コードよりbucketが先。
3. cloud Storage gatewayのsigned TUS/CORS、iPhone Safari、中断再開を許可された架空データで確認する手順の合意。
4. 仮置きファイルの容量監視・残留対応担当と切替時の古いタブ再読込案内。

既存案件・実作品・実tokenでの試験、本番policy変更、本番bucket追加は行っていない。Phase Tの承認済みmergeによる通常の自動配信と、Phase 0Aの未承認本番適用を区別する。

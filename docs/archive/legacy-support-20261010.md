# 旧公開サービス整理の引き継ぎ・管理画面の縮小

## 開始時点

2026-10-10にGitHubを確認。mainはPR #151後の`4a5133e339417390dfe6ba8a1e930f14ac4b8dfb`。
旧環境の作業ツリーは未コミット変更なし。ローカル`6762ac28`と公開PR #152の
`7dd073633c9c6e4e6ef9e7c65f1cc565e4237f57`はコミットIDが異なるがtree差分なし。
PR #152は未マージであり、今回の指示に従ってdraftへ変更した。
別worktreeでPR headを引き継ぎ、本番mainは変更しない。
元の会話URLの本文を取得した扱いにはしていない。整理計画の第21版、GitHub、作業ツリーを根拠にした。
#135と#103〜#110は別目的のdraftであり、今回マージ・閉鎖しない。

## PR #152に残っていた検証失敗

- `7dd07363`のCI `38039511846`: 型・Lint・2,013単体成功。
- E2E: 89成功・19失敗・1再試行後成功・2既存skip。日本語終了案内を期待する19件が、
  en-US既定のブラウザによるlocale negotiationで英語表示を受けていた。
- 日本語テストに`locale: ja-JP`を明示し、英語URLのテストは維持。
  トップ転送はサーバーredirect/初回コンパイルの完了を待って正確な最終URLを検査する。
- Security Audit: 既知のbraces GHSA-vfj7-8cjw-p6xm、9 high。保留を継続。
- 同headのNatori Phase 0A/0B/N/1/2A/2B/2C/2D/3A/3B/4/5/6A/6B/7は全成功。
  今回の追加変更の検証結果とは区別し、最終headの結果をPRに記録する。

## 追加整理

- 管理トップから停止済みの審査・展示集計と存在しないusers/settingsへのリンクを除く。
  ナトリ管理、共通問い合わせ、精算、過去作品、お知らせの入口は保持する。
  集計エラーを0件と誤表示しない。
- `AdminEntriesClient`を既存の認証付きGETで過去作品を確認する画面に縮小。
  作品・作家・ID検索、画像、販売数、価格、連絡先、既存作家詳細と精算への導線を保持。
  停止済みの承認・却下・再審査・展示開始・新Checkout・一括処理を除く。
- 旧server actionの公開関数と引数を保持し、常に既存の休止エラーのみ返す。
  到達不能な認証値読取やHTTP書込みを除く。
- コメント・いいねGET/POST、閲覧POSTを無副作用の503/no-storeへ変更。
  閲覧GETの既存405は保持。管理読取とナトリAPIは従来の境界を維持。
- 未参照のgallery helper一式、コメント型、useIsMobileを保全して除く。
  廃止したfloat日次選択の単体16ケースは実装とともに保存。ナトリの試験は削減しない。
- OpenAIの唯一の実importが旧コメントAPIだったため直接依存openaiを除去。
  lockから除くのはopenaiの1 entryのみ。残るpackageオブジェクトは全件不変。

## この整理単位で保持したもの（後続変更は下記参照）

ナトリの公開・フォーム・管理・通知・決済・納品、Etorieデモ、認証、DB接続、
Stripe Webhook、証明書、領収書、既存購入の読取/履行/返金/精算、銀行設定、問い合わせ、
過去のお知らせ・法的文書、全DB/Storage、migration・Phase fixtureを保持する。
本番AURAにpaidレコード2件がある。公開終了を既存の決済対応終了とは扱わない。
ナトリ/root/body/フォント/Analytics/Webhook/認証/専用Phase/workflowのソース差分はない。
旧upload adapterはPhase 0Aの安全性試験が実importするため保持する。

## 復旧・ローカル検証

- 追加変更の基準`7dd07363`。元ファイルのblob・bytes・SHA256は
  `legacy-support-20261010-manifest.json`。基準から全件再取得・ハッシュ照合。
- PR #152前半の155原本・84,442,968 bytesもmain固定SHAから再取得し照合した。
- 通常の復旧はrevert PR。本番データを過去のDBで上書きしない。
- 生成CSSは今回の変更前後で同じTailwind/PostCSS/Autoprefixer条件を使用。
  64クラスをsafelistで保持。`@tailwind base/components/utilities`入力の生成結果は
  200,675 bytes、SHA256 `2e1f2b69a467ba368f6d9024a5653255aad2923973d328ccf3484cd8fa3693d6`で一致。
  PR前半の207,412 bytesは別の生成入力であり、同じ計測値とは扱わない。
- ローカル型・Lint成功（news既存警告2件）。単体214ファイル・2,011件成功。
  変更内訳: 2,013件から廃止済みfloat16件を除き、無副作用10件・停止境界1件・管理読取3件を追加（コメントGETの既存ケースは終了仕様へ移行）。
- ASTによる追跡JS/TS 904件のimport/export/literal import/require照合で未解決0件。
- ローカルChromiumは配布ファイルの取得失敗で未実行。CIのブラウザ結果を別途確認する。
- DB/Storageの保存・候補・復元条件は[専用台帳](cleanup-data-retention-20261010.md)。

## 本番前の確認

最終headの通常CI・専用Phase・Previewを照合し、成功/失敗/未検証をPRへ追記する。
本番反映にはユーザーの確認が必要。DB・画像の永久削除はこのPRに含めない。
手動確認経路: `/` → ナトリ作品 → 依頼フォーム、旧float/whiteの終了案内、
管理ログイン → `/admin` → 旧作品検索/作家詳細/問い合わせ/精算。

## 後続の承認による更新

本資料の検証基準は`77247025`までです。その後、所有者が旧支払いは本人のテストで削除可能と明示しました。
従ってpaid2件だけを理由としたAURA/CARDの保持判断は解除し、専用APIと旧商品のWebhookを追加整理しました。
「Webhookに差分なし」は本資料の単位に限った記録です。現在の変更と保持境界は
[追加台帳](legacy-test-payments-20261010.md)を参照してください。

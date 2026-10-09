# 未参照コードと設定の整理（2026-10-09）

基準: `4bec943c722e0d9c6257e855ec258bacfbc05379`（PR #141）。
PR #142 の依存2件の整理とは独立した変更。#133・#135を取り込まない。

## obsolete thirdweb設定

package/lock、現行アプリ、スクリプトにthirdweb本体やimportは存在しない。
ルートの `thirdweb-defaultTokens-shim.ts` と `thirdweb-shims.d.ts`、
それらに対するtsconfigのpath alias・明示includeを除く。
汎用の `@/*`、strict、Next plugin、通常include/excludeは維持する。
型検査はこの差分で成功。元ファイル3件のblob/SHA-256/bytesはmanifestに保存。

## 復元

コードは固定SHAとmanifestで保存する。確認は別worktreeで行う。

```sh
git worktree add --detach ../me-ish-unused-code-reference 4bec943c722e0d9c6257e855ec258bacfbc05379
git -C ../me-ish-unused-code-reference sparse-checkout disable
```

特定ファイルの再導入は新しい修正ブランチでmanifestの対象だけを復元する。
不要コードの再導入が妥当かを確認し、型・lint・単体・該当ブラウザ/CIを再検証する。
thirdweb復元には2つのshimとtsconfigの該当設定を同時に扱う。
新規案件を含むDBやStorageを古いバックアップで上書きしない。
公開ページの終了、DB/画像の永久削除、権限・課金設定変更は別判断のまま保留する。

## 呼出元のない AURA/CARD 補助処理

manifestの8つのsrc/libファイルを除く。static import/re-export、literal dynamic import、
requireと全追跡テキスト検索で呼出元がないことを確認した。非literal importはi18nの
JSON取得で、この候補を読み込まない。API、ページ、Server Actionを消す変更ではない。

- AURA: 未使用の描画型、未使用HTML sanitizer、未使用strength/layout計算、
  旧supabaseAdmin再export、未使用DataURL uploadラッパー。
- CARD: 旧生成/フォーム専用color helper、未使用tier helper、未使用DataURL uploadラッパー。
- card.colorUtilsの最後の利用元は#140のフォームと#141の生成処理。その他は
  今回以前から孤立していたもので、今回の停止だけが未使用化の理由とは主張しない。

現行renderer/schema、クライアントのauraAssets.ts/cardAssets.ts、共通supabaseAdmin、
API内の実Storage処理と既存のsanitize/markdown処理は保持する。未使用sanitizerを
削除しても現行表示のサニタイズ経路は変わらない。

Phase 0Bと7はsrcの共通ディレクトリを試験appへ再帰コピーする。固定参照はないが、
通常CIに加えて該当Phase gateを最終コミットで確認する。

## 未参照の共通表示部品

CardBase.tsx / SectionContainer.tsx の2件を除く。外部import/re-export/動的参照は0。
参照先のapplyVariantStyleとaura.designSystemは公開描画でも使われるので保持。
2部品を除いたTailwind生成CSSは全追跡srcを入力した比較でbyte単位で一致。
残るコンポーネントのDOM、hooks、イベント、ARIAには変更を加えない。

## 未使用sanitizerの依存

唯一の呼出元aura.sanitize.tsを除いた後、isomorphic-dompurifyをpackage/lockから除く。
その専用の推移依存を含め30個のlock entryが消える。残るパッケージはversion・
resolved・integrityに変更なし。11件がdev専用となり、jspdfの任意依存として残る
dompurifyにはoptionalフラグが付く。テスト用jsdom26.1.0は維持。
PR #142の2つの依存削除はこのブランチに含めず、組合せも別途確認する。
package/lockを戻す際は同一基準の両方を扱い、他のPRの正当な依存変更を維持する。

## 前回のローカルブラウザ失敗の切り分け

- 英語口座管理→ログイン: 基準mainの初回login compileは5.5秒、GET応答は5047ms。
  URLの5秒assertion失敗直後に200が記録された。元ソースを使った隔離診断で
  login GETだけ6秒遅延させると元assertionは5012msで失敗し、navigationの30秒待機は
  同じURL・英語文言の確認まで成功した。該当1行をwaitForURLへ変更する。
  期待URL・表示のassertion、外部通信遮断、テスト件数は維持する。
- 旧デモ受付のNext→review: 前回ローカルのみ1回失敗。基準5回、変更後3回、
  追加診断（基準の通常3回・CPU4倍遅延3回）は成功。追加診断でinvalidイベント・
  ステップ巻戻り・pageerrorは0。元失敗時のtraceがなく、原因は確定できない。
  再試行の成功を理由にフレーク認定せず、アプリやreviewのassertionは変更しない。
- 前回のlocal設定はretries=0とtrace=on-first-retryの組合せだった。最終ローカル
  E2Eは一時設定とretain-on-failure、実行ごとの別出力先を使い、失敗証拠を保存する。

## 追加の補助コードとexport入口

getDisplayPlanStats.ts、i18n/navigation.ts、design/gallery2d/home/themeGalleries/testの
index.tsの計6件も呼出元0。集計関数を実行せずコードだけを除く。next-intlの
request.ts/routing.ts/config.ts、各gallery/homeの実部品は維持する。design/tokens.tsは
実行参照がなくなってもTailwindの22 selectorの入力なので保持する。

entryUploadClient.tsは#140で削除済みのentry/FormWrapperだけが呼んでいた。
トップレベルにuploadの副作用はなく、現行のAPI・テスト・Phaseスクリプトも参照しない。
旧Phase結果資料は当時の実装記録として残す。clientだけを退役し、entryUpload、
entryUploadGrant、entryUploadService、実API、Phase0A/0B/7を維持・検証する。
この7件は計4,817 bytes。19件すべての削除後も実globals.cssを全設定対象から生成し、
基準mainと208,297 bytes、SHA256
`f1f3f292dd3ec2083731796247d971832fe9b8e9ceb909995d4c3c5b7fa6cc31`が一致した。

manifestの削除/変更元24件（604,479 bytes）は固定SHAからgit archiveで隔離フォルダへ
実際に取り出し、全件のGit blob・SHA256・bytes一致を確認した。削除する19ファイル自体は
23,375 bytesである。これはコードの復元確認であり、DB/Storageの実復元とは区別する。

## 画像容量E2Eの診断と修正

途中head `6b060d7b`のlocal E2Eは48 pass / 2既存skip / 1 fail。
添付合計4MiBの検査が失敗したtraceでは、contactのSSR見出しとURLのassertionが先に通り、
setInputFiles完了がReact初期化より前だった。onChangeが必ず空にするinput.valueも
失敗後に残っていたため、容量計算ではなくイベントの取り逃しと判定した。

基準mainでcontactのmain-app.jsだけ3秒遅延させた対照試験でも、旧helperは同じ失敗を再現。
waitForURLのload待機では同条件で容量エラー表示とinput.valueのクリアを確認できた。
openInquiryのURL待機だけを変更し、同じURL・見出し・容量検査・通信遮断を維持する。
アプリの受付コードは変更しない。loadは一般的な全非同期hydrationの完了保証とは扱わない。
traceのなかった前回Next→review失敗まで同原因と断定しない。

## 2026-10-10 引継ぎ後のCI準備失敗の調査

最終head `bc3af450`のPhase 0Aを含む14フェーズが、検査開始前に失敗した。
Phase 0Aの再試行ログでも、CLI checksum成功と2つのhelp資料の出力後、約3秒で終了している。
このログだけではNodeイメージ取得のエラー本文を確認できないため、原因は未確定とする。

共有runnerの既存`docker pull`に、開始・完了の固定ログと失敗分類だけを追加する。
対象イメージ、180秒の上限、終了コード、依存インストール、隔離・認可・業務検査は維持する。
raw stderr、URL、Docker設定は公開せず、再試行・代替イメージ・認証変更も追加しない。
この診断変更後の正確なheadで必要なフェーズを確認してから本番へ進める。

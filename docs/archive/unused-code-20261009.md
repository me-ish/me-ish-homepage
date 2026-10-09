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

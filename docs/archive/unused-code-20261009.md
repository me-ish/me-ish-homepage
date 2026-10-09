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

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

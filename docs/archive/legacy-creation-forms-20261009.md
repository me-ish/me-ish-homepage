# 旧サービス作成フォームの整理・第1回

基準: `16e2546b40240dabfb1245de98d1d1f51e6767ed`。PR #139で新規利用を停止した後の、入力画面だけのコード整理。

## 対象

| 対象 | 変更 |
| --- | --- |
| ギャラリー応募 | `entry/FormWrapper.tsx`、専用layout、`components/entryForm/`の7ファイルを除く |
| AURA作成 | `components/aura/form/`の18ファイルを除く |
| CARD作成 | `components/card/form/`の7ファイルを除く |
| 旧URLの入口 | `/entry`、`/aura/form`、`/card/form`を、既存の日本語／英語休止案内へ誘導するServer Componentへ置換 |

削除34ファイル、入口の置換3ファイル。元の37ファイルは合計285,236 bytes・7,542行。削除対象への外部importは上記3ページだけで、既存の公開ページ・編集画面からの参照はない。

Middlewareの休止判定とURLは変えない。入口自身にも同じ転送先を設定し、作成用Client Componentや登録処理を持ち込まない。将来の再開には保存元からの明示的な復旧と、休止条件の再レビューが必要。

## 維持する範囲

- root layout、フォント、Natori／Etorieと受付デモ、既存公開ギャラリー・作品・作家ページ。
- AURA／CARDの公開・プレビュー・支払済み／公開済み保存、AURA Studio全体、`AuraImageUploader`。
- Stripe Webhook、COA、購入者向け証明書・領収書・ダウンロード、問い合わせ、ログイン、銀行設定、精算。
- 全API・Server Action・DB／Storage・依存パッケージ・旧生成処理。これらの物理的整理は別の変更で行う。
- 既存CIワークフロー・Phaseスクリプト・試験。旧フォームだけの新しい試験やskipは追加しない。

銀行設定画面は独立したフォームを持ち、削除する`entryForm/BankBranchFields`を使っていない。AURAの既存プレビュー／描画は`lib/aura/aura.schema`を使用し、削除する`auraFormTypes`には依存しない。Studioは`AuraImageUploader`と専用の型・DB処理を使うため、この回では維持する。

Phase 0Aのpath filterは`entry/FormWrapper.tsx`の変更で起動するが、試験が直接importする`entryUpload`、upload API、`entryUploadGrant`は全て維持する。ナトリ検査とギャラリー旧成功ケースを削らない。

## 保存と復旧

保存ブランチ: `archive/legacy-creation-forms-before-20261009`（上記基準コミット）。各ファイルのGit blob、SHA-256、元サイズは隣の`legacy-creation-forms-20261009.manifest.json`に記録。

確認用の別ディレクトリに保存元を展開する場合:

```sh
git worktree add --detach ../me-ish-forms-restore 16e2546b40240dabfb1245de98d1d1f51e6767ed
git -C ../me-ish-forms-restore sparse-checkout disable
```

本番への復旧が必要なら新しい修正ブランチを作り、一覧にある対象だけを戻して検証する。現在の`src/`を古いリポジトリ全体で上書きしない。旧TypeScriptを`_archive/`に複製しない。ブラウザーの既存下書き保存値や本番データは変更しない。

## 検証と反映条件

削除一覧と実差分の一致、残るimport、TypeScript、Lint、既存の単体試験、通常E2E、起動するPhase 0A、Vercel previewビルドを確認する。既知の開発依存`braces`のaudit保留は別件。

本番反映は、停止前の署名アップロードURLの有効期間を考慮した2026-10-09 23:21 JST以降のStorage再確認を条件とする。それまではブランチ・PR・検証環境で準備する。DB／Storageの追加変更や永久削除は、このPRの対象外。

公開反映時にはナトリの公開API・掲載画像、既存AURA／CARD公開ページ、Etorieデモと旧フォーム休止案内を再確認する。#133が未処理でもこの変更はroot layoutを触らない。

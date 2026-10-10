# 共通layoutのギャラリー依存整理（2026-10-10）

PR #147で#133の内容と解析除外の補強を先に統合した。#133は履歴を保持したまま
mergedとなっている。今回の整理は、その後のmainだけを基準とする。

## 復元元

- 基準main: `c9bb7070c0d7fa81459600b5d4df8f8c7c0e145a`
- 保存ブランチ: `archive/common-layout-before-20261010`
- 台帳: [common-layout-20261010-manifest.tsv](common-layout-20261010-manifest.tsv)
- 原本4ファイル・4,551 bytesをリポジトリ外へ取り出し、Git blob・SHA-256・bytesを全件照合した。
  統合前の検証済みhead `d3d9a8225eb06ad671d62a65a31e058e91c5d0e7`と基準mainは同じtreeである。

通常の復旧はこの整理PRのrevertを別PRで行う。TypeScript原本を`_archive/`へ置かず、
調査時だけ固定SHAから別worktreeへ取り出す。DBの巻き戻しは行わない。

## 変更する4ファイル

| ファイル | 変更 |
| --- | --- |
| `src/app/layout.tsx` | 全ページを囲むギャラリー用Providerと拡大表示を除く。QueryProvider、Suspense、解析除外済みAnalyticsは維持 |
| `src/app/[locale]/float/layout.tsx` | 中身がfragmentだけのClientWrapperと重複Analyticsを外す。ギャラリー自身のProviderと拡大表示は維持 |
| `src/app/[locale]/white/layout.tsx` | 同上。既存のdivと文字・色のclassも維持 |
| `src/components/shared/ClientWrapper.tsx` | 呼出元がなくなるため削除（原本177 bytes）。副作用・state・DOMを持たない |

ギャラリーのZoomArtworkContext、拡大表示本体、3D部品、公開画像、textures、modelsは残す。
FloatGallery内部の既存表示配置も今回の変更範囲へ広げない。
ルートのbody class、Google Fonts import、AURAフォントCSSは変えない。

## 依存と検査

変更前1,026・変更後1,025の追跡TS/JS/CSSをAST/module resolutionで調べ、
未解決のローカル参照は0件。非literal importは既存のlocale JSON読込だけだった。
ZoomArtworkContextへの逆参照を辿ると、変更後のアプリ入口はfloat/white配下だけで、
それぞれのlayoutがProviderを保持する。ナトリや他の公開画面からの呼出元はない。

同じ入力順・依存で生成したCSSは基準mainとバイト単位で一致した。

- 変更前後とも207,412 bytes
- SHA-256: `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`
- 追加・削除・変更selectorはいずれも0

これは同条件の生成CSS比較であり、配信minifyファイルそのもののハッシュではない。
既存CRLFを持つ2つのギャラリーlayoutは改行形式も保持する。

最終headの型・Lint・単体・E2E、Preview、本番の現役ページと画像の照合結果はPRへ記録する。
今回のパスでは専用Phaseは起動しないため、再実施したとは扱わない。
前提のPR #147では、Phase 7を含む13系統の最終head検査が成功している。
Phase 3Aの初回は5つの返金ブラウザ検査成功後にSyntaxError検知で停止し、同じheadの再実行で成功した。
CI/Phaseの条件は変更していない。

この整理ではナトリの機能、Etorieデモ、Stripe Webhook、既存購入・返金・精算、DB/Storage、
migration、package/lock、課金設定、他Supabaseプロジェクトを変更しない。
DB/Storageの永久削除は、権限・所有者・Storage API・アプリを含む機能復元確認後の別判断である。

# 依存ライブラリのセキュリティ更新（2026-10-08）

整理PR #136に先行する独立した更新。基準はmain `8bd87c9dea743af0838864eec2bd6d59cd951eb6`。アプリ実装・DB・Storage・CI設定・既存の画面／フォント設定は変更しない。

## 更新内容

| 依存 | 変更前 | 変更後 | 対応 |
| --- | --- | --- | --- |
| next / eslint-config-next | 15.5.25 | 15.5.27 | 同じ15系の公式バックポート |
| sharp | 0.35.4 | 0.35.5 | librsvgの修正版を含む |
| dompurify | 3.4.15 | 3.4.16 | 既存の親依存の許容範囲内でlock更新 |
| source-map-js | 1.2.1 | 1.2.2 | 既存の親依存の許容範囲内でlock更新 |
| postcss-selector-parser | 6.1.4 | 7.1.6 | 修正版へoverride。互換性を下記で確認 |

Tailwindは3.4.17、Reactは18.2.0を維持する。`npm audit fix --force`は実行していない。Next・sharpのプラットフォーム別バイナリと対応パッケージ以外に、無関係な依存更新を含めない。

parserはTailwind 3とpostcss-nestedが要求する6系からの変更になる。7.0ではAST走査中の要素挿入動作が変更されているため、単なるビルド成功だけで判断せず、同じソース・Tailwind設定・PostCSS設定で生成CSSを比較した。今後Tailwind等を変更する際も、このoverrideを無条件で外さない。

## 確認結果

- `npm ci --ignore-scripts --no-audit`で新しいlockからインストールできることを確認。
- 実PostCSS設定と同じTailwind/autoprefixerで、`src/app/globals.css`と`src/styles/auraFonts.css`を処理。更新前後の出力は両方バイト一致。
- sharpの実変換で、PNG（透過）、EXIF回転付きJPEG、WebP、GIF、既存public画像3件の計7入力を比較。参考画像／ポートフォリオ用の1600px・quality 88、および案件サムネイル用の1200px・quality 86の計14ケースで、WebPの内容・寸法・形式が一致。
- 参考画像の再送は既存ファイルとのバイト一致で判定するため、上記の跨版比較を実施した。全ての画像を網羅する保証ではないが、代表形式・透過・縮小・EXIF回転を含む。
- sharp更新前後のlibwebpは共に1.6.0。libvipsは8.18.6→8.18.7、librsvgは2.62.91→2.63.2。
- `intakeReferenceStorage.test.ts`と`portfolioSiteStorage.test.ts`の計7テストが成功。前者は本物のsharpを使う。
- 実isomorphic-dompurifyで、安全なHTMLが保持され、script・イベント属性・javascript URLが除かれることを確認。
- `git diff --check`、更新対象以外のpackage-lockエントリとアプリソースの不変を確認。

ローカル確認環境はNode 24。通常CIとプレビューは既存のNode 22設定を維持し、その結果をPRに記録する。ローカルの追加スクリーンショット確認はブラウザ配布物のダウンロード失敗により未実施で、視覚確認済みとは扱わない。実際のrootを差し替える変更は行っていない。DB書込・メール送信・本番決済は試験していない。

## 監査結果と未解消事項

| 監査 | 更新前 | 更新後 |
| --- | --- | --- |
| 全依存 `npm audit --package-lock-only --json` | 15件（high 11 / moderate 3 / low 1） | 9件（high 9） |
| 本番用依存 `npm audit --package-lock-only --omit=dev --json` | 今回比較値は取得していない | 0件 |

残る9件は独立した9つの脆弱性ではなく、**bracesの1つのアドバイザリが開発用依存に波及したもの**。対象はbraces、chokidar、micromatch、fast-glob、find-yarn-workspace-root、patch-package、tailwindcss、@next/eslint-plugin-next、eslint-config-next。

2026-10-08確認時、bracesのnpm latestは3.0.3で、公式アドバイザリも修正版なしとしている。上流で修正されていないものを直ったとは記録せず、既存のSecurity Auditをそのまま残す。そのためこのPRでも全依存監査のジョブは失敗する。本番用依存の0件は、サイト全体の安全性や開発／ビルド環境の安全性を保証するものではない。

2026-10-10追記: 所有者の判断で、CIのSecurity Auditの合否は本番用依存（`npm audit --omit=dev --audit-level=high`）だけで決めるように変更した。全依存の監査は同じジョブで続けて実行し、失敗扱いにせず警告の注釈とログに残す。bracesに修正版が出たら更新して、全依存でも0件に戻す。

全件解消を目的としたTailwind 4への移行、ESLint構成の変更、独自forkや独自パッチの導入は、この小さな更新と分けて判断する。Tailwindだけを更新しても、ESLintやpatch-package経由のbraces依存は残り得る。

## 参照

- [Next.js 15.5.27](https://github.com/vercel/next.js/releases/tag/v15.5.27)
- [Next.jsのキャッシュ処理1](https://github.com/advisories/GHSA-4jqv-mc3x-m676)・[2](https://github.com/advisories/GHSA-mcj8-r9mp-w47p)
- [sharp / librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)
- [DOMPurify 1](https://github.com/advisories/GHSA-p98j-92pf-mc4p)・[2](https://github.com/advisories/GHSA-6688-9rhm-gjv2)
- [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
- [postcss-selector-parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)・[変更履歴](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md)
- [未解消のbraces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)

アプリ実装とデータの変更を含まないため、必要なロールバックはこのPRのpackage.json/lockを元に戻す。DB全体を以前の状態へ戻す操作は不要。

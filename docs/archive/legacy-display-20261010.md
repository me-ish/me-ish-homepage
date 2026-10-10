# 休止済みAURA・CARD画面の内部整理（2026-10-10）

新規利用の休止後も残っていた紹介・作成画面と、その画面だけで使う部品を整理する。
ナトリの画面・画像、既存利用者の保存・購入対応、公開終了の対象範囲は変更しない。

## 復元元

- 基準コミット: `d827d8ea4984665986b9ffee89d95ca3a9ecb27f`
- 保存ブランチ: `archive/legacy-display-before-20261010`（上記コミットを指す）
- 原本台帳: [legacy-display-20261010-manifest.tsv](legacy-display-20261010-manifest.tsv)
- 変更・削除する実装原本23ファイル、149,072 bytesを別の検証用ディレクトリへ
  `git archive`で取り出し、全件のGit blob・SHA-256・バイト数を台帳と照合した。

通常の復旧は、この整理PRをrevertする別PRで行う。個別調査は上記固定コミットから
必要なファイルだけをリポジトリ外へ取り出す。TypeScript本体を`_archive/`へ置かない。
このコード復元確認は、Supabaseの権限・所有者・アプリを含む機能復元確認とは別である。

## 今回の変更

| 対象 | 処理・理由 |
| --- | --- |
| `/aura`、`/aura/studio`、`/aura/studio/new`、`/card` | すでにmiddlewareで休止中。内部ページも既存のlocale付き休止案内へのredirectへ統一 |
| `src/components/aura/studio/`の9ファイル、`AuraImageUploader.tsx`、`studio/skillPresets.ts` | 休止したStudio作成画面だけが呼ぶ11ファイルを削除 |
| `AuraDegreeSlider.tsx`、`AuraIntroOverlay.tsx`、`AuraWorldviewSelector.tsx`、`sections/AuraHeroCentered.tsx` | 呼出元がない4部品。下記のCSS互換確認を完了して削除 |
| `src/lib/aura/studio/studioAccess.ts` | 最後の呼出元だった書込APIの内部処理は前の整理で撤去済み。残る公開Studioは`studioDb`を使用 |
| `src/lib/card/storage/cardAssets.ts` | 呼出元のないクライアント用URL組立関数。実際の画像GET API・表示処理は保持 |
| `service-paused/page.tsx` | 3ページ公開終了後の状態に合わせ、「既存の公開ページは引き続きご覧いただけます」という一律の案内文を日本語・英語から除去。問い合わせ案内は保持 |
| `tailwind.config.js` | 削除したソースだけに残っていた72クラスを互換safelistとして保持 |
| `e2e/aura-form.spec.ts` | `/aura/studio`も新規書込なしの休止画面検査に追加 |

削除は17ファイル（原本115,980 bytes、3,344行）。個別ファイルの正確なパスと原本ハッシュは台帳に記載する。
旧資料で保持としたCARD画像URL補助関数は、今回の全呼出元調査により判断を更新した。
同名に近い画像GET APIを削除してよいという意味ではない。

## 参照とCSSの確認

追跡された`src`・`scripts`・`e2e`内のTS/JS/CSSをTypeScript ASTとmodule resolutionで調べた。
static import、re-export、文字列literalのdynamic import/require、import typeを対象とし、
config・テスト内のファイル名参照も別途照合した。調査ファイル数は1,038から1,021へ減少。
削除17ファイルの呼出元は削除対象内または休止redirectへ置換するページ内だけで、
残す側からの呼出元と未解決のローカルmodule参照は0件だった。
非literal importは既存のlocale JSON読込だけで、この整理では変更しない。

importがなくてもTailwindはソース文字列を読む。さらに、既存の保存済みテーマは
class文字列を表示へ渡すため、「未参照だからCSSも消せる」とは判断しない。
互換safelistを加えずに削除すると72 selectorが消えることを確認したため、その入力クラスを保持した。

基準コミットと変更後の追跡`src`・`app`・`components`のTailwind対象拡張子を同じ順序で
raw contentとして渡し、同じインストール済みTailwind 3・PostCSS・Autoprefixerで
`src/app/globals.css`を生成した。基準側は変更前のsafelistを使った。

- 変更前後とも207,412 bytes、バイト単位で完全一致
- SHA-256: `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`
- 追加・削除・内容変更selector: いずれも0

これは同一条件で生成したCSSの比較であり、Vercelのminify済み配信ファイルのハッシュではない。
rootのbody、Google Fonts import、AURAフォントCSS、公開作品・texture・modelは変更しない。

## 保持する境界と検査

- ナトリ、Etorieデモ、root layout、Provider、Analytics、PR #133/#135の領域を保持。
- AURA/CARDの実際の公開・preview renderer、編集・保存、QR/PDF、DB・schema・認可を保持。
- Studio公開ページで使う`designPresets`・`studioThemes`・`studioTypes`・`studioDb`を保持。
- 購入済み表示の`RendererV1`と公開終了3ページのID判定を保持。
- Stripe Webhook、既存購入・返金・精算、画像GET、migration、Storageを保持。
- package/lockとCI・Phaseスクリプトは変更しない。

ローカルで型検査・lintが成功（既存lint警告15件）。休止、公開終了、既存保存の
境界に関する6試験ファイル・237テストも成功した。
最終headの通常CI、Preview、本番の公開内容・元画像の照合結果は、この変更のPRに記録する。
この作業はDB/Storageの永久削除や、他Supabaseプロジェクトの操作を含まない。

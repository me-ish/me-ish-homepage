# 旧公開サービスの終了と専用コード整理（2026-10-10）

ユーザー承認: 「旧3D関係は全て終了」「現在のナトリポートフォリオ以外についても整理」。
従来の3D/2D・AURA/CARD公開表示の保持判断を更新する。ナトリの依頼・案件管理・決済・納品、
Etorieの試験用デモ、既存購入の履行・返金・精算・証明書、問い合わせと法的文書は保持する。

## 復旧

- 基準: `4a5133e339417390dfe6ba8a1e930f14ac4b8dfb`（PR #151後）。
- 保存ブランチ: `archive/legacy-public-before-20261010`。
- 原本台帳: [legacy-public-20261010-manifest.tsv](legacy-public-20261010-manifest.tsv)。
- 変更前原本を固定SHAから展開し、Git blob・bytes・SHA-256で照合する。
- 通常の復旧はPR revert。旧TSを型検査に含まれる`_archive/`へ戻さない。
- DB・Storage・顧客データの永久削除は行わない。Supabase機能復元の検証条件は引き続き必要。

## 公開経路

19 routeファイルを、保存データを読まずに表示する共通の公開終了案内へ置換した。
日本語/英語、識別子・別名・プレビューも同じ終了範囲。noindexと、現在のナトリ・既存購入問い合わせへの導線を持つ。

| サービス | 対象 |
| --- | --- |
| Gallery | float、float/2d、white、white/2d、galleries/forest、white-install、works/[id]、artists/[id] |
| Gallery紹介 | modal/about、modal/creators、modal/buyers、modal/pricing、special-thanks |
| AURA | p/[public_id]、u/[slug]、preview/[id]、studio/p/[id] |
| CARD | p/[public_id]、preview/[id] |

ルートと`artists/natori`は現在の`natori/portfolio`へlocaleを保持して転送する。
旧新規作成/応募/購入の休止middlewareとURLは継続し、受付を再開しない。
float/white layoutは3D用Zoom Providerを読み込まない。
sitemapは旧entries/aura_requests/portfolio_settingsを読まず、ナトリと法的表示・問い合わせ等13 URLだけを掲載。
汎用PWAの名称をme-ishへ更新。既存start_urlから現在のナトリへ到達でき、ナトリ管理用manifestは保持する。

## コード・依存・静的素材

- 3D/2D表示、拡大表示、操作、AURA/CARD renderer/preview/editor/PDF/QR、コメント表示等の閉じた専用依存を整理。
- 呼出元のない旧LegalNotices/NormalPurchaseButton/CookieConsent/Footer、separator/radio-group、旧design tokensも整理。
  これらの削除は法的文書・現役の解析設定・購入後対応を変更しない。
- 削除ソース92ファイル・470,482 bytes・14,621行。
- 3D専用static素材29ファイル・83,287,624 bytes（textures 28点、models 1点）を保全。
  現役ソース/scripts/publicテキストに参照がなく、現在のナトリ公開APIにも該当参照がない。
  `public/natori/`とSupabase画像・バケットは変更しない。
- 直接依存10本を削除: @react-spring/three、@react-spring/web、@react-three/drei、
  @react-three/fiber、three、react-nipple、@types/three、html-to-image、qrcode.react、@radix-ui/react-separator。
- lock内76 package entryを削除。追加package・既存version/integrity変更なし。
  共用9 entryはdev属性のみ変化。jspdfはCOA/領収書で使用するので保持する。

全追跡JS/TSをASTで解析し、削除群の外からのimport/re-export/literal dynamic import/require/import typeを確認。
test mock文字列や固定ファイル参照も確認し、旧3ページ限定の公開試験を今回の全公開終了契約へ更新した。
ナトリの7候補・i18n framework entry・test aliasは保持する。

## 表示と検査

削除コードが提供していた311クラスをTailwind互換safelistへ残し、同じ生成条件のCSSが
207,412 bytes、SHA-256 `7b83b5218bfd7ad87f1faf5132a3ec0878ad5bb8b781b47098d592117820dba4`
で完全一致する。配信minifyファイルそのものの比較とは区別する。
root body、Google Fonts import、auraFonts CSSは変更しない。

- 型検査、Lint（残る既存警告2件）、関連4ファイル228テスト。
- route直接試験でDB moduleが読み込まれたら失敗させ、終了画面とmetadata・リンクを検査。
- 19経路×日本語/英語のE2Eで、終了見出し・noindex・canvas不在・legacy DB fetch不在・pageerror不在を検査。
- トップ3 localeと旧ナトリ入口の転送、旧作品URLの終了をE2Eで検査。
- 通常CIとpackage-lock変更で起動する既存Natori Phaseを確認。CI定義・Phase scripts/条件は変更しない。
- Preview/本番で終了URL、ナトリAPI/画像、既存管理GETの認可拒否を照合する。
- 既知のbraces Audit保留は継続し、CI全体成功とは表示しない。

旧3DのReactCurrentBatchConfigエラーは、廃止した表示経路自体を終了案内に置き換えることで解消する。
3D rendererを修復したという意味ではない。ナトリ表示・依頼の変更とは分離する。

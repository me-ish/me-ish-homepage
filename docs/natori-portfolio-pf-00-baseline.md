# PF-00 現状 baseline と評価軸

- 実施日: 2026-08-09（JST）
- 対象: Production の `/natori/portfolio` と `/natori/works`
- 範囲: PF-00 の観測・記録のみ
- 基点: `origin/main` / `3d59f717409e5de302c1db835febf61449076631`
- Production deployment: `me-ish-homepage-vsiv-qlif6b1j2-me-ishs-projects.vercel.app`
- Production deployment commit: `3d59f717409e5de302c1db835febf61449076631`

この文書の数値は redesign 前の比較用 baseline であり、恒久的な性能保証値ではない。Production のフォーム送信、UI/API/analytics 実装、DB、環境変数は変更していない。Analytics は集計値の読み取りだけを行った。

## 1. 測定対象と条件

### URL

- Portfolio: <https://www.me-ish.art/natori/portfolio>
- Works/showcase: <https://www.me-ish.art/natori/works>

いずれも測定時に HTTP 200。ブラウザ観測では横スクロール、console error、page error はなかった。

### ブラウザ表示・スクリーンショット

| 項目 | Desktop | Mobile |
| --- | --- | --- |
| Browser | Playwright 1.58.2 / Chromium 145.0.7632.6 | 同左 |
| Viewport | 1440 × 900 px | 375 × 812 px |
| Device scale factor | 1 | 1 |
| Locale / timezone | ja-JP / Asia/Tokyo | 同左 |
| Color / motion | light / no-preference | 同左 |
| Mobile emulation | なし | Android UA、touch 有効 |
| 観測日時 | 2026-08-09 17:49–18:03 JST | 同左 |

全ページスクリーンショットは lazy-load 対象も表示されるよう一度スクロールしてから取得した。フォーム入力・送信はしていない。

### Lighthouse

- Lighthouse 13.4.1
- Google Chrome 151.0.7922.76
- 各 URL・各 viewport を同一条件で 3 回測定し、中央値を採用
- Desktop: 1440 × 900、simulated throttling、RTT 40 ms、10,240 Kbps、CPU slowdown 1x
- Mobile: 375 × 812、simulated throttling、RTT 150 ms、1,638.4 Kbps、CPU slowdown 4x
- 測定日時: 2026-08-09 17:52–17:59 JST
- Windows 上で Chrome の一時ディレクトリ削除が EPERM になった run があるが、12件すべての Lighthouse report は正常生成・解析できた

### Analytics

- Production Supabase project の `public.natori_page_events` を event/path/label 単位の集計だけで読み取り
- 基準時刻: 2026-08-09 17:47:34 JST
- 期間: 直近30日、直近90日
- 個別イベント行や入力内容などの個人情報は取得していない

## 2. 現状と証跡

### Screenshot artifacts

| Route | Desktop | Mobile |
| --- | --- | --- |
| `/natori/portfolio` | [portfolio-desktop.webp](artifacts/pf-00/portfolio-desktop.webp) | [portfolio-mobile.webp](artifacts/pf-00/portfolio-mobile.webp) |
| `/natori/works` | [works-desktop.webp](artifacts/pf-00/works-desktop.webp) | [works-mobile.webp](artifacts/pf-00/works-mobile.webp) |

### 表示内容と境界

`/natori/portfolio` の順序は Header → Hero → Gallery → About → Pricing → 依頼の流れ/Guidelines → Form → Footer。Production では structured form が有効で、旧フォーム表示はなかった。

`/natori/works` は Header → Hero → Gallery → About → Footer。pricing、受付状況、依頼フォーム、直接依頼 CTA、外部 SNS/つなぐリンクは表示されず、showcase の公開境界は維持されていた。

視覚上は次の特徴がある。

- Hero は代表作品を持たず、特に Desktop では余白の占有が大きい。
- Gallery は作品を大きく見せる一方、マスキングテープ、傾き、影、色付きラベルなど装飾の密度が高い。
- Mobile では Gallery だけで約6.2 viewport を使う。
- Portfolio の Mobile では固定 CTA が Gallery 上に重なる。
- structured form は全体として一方向だが、Desktop の最初の氏名・メールは2列配置。

### Section 間距離

`top` はページ先頭から section 先頭まで、`viewport` は `top ÷ viewport height`。`height` は section の表示高。

#### `/natori/portfolio`

| Section | Desktop top | Desktop viewport | Desktop height | Mobile top | Mobile viewport | Mobile height |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Hero | 64 px | 0.07 | 450 px | 87 px | 0.11 | 479 px |
| Gallery | 514 px | 0.57 | 1,831 px | 566 px | 0.70 | 5,038 px |
| About | 2,344 px | 2.60 | 637 px | 5,604 px | 6.90 | 1,105 px |
| Pricing | 2,981 px | 3.31 | 1,053 px | 6,709 px | 8.26 | 1,884 px |
| Flow / Guidelines | 4,034 px | 4.48 | 1,679 px | 8,592 px | 10.58 | 1,919 px |
| Form | 5,712 px | 6.35 | 1,823 px | 10,511 px | 12.94 | 2,025 px |
| Page total | 7,635 px | 8.48 | — | 12,641 px | 15.57 | — |

#### `/natori/works`

| Section | Desktop top | Desktop viewport | Desktop height | Mobile top | Mobile viewport | Mobile height |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Hero | 64 px | 0.07 | 446 px | 87 px | 0.11 | 475 px |
| Gallery | 510 px | 0.57 | 1,831 px | 562 px | 0.69 | 5,038 px |
| About | 2,340 px | 2.60 | 637 px | 5,600 px | 6.90 | 1,062 px |
| Page total | 3,077 px | 3.42 | — | 6,767 px | 8.33 | — |

## 3. Performance baseline

3 run の中央値。FCP/LCP/TBT は ms、転送量は Lighthouse の total byte weight。

| Route / viewport | Performance | Accessibility | FCP | LCP | CLS | TBT | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Portfolio Desktop | 63 | 97 | 1,550 | 7,056 | 0 | 56 | 7.91 MB |
| Portfolio Mobile | 54 | 97 | 7,663 | 39,122 | 0 | 151 | 7.65 MB |
| Works Desktop | 63 | 96 | 1,366 | 7,009 | 0 | 0 | 7.77 MB |
| Works Mobile | 54 | 96 | 6,765 | 38,956 | 0 | 146 | 7.51 MB |

LCP の3回値は次の通りで、大きな外れ値による中央値ではない。

- Portfolio Desktop: 7,043 / 7,056 / 7,349 ms
- Portfolio Mobile: 39,122 / 40,337 / 39,040 ms
- Works Desktop: 7,009 / 6,992 / 7,028 ms
- Works Mobile: 39,353 / 38,956 / 38,871 ms

Mobile の LCP element は Hero の説明文であり画像ではなかった。代表 run では TTFB 102 ms に対して element render delay 3,575 ms。Lighthouse の診断では外部 Google Fonts CSS が render-blocking で、Mobile の推定短縮可能時間は約4,204 msだった。

代表 run の resource breakdown は次の傾向だった。

- Portfolio: font 393 requests、約6.68 MB。全体約7.65–7.91 MB。
- Works: font 383 requests、約6.55 MB。全体約7.51–7.77 MB。
- Portfolio Desktop の image は10 requests、約395 KB、script 約433 KB、CSS 約338 KB。
- image delivery の推定削減は約4 KBで、初期ロードでは画像より font が支配的。

Field INP は取得できなかった。Speed Insights の組み込みが見つからず、GA/CrUX の field CWV にアクセスできる接続もなかったためである。上表の TBT は Lighthouse lab 環境の操作応答性 proxy に限り、INP と同一視しない。

全12 run の値、設定、LCP breakdown、resource breakdown、accessibility failure は [lighthouse-summary.json](artifacts/pf-00/lighthouse-summary.json) に保存した。元の Lighthouse HTML/JSON は repo 外の `C:\tmp\pf00-lighthouse` に保持している。

## 4. Accessibility baseline

全12 run で `color-contrast` が不合格だった。代表的な組み合わせは次の通り。

| 対象例 | 前景 / 背景 | Contrast | 必要値 |
| --- | --- | ---: | ---: |
| `ILLUSTRATION PORTFOLIO` | `#E84C86` / `#F7F3FB` | 3.29 | 4.5 |
| Hero の大きな pink text | `#FF6FA5` / `#F7F3FB` | 2.37 | 3.0 |
| Primary CTA | white / `#FF6FA5` | 2.60 | 3.0 または 4.5 |
| Mint sparkle | `#3FBE9E` / `#F7F3FB` | 2.11 | 3.0 |
| About subtitle | `#E84C86` / `#EFE7F7` | 3.00 | 4.5 |
| SNS・料金・選択 radio 等 | `#E84C86` / white | 3.61 | 4.5 |

Lighthouse が検出した failing node は Portfolio Desktop 19、Portfolio Mobile 20、Works Desktop/Mobile 6。Mobile の固定 CTA も white / `#FF6FA5` で不合格だった。

作品モーダルは Production でキーボード確認した。先頭作品を Enter で開いた直後も focus は背面の作品ボタンに残り、次の Tab も背面の次作品へ移動した。Escape で閉じた後も focus は起点ではなく次作品に残った。つまり初期 focus、focus trap、起点への focus return がない。

## 5. Analytics baseline

### 実装済み event

Client type と server allowlist の双方に次がある。

- `links_click`
- `portfolio_sns_click`
- `portfolio_plan_click`
- `portfolio_form_submit`

同じ event は custom table への記録に加え、`gtag` が存在すれば GA4 にも送る実装。Global layout には Vercel Analytics があるが、今回その dashboard/pageview 集計へアクセスできる接続はなかった。

### 30日 / 90日集計

| Event / path | Label | 30日 | 90日 |
| --- | --- | ---: | ---: |
| `links_click` / `/natori/links` | つなぐ | 8 | 8 |
| 同上 | ポートフォリオ | 6 | 6 |
| 同上 | Skeb | 3 | 3 |
| 同上 | TikTok | 2 | 2 |
| 同上 | BOOTH | 1 | 1 |
| 同上 | Wick | 1 | 1 |
| `portfolio_form_submit` / `/natori/portfolio` | SNSアイコン | 1 | 1 |
| 同上 | その他 | 1 | 1 |
| `portfolio_sns_click` | — | 0 | 0 |
| `portfolio_plan_click` | — | 0 | 0 |
| **合計** |  | **23** | **23** |

30日と90日が同数で、Portfolio は submit 2件のみ。2件は structured form の Production 有効化前に発生した旧 request type label であり、新フォームの自然流入実績とは扱えない。母数が少なく、統計的な結論や redesign 効果の予測には使わない。

### Funnel 上不足している event

Natori custom analytics には次がない。

- Portfolio page view（Vercel Analytics 側に存在する可能性はあるが、今回件数を取得できていない）
- `portfolio_primary_cta_click`（`hero` / `mobile_sticky` / `pricing` の source 区別）
- `portfolio_gallery_open`
- `portfolio_form_start`（最初の interactive field 操作）
- `portfolio_form_mode_select`（`consultation` / `quote`）

このため現状は page view → CTA → form start → mode select → submit、または gallery open → CTA の funnel を構成できない。PF-09 では client union と server allowlist の同時更新、demo route の除外、submit 二重送信防止が必要。

補足として `src/features/natori/server/pageEventsService.ts` の event/label 集計 key に実 NUL separator があり、実行上のキー衝突回避には働くが `rg` がファイルを binary 扱いする。PF-00 では変更せず、PF-09 の保守性確認事項とする。

## 6. 固定する評価軸

PF-01 以降では、同じ Production route・同等 viewport 条件で以下を before/after 比較する。

| 評価軸 | Baseline 指標 | 改善判定の方向 |
| --- | --- | --- |
| 作品の主役度 | Hero に代表作品なし、Gallery の装飾密度 | 作品が装飾より先に認識される |
| 目的の明確さ | Hero から依頼可能性・次行動を理解できるか | 第一画面で役割と行動結果が明確 |
| 情報順序 | About が Pricing より前 | 作品→依頼判断→行動の流れが短い |
| CTA/Form 到達性 | Mobile Form top 12.94 viewport | scroll 距離を短縮し、CTA source を測定可能にする |
| Form 操作性 | structured form、有効。Desktop 冒頭2列 | Mobile/keyboard を含め迷いと入力負荷を減らす |
| Accessibility | contrast failure、modal focus 不備 | WCAG contrast と modal keyboard behavior を満たす |
| Performance | 上記 LCP/CLS/TBT/転送量 | 同一条件の中央値で悪化させず、特に font/LCP を改善 |
| Showcase 境界 | 価格・受付・フォーム・直接導線なし | `/natori/works` の禁止要素ゼロを維持 |
| Analytics 可観測性 | submit 以外の Portfolio funnel 不可 | PF-09 定義の各段階を重複なく観測可能 |

見た目の好みだけでなく、作品認知、依頼判断までの距離、操作可能性、性能、showcase 制約、計測可能性を同時に評価する。

## 7. 発見した問題と PF-01 以降への影響

1. **Mobile の意思決定距離が長い。** Gallery が6.20 viewport、Form は12.94 viewport地点。PF-01 の情報順序と PF-07 の CTA をこの baseline と比較する。
2. **Hero に作品の即時証拠がない。** Desktop では余白が大きい。PF-03 で代表 artwork を扱う場合、LCP/CLS と showcase 共通化への影響も測る。
3. **Gallery の装飾と長さが作品認知を競合する。** PF-04 では tape/rotation/card decoration を減らしつつ、作品情報と modal 操作を失わない。
4. **作品 modal の keyboard focus が dialog 内に入らない。** PF-04/PF-07 で initial focus、trap、return を明示的に検証する。
5. **色 contrast が両 route・両 viewport で不合格。** PF-02 の token と PF-07 の CTA 状態で同じ組み合わせを再発させない。
6. **font が性能を支配している。** 383–393 requests、約6.55–6.68 MB。PF-02/PF-08 は global `auraFonts.css`、Google Fonts CSS、layout/portfolio の font 重複と weight を先に監査する。
7. **Mobile LCP が lab 条件で約39秒。** LCP は Hero text なので Gallery image 最適化だけでは解決しない。PF-03/PF-08 で render-blocking font/CSS と Hero render timing を優先する。
8. **Analytics で funnel が作れない。** 現時点の Portfolio custom data は submit 2件だけ。PF-09 より前のレイアウト判断を event 数で正当化しない。
9. **Showcase 境界は現状合格。** PF-01〜PF-08 の共通 component 変更でも、価格、受付状態、フォーム、直接 CTA、外部リンクを `/natori/works` に漏らさない。
10. **Structured form の domain contract は維持対象。** PF-06 で見た目や操作順を変える場合も consultation/quote payload、hidden field prune、既存 submit 成功時 tracking を壊さない。

## 8. 取得できなかった項目

| 項目 | 理由 / 扱い |
| --- | --- |
| Field INP | Speed Insights 未導入、GA/CrUX field data への接続なし。TBT を lab proxy として別記した |
| Vercel Analytics の pageview 数 | Global component は確認したが dashboard data への接続なし。推測しない |
| GA4 の pageview/event 数 | コード上の送信は確認したが GA property への読み取り接続なし。推測しない |
| Conversion rate | page view/CTA/form start がなく分母を作れない |
| 新 structured form の自然流入実績 | 有効化後の観測期間に対象 event がない。Production form は制約により送信していない |
| 実ユーザーの task completion / 定性評価 | ユーザー調査は PF-00 の観測範囲外 |
| 実端末・screen reader 結果 | Playwright/Chromium と Lighthouse の lab 観測のみ。実端末・支援技術セッションは未実施 |

## 9. Artifact 一覧

- 本文: `docs/natori-portfolio-pf-00-baseline.md`
- Screenshots: `docs/artifacts/pf-00/portfolio-desktop.webp`、`portfolio-mobile.webp`、`works-desktop.webp`、`works-mobile.webp`
- Lighthouse compact raw/summary: `docs/artifacts/pf-00/lighthouse-summary.json`
- Lighthouse original reports（repo 外）: `C:\tmp\pf00-lighthouse`

PF-00 では以上の documentation/artifact 追加だけを行い、アプリケーションコードと Production 設定は変更しない。

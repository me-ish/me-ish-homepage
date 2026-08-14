# PF-08 Image / performance hardening

- 実施日: 2026-08-14 JST
- 対象: `/natori/portfolio`、`/natori/works` の desktop / mobile
- 基点: `origin/main` / `ef31706988c12d8841c7cd3149907f753a8d9bcd`
- 変更範囲: PF-08 の画像配信指定と portfolio 専用フォント読込のみ

## 結論

PF-08 の受け入れ条件を満たした。

- Hero の代表画像は引き続き LCP candidate であり、`priority`、実レイアウトに合う `sizes`、`aspect-square` による表示領域確保を維持した。
- Gallery の先頭画像には `priority` を付けず、各カード画像は遅延読込のままにした。modal は開いた場合だけ DOM に生成されるため、初期ロードには含まれない。
- Gallery の `sizes` をカードの最大幅と余白に合わせ、desktop で表示幅約 340〜348 px に対して 640 px 候補を取得していた状態を 384 px 候補へ縮小した。mobile は表示幅約 334〜341 px に対して 384 px 候補を維持する。
- 日本語フォントの全 `unicode-range` 断片を preload しないようにした。必要な文字範囲だけ通常ロードされる。
- 375 px / 1440 px のブラウザ確認で横 overflow と画像由来の layout shift は見つからなかった。

## 変更内容と理由

### Portfolio 専用フォント

`Zen_Maru_Gothic` の `preload` を `false` にした。変更前は日本語フォントの分割ファイルがページで使う文字に関係なく preload され、初期ロードの大半を占めていた。

この変更は font family、weight、表示デザインを変えず、読込開始の方法だけを変更する。portfolio 専用 `next/font` 設定に限定し、サイト全体の Google Fonts や AURA には触れていない。

### Gallery image `sizes`

- card: desktop の固定最大幅 352 px、tablet / mobile の実余白を反映
- modal: mobile の左右 16 px 余白を反映

画像そのもの、作品順、card の縦横比、masking tape、tag、modal 仕様は変更していない。

## 測定条件

Lighthouse 13.4.1 / Headless Chrome 151 を使用し、各 URL・viewport を同一条件で3回測定して中央値を採用した。

| 条件 | Desktop | Mobile |
| --- | --- | --- |
| Viewport | 1440 × 900 px | 375 × 812 px |
| RTT | 40 ms | 150 ms |
| Throughput | 10,240 Kbps | 1,638.4 Kbps |
| CPU slowdown | 1x | 4x |
| Before URL | `https://www.me-ish.art/natori/{portfolio,works}` | 同左 |
| After URL | production buildを起動した `http://127.0.0.1:3188/natori/{portfolio,works}` | 同左 |
| Before 測定時刻 | 2026-08-14 10:08〜10:10 JST | 同左 |
| After 測定時刻 | 2026-08-14 10:19〜10:20 JST | 同左 |

Before は変更前の Production、After は同じ基点・Production データを使ったローカル production build である。ホスト、CDN、測定時の端末 benchmark index が同一ではないため、timing の差をそのまま本番改善保証とはしない。一方、request数、font転送量、選択された image candidate は今回の変更による差として確認できる。本番反映後の Production 再測定は rollout 時に行う。

## 3回中央値

LCP / FCP / TBT は ms、Transfer は Lighthouse の total byte weight。

| Route / viewport | 状態 | Performance | A11y | FCP | LCP | CLS | TBT | Transfer | Requests | Font requests | Font transfer | Image transfer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Portfolio desktop | Before | 64 | 100 | 1,393 | 6,736 | 0 | 44 | 7.83 MB | 429 | 391 | 6.65 MB | 342 KB |
| Portfolio desktop | After | 85 | 100 | 692 | 1,520 | 0.000007 | 71 | 1.98 MB | 128 | 91 | 1.21 MB | 207 KB |
| Portfolio mobile | Before | 48 | 100 | 3,598 | 36,757 | 0 | 495 | 7.62 MB | 427 | 391 | 6.65 MB | 127 KB |
| Portfolio mobile | After | 55 | 100 | 10,983 | 13,018 | 0 | 0 | 1.91 MB | 126 | 91 | 1.21 MB | 130 KB |
| Works desktop | Before | 65 | 100 | 1,226 | 6,627 | 0 | 9 | 7.73 MB | 422 | 383 | 6.55 MB | 349 KB |
| Works desktop | After | 87 | 100 | 689 | 1,333 | 0 | 16 | 1.47 MB | 90 | 52 | 0.70 MB | 214 KB |
| Works mobile | Before | 52 | 100 | 3,817 | 38,322 | 0 | 283 | 7.51 MB | 419 | 383 | 6.55 MB | 127 KB |
| Works mobile | After | 61 | 100 | 3,008 | 6,842 | 0 | 121 | 1.38 MB | 87 | 52 | 0.70 MB | 130 KB |

主な差:

- total transfer: 約 75〜82% 減
- font transfer: 約 82〜89% 減
- requests: 約 70〜79% 減
- desktop gallery image candidate: 640 px から 384 px へ縮小
- CLS: 全条件で 0〜0.00003 の範囲

Portfolio mobile の After は3回のうち2回で FCP 約11秒、LCP 約13秒、1回で FCP約3秒、LCP約5.8秒となり振れが大きかった。このため中央値を採用し、2.5秒目標を達成したとは判定しない。LCP element は各条件で Hero の代表画像だった。

## Field data と操作応答性

field INP は取得できていない。表の TBT は Lighthouse の lab 指標であり、INP とは区別する。ブラウザで画像表示、Gallery modal、responsive layoutを確認し、アプリ由来の console error と横 overflow はなかった。localhost では Vercel Analytics の送信先が利用できないことによる 404 / MIME warning が出るが、Production 実装の回帰ではない。

## 検証

- PF-08 を含む関連テスト: 20件成功
- `npm run typecheck`: 成功
- `npm run build`: 成功
- 375 × 812 / 1440 × 900 の production build を実データで目視確認

3回分の集計値は [lighthouse-summary.json](artifacts/pf-08/lighthouse-summary.json) に保存した。生の Lighthouse JSON は一時測定ファイルであり repo には含めない。

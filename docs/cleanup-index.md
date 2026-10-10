# 現役・休止・保存用の索引

この資料は「名前が旧サービスだから削除してよい」という判断を避けるための入口です。
ナトリの依頼・案件・公開作品を保護し、停止とコード整理、データの永久削除を分けます。

## 現役として維持するもの

| 対象 | 維持する理由 |
| --- | --- |
| Natoriの画面・API・feature・全natori_*テーブル・関連Storage | ポートフォリオ、依頼受付、見積、相談、決済、納品に必要 |
| EtorieデモとPhaseスクリプト・fixtures | ナトリの受付と権限・業務フローの検査に使用 |
| Auth、Supabase接続、管理者判定、Stripe、Resend、i18n、共通UI | ナトリでも使用。旧サービスと共有 |
| root layout、Provider、Analytics、フォント | 全ページへの影響がある。PR #133との調整前に整理しない |
| migration、legacy-migrations、baseline、検証成果物 | 過去DBの再現とハッシュ検証。整理目的で移動・改名・再適用しない |

## 新規利用を停止し、既存利用を保持するもの

- ギャラリー: 応募・新規購入・展示定期処理を停止。公開表示、証明書、既存購入・返金・精算対応を保持。
- AURA / CARD: 新規下書き・生成・アップロード・新規購入を停止。承認済み3ページは公開終了。対象外の既存公開、画像の読取、認可された購入済み／既存公開データの保存を保持。
- 問い合わせ、旧利用者の銀行設定、関連ログインは継続。旧マイページは休止。
- 停止判定の入口は `src/lib/legacyServiceSuspension.ts`。個別退役済みAPIには直接呼出し用の休止応答も残す。

2026-10-10に公開終了を承認されたページ:

- https://www.me-ish.art/aura/u/portfolio
- https://www.me-ish.art/aura/u/portfolio-2
- https://www.me-ish.art/card/p/me-ish

同じ保存データを指す別URL・プレビューも公開終了します。対象と復旧方法は
[公開終了の台帳](archive/legacy-publications-20261010.md)を参照してください。
画像・保存データ・決済記録は保持します。購入・返金・精算対応の終了や永久削除は別の判断です。

## 整理済みコードを探す

| 整理単位 | 台帳・復元資料 |
| --- | --- |
| 一時コピー・旧成果物 | [meish-cleanup-20261008.md](archive/meish-cleanup-20261008.md) |
| 旧作成フォーム | [PR #140](https://github.com/me-ish/me-ish-homepage/pull/140)と `docs/archive/` のmanifest |
| 生成・Checkout・展示cronの内部処理 | [legacy-api-internals-20261010.md](archive/legacy-api-internals-20261010.md) |
| 未使用依存・補助コード | [PR #142](https://github.com/me-ish/me-ish-homepage/pull/142)、[PR #143](https://github.com/me-ish/me-ish-homepage/pull/143)。マージ状況は各PRで確認 |
| 停止済み下書き・画像書込・新規購入の内部処理 | [legacy-write-api-20261010.md](archive/legacy-write-api-20261010.md) |
| 休止済みAURA・CARDの紹介・Studio作成画面と未使用部品 | [legacy-display-20261010.md](archive/legacy-display-20261010.md)。生成CSSを互換safelistで保持 |

`_archive/`へTypeScript本体を移すと型検査へ混入します。旧実装は台帳の固定SHAと
保存ブランチから必要なファイルだけを別worktreeへ取り出します。通常の復旧はrevert PRを
使い、整理後に追加された案件やデータを古いDBへ巻き戻しません。

## 今後の削除判断で確認すること

1. 現役・既存公開・顧客対応・試験からの参照を全て解消する。
2. importだけでなく、TailwindのCSS生成、動的な保存値、SQL/RPC/メール/サイトマップも照合する。
3. 最終コミットで通常CIと必要なPhaseを確認し、Previewと本番の公開内容・画像を比較する。
4. DB/Storageの永久削除前には保存判断と、権限・所有者・アプリを含む隔離復元を完了する。

ファイルのバックアップ展開成功は、Supabase全体の機能復元成功とは別です。
停止中の他プロジェクトはこの整理の対象外です。

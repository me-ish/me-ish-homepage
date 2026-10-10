# 現役・休止・保存用の索引

この資料は「名前が旧サービスだから削除してよい」という判断を避けるための入口です。
ナトリの依頼・案件・公開作品を保護し、停止とコード整理、データの永久削除を分けます。

## 現役として維持するもの

| 対象 | 維持する理由 |
| --- | --- |
| Natoriの画面・API・feature・全natori_*テーブル・関連Storage | ポートフォリオ、依頼受付、見積、相談、決済、納品に必要 |
| EtorieデモとPhaseスクリプト・fixtures | ナトリの受付と権限・業務フローの検査に使用 |
| Auth、Supabase接続、管理者判定、Stripe、Resend、i18n、共通UI | ナトリでも使用。旧サービスと共有 |
| root layout、QueryProvider、Analytics、フォント | #133を#147で統合済み。共通基盤を維持。旧ギャラリー専用Providerは公開終了とともに退避済み |
| migration、legacy-migrations、baseline、検証成果物 | 過去DBの再現とハッシュ検証。整理目的で移動・改名・再適用しない |

## 終了した旧機能と残る記録確認

- ギャラリー: 応募・新規購入・展示定期処理は停止済み。3D/2D・作品/作家・紹介ページを公開終了。証明書、既存購入・返金・精算対応を保持。
- AURA / CARD: 新規下書き・生成・アップロード・新規購入は停止済み。今回の追加承認で公開/別名/Studio/プレビューをすべて公開終了。その後、旧支払いが所有者のテストと確認されたため、画像API・保存・公開名変更も終了。専用DB/helperも保全して除去。
- 問い合わせ、旧利用者の銀行設定、関連ログインは継続。旧マイページは休止。
- 停止判定の入口は `src/lib/legacyServiceSuspension.ts`。個別退役済みAPIには直接呼出し用の休止応答も残す。

2026-10-10の最初の公開終了承認（下記3ページ。その後、旧公開サービス全体へ拡大）:

- https://www.me-ish.art/aura/u/portfolio
- https://www.me-ish.art/aura/u/portfolio-2
- https://www.me-ish.art/card/p/me-ish

同じ保存データを指す別URL・プレビューも公開終了します。対象と復旧方法は
[公開終了の台帳](archive/legacy-publications-20261010.md)を参照してください。
実データは復元確認が終わるまで保持します。2026-10-10 18:36 JSTに旧支払いテストデータの削除承認を受けました。ナトリの決済と共用Stripe記録は削除対象に含めません。

## 整理済みコードを探す

| 整理単位 | 台帳・復元資料 |
| --- | --- |
| 一時コピー・旧成果物 | [meish-cleanup-20261008.md](archive/meish-cleanup-20261008.md) |
| 旧作成フォーム | [PR #140](https://github.com/me-ish/me-ish-homepage/pull/140)と `docs/archive/` のmanifest |
| 生成・Checkout・展示cronの内部処理 | [legacy-api-internals-20261010.md](archive/legacy-api-internals-20261010.md) |
| 未使用依存・補助コード | [PR #142](https://github.com/me-ish/me-ish-homepage/pull/142)、[PR #143](https://github.com/me-ish/me-ish-homepage/pull/143)。マージ状況は各PRで確認 |
| 停止済み下書き・画像書込・新規購入の内部処理 | [legacy-write-api-20261010.md](archive/legacy-write-api-20261010.md) |
| 休止済みAURA・CARDの紹介・Studio作成画面と未使用部品 | [legacy-display-20261010.md](archive/legacy-display-20261010.md)。生成CSSを互換safelistで保持 |
| 依頼者ページの解析除外・PR #133の統合 | [analytics-privacy-20261010.md](archive/analytics-privacy-20261010.md)。共通layout整理の前提として別PRで統合 |
| 共通layoutのギャラリー依存と重複解析 | [common-layout-20261010.md](archive/common-layout-20261010.md)。専用Providerはギャラリー内で維持 |
| 休止済みギャラリーマイページ・展示更新・所有者ひも付け | [gallery-workspace-20261010.md](archive/gallery-workspace-20261010.md)。専用UI・DB操作補助を退避し、生成CSSを保持 |
| 未使用の旧トップページと専用部品 | [unused-home-20261010.md](archive/unused-home-20261010.md)。12ファイルを退避し、現在のトップと生成CSSを保持 |
| 休止済み旧管理の書込APIと未使用UI | [legacy-admin-20261010.md](archive/legacy-admin-20261010.md)。書込6 APIは休止応答を残し、読取・問い合わせ・精算を保持 |

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

## 同日17:40 JSTの追加承認

旧3Dをすべて終了し、現在のナトリ以外の旧公開機能も整理する承認を受けた。
[旧公開サービス終了の台帳](archive/legacy-public-20261010.md)に対象・復元元・保持境界を記録する。
サイト入口と旧ナトリ作家URLは現在のポートフォリオへ接続する。
この時点の公開終了とデータ削除の承認は別です。後の旧テスト支払い削除承認は下記の追加台帳に記録します。

## 引き継ぎ後の最終整理

[PR #152](https://github.com/me-ish/me-ish-homepage/pull/152)はdraft・未反映。本番mainは#151のまま。
[管理画面・残る旧処理・検証失敗の修正](archive/legacy-support-20261010.md)、
[DB/Storageの保持対象と削除候補・復元状況](archive/cleanup-data-retention-20261010.md)を参照。
終了案内と無副作用の停止APIは旧URLを閉じたままにするため残す。
保存した旧コード本体はGitから復元でき、現役ソースに複製しない。

## 旧支払いが所有者テストだったことを受けた追加整理

[旧テスト支払い・AURA/CARD残存APIの終了](archive/legacy-test-payments-20261010.md)。
旧商品のWebhookは署名検証後に書込・通知なしでACKし、ナトリの入金・返金は従来の処理を維持します。
共用processed_stripe_eventsはナトリのrollback経路も使うため維持します。

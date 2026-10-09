# me-ish / ナトリ

Next.js App Router + TypeScript + Tailwind + Supabase + Stripe。

現役の開発・運用対象は、ナトリのポートフォリオと依頼受付・案件管理です。
ギャラリー、AURA（ホームページ作成）、CARD（名刺作成）の新規受付・作成・購入は休止中です。
既存の公開ページ、画像、購入済みデータの保存、問い合わせ・精算対応は保持しています。

## まず読む資料

- [現役・休止・保存用の整理索引](docs/cleanup-index.md)
- [旧サービスの停止範囲](docs/cleanup-legacy-service-stop-20261009.md)
- [保全・停止・削除の条件](docs/archive/Cleanup_Backup_and_Stop_Gates_2026-10-08.md)
- [開発時の共通ルール](AGENTS.md) / [ナトリの構成ルール](CLAUDE.md)

## 現在の構成

| パス | 役割 |
| --- | --- |
| `src/features/natori/` | ナトリのUI、型、計算、データアクセス、サーバー処理 |
| `src/app/[locale]/natori/` / `src/app/api/natori/` | ナトリの画面とAPI |
| `src/features/etorie/` / `src/app/[locale]/etorie/` | ナトリ受付のデモ・試験にも使用。削除対象ではない |
| `src/lib/supabase*` / `src/lib/auth/` / `src/components/ui/` / `src/i18n/` | 現役機能でも使う共通基盤 |
| `src/app/` / `src/components/` / `src/lib/` の旧サービス部分 | 休止入口と既存公開・顧客対応が混在。名前だけで一括削除しない |
| `supabase/` / `scripts/natori-phase-*/` | DB定義・運用・隔離検証。SQL履歴と検証fixtureを保持 |
| `public/` | 公開素材。ページや保存データの参照先を保護 |
| `docs/archive/` | 整理対象の台帳・復元方法。旧コード本体はGitの固定コミットに保管 |

## 主要な公開URL

- `/natori/portfolio` — ナトリのポートフォリオ
- `/natori/portfolio/contact` — ご相談・ご依頼
- `/etorie/demo/app/portfolio` — 受付試験にも使うデモ
- `/`、`/white/2d`、`/float/2d` — 既存の公開トップ・ギャラリー
- 既存AURA / CARDの公開URL — 維持。新規作成とは別の経路
- `/entry`、`/mypage`、AURA / CARDの新規作成画面 — 休止案内へ移動

## 開発環境

リポジトリの `.node-version` とlockfileを使用します。

```bash
npm ci
npm run dev
```

開発URL: http://localhost:3000

環境変数は担当者から正規の経路で設定してください。値をコード・資料・ログへ転載しません。
本番DBを開発・試験用に流用しません。

## 検証とデプロイ

型・Lint・単体試験・ブラウザ試験に加え、変更箇所に対応するNatori Phaseの検査を維持します。
現在の保留事項と実施結果は各整理PRと整理計画を参照してください。

Vercelは `main` への反映で本番デプロイされます。対象コミットの検査とPreview確認を済ませ、
反映後にナトリの公開内容・掲載画像・既存URLを照合します。

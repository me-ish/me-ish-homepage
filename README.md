# me-ish / AURA

Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Stripe

## 開発環境

```bash
npm run dev
```

http://localhost:3000

## ディレクトリ構成

```
src/
├── app/                    # App Router ページ・API
│   ├── [locale]/           # i18n対応ページ
│   ├── admin/              # 管理画面
│   ├── api/                # APIルート
│   ├── aura/               # AURA機能ページ
│   ├── mypage/             # マイページ
│   └── works/              # 作品詳細
├── components/
│   ├── aura/               # AURAコンポーネント
│   ├── floatGallery/       # Float Gallery
│   ├── gallery2d/          # 2Dギャラリー
│   ├── shared/             # 共通UI
│   ├── themeGalleries/     # テーマギャラリー
│   └── ui/                 # shadcn/ui
├── lib/
│   ├── aura/               # AURA生成ロジック
│   ├── gallery/            # ギャラリーユーティリティ
│   ├── portfolio/          # ポートフォリオ機能
│   └── supabase/           # Supabaseクライアント
├── i18n/                   # 多言語対応 (next-intl)
└── styles/                 # グローバルスタイル
```

## 主要な公開URL

- `/` — トップページ
- `/white/2d` — White Gallery (2D)
- `/float/2d` — Float Gallery (2D)
- `/aura/*` — AURAポートフォリオ機能
- `/mypage` — マイページ

## 環境変数

`.env.local` に必要な環境変数を設定（詳細はチームに確認）

## デプロイ

Vercelでデプロイ。`main`ブランチへのpushで自動デプロイ。

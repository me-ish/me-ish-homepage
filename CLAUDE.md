# me-ish / ナトリ: Claude Code Instructions

## Project context
- Repo: me-ish/me-ish-homepage (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase, Stripe, Resend).
- 現役のプロダクトはナトリ（ポートフォリオ、依頼受付、案件管理、見積・支払い・納品）だけ。
- 旧サービス（me-ish ギャラリー / AURA / CARD）は 2026-10-10 に新規受付・公開を終了済み。停止の判定は `src/lib/legacyServiceSuspension.ts`（middleware から呼ぶ）。旧コードは終了案内と記録確認のために一部残っているだけなので、新しい機能を足さない。何を残しているかは `docs/cleanup-index.md` を見る。
- `src/features/etorie/` と `/etorie/demo/app` はナトリ受付のデモ・CI 試験に使っているので消さない。

## Non-negotiables
1) Never read secrets:
   - Do not open .env / .env.* or any keys/tokens/credentials.
   - If configuration is needed, ask for variable names only (never values).
2) Make minimal, scoped changes:
   - Avoid broad refactors unless explicitly requested.
3) Always show exact edits:
   - Provide file paths and precise replacement blocks (or full file for new files).
4) Command safety:
   - Never run destructive commands (rm -rf, wipe, format, mass delete).
   - Explain what a command does before asking to run it.
5) TypeScript discipline:
   - Keep types correct. Avoid "any" unless required and explained.

## Collaboration workflow (important)
- If asked to implement changes to a component, request the latest code of that component first, unless already provided.
- For partial edits, clearly specify where to replace (e.g., function name / surrounding snippet).
- バグ修正（原因と正解がほぼ一つに決まるもの）は、原因を説明したうえでそのまま実装してよい。
- 見た目・文言・運用ルールなど好みが分かれる変更は、実装前に案を2〜3個出して選んでもらう。

## Repo conventions
- App Router: src/app（画面は `src/app/[locale]/natori/`、API は `src/app/api/natori/`）
- ナトリのコード: `src/features/natori/`（下の構成ルールを守る）
- 共通部品: `src/components/ui/`（shadcn/ui）、Supabase 接続 `src/lib/supabase*`、認証 `src/lib/auth/`
- DB 定義: `supabase/migrations/`。テーブル一覧は `docs/supabase-tables-ja.md`（`npm run docs:supabase` で作り直す）

## natori feature structure (as of 2026-05)
natori feature は `src/features/natori/` 配下に集約済み。旧 `src/lib/natori/*` / `src/types/natori/*` / `src/components/natori/*` の互換 shim はすべて削除済みで、natori コードは必ず `@/features/natori/...` を直参照すること。

### フォルダ責務（厳守）

```
src/features/natori/
  components/   UI コンポーネント
  types/        型定義
  lib/          DB非依存の純関数
  constants/    定数 / mock data
  data/         ブラウザSupabase(RLS)経由データアクセス
  server/       server-only 処理
```

#### components/
- React UI コンポーネント。Client / Server Component どちらも可。
- DB アクセスや認可ロジックを直接書き増やさない。データ取得は `data/` または `server/` の関数経由。

#### types/
- natori 専用の型。DB 非依存のアプリ型・フォーム型・表示型。
- DB 行型をそのまま export しない（変換は `data/` / `server/` の責務）。

#### lib/
- DB 非依存の純関数・計算ロジック（pricing / scheduling / deliveryPlans / projects 正規化 など）。
- **依存禁止**: Supabase client/admin、`cookies`、`headers`、`process.env`、`fetch("/api/...")`、Next.js runtime API。
- ユニットテストはここに置く。

#### constants/
- natori 専用の定数・mock data（`mockProjects` 等）。
- 副作用なし。

#### data/
- ブラウザ Supabase client (`@/lib/supabase/client`) と RLS 経由のデータアクセス層。
- `"use client"` のコンポーネントから import してよい。
- **禁止事項**:
  - `import "server-only"` を付けない（client bundle で壊れる）。
  - `supabaseServer()` / `cookies` / `headers` / `redirect` / service role / `process.env.*_SECRET` を使わない。
  - 認可判定をしない（RLS に任せる）。
- ファイル名規約: 接頭辞 `supabase`（例: `supabaseProjects.ts`, `supabaseEvents.ts`）。

#### server/
- 真の server-only 処理（API route の service、認可、cookies/headers 操作、server Supabase、service role、環境変数）。
- **必須**: ファイル先頭に `import "server-only";`。
- **禁止**: Client Component からの import。間接的にでも client bundle に流入させない。
- 認可ヘルパ（`requireNatoriAdmin` / `requireNatoriAccess` / `canAccessNatoriManagement`）はここ。

### import 方向ルール
- `components/` → `lib/` / `constants/` / `types/` / `data/`（client component の場合）/ `server/`（server component の場合）
- `data/` → `lib/` / `constants/` / `types/`（`server/` 参照は禁止）
- `server/` → `lib/` / `constants/` / `types/` / 他 `server/`（`data/` 参照は禁止）
- `lib/` / `constants/` / `types/` → 同層と `types/` のみ（`data/` / `server/` / `components/` 参照は禁止）

### 迷ったときの判断
| 書こうとしている処理 | 置き場所 |
|---|---|
| 金額計算・日付計算・タスク正規化 | `lib/` |
| Supabase でユーザー自身のデータを RLS 経由で読み書き | `data/` |
| service role / 管理者権限 / cookies / redirect | `server/` |
| API route の中の業務ロジック | `server/`（route は薄く） |
| 表示用の定数・モック | `constants/` |
| 表示専用の型 | `types/` |

### 旧 path について
- `src/lib/natori/*` / `src/types/natori/*` / `src/components/natori/*` の shim は削除済み。新規・既存コードどちらも旧 path を使わない。
- `src/lib/natori/` ディレクトリも削除済み。natori gallery 作品データは `src/features/natori/constants/works.ts` に集約されている。
- API route (`src/app/api/natori/admin/projects/route.ts`) は HTTP I/O 中心に薄型化済みで、業務ロジックは `features/natori/server/projectsService.ts` に集約されている。


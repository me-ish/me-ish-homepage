# AGENTS.md

Shared working agreement for coding agents operating in this repo.

## Project basics
- Repo: Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Stripe + Resend.
- The only active product is Natori (portfolio, intake, case management, quotes, payments, delivery).
  The legacy gallery / AURA / CARD services were retired on 2026-10-10; do not add features to them
  (see `docs/cleanup-index.md`).
- App routes: `src/app` (Natori pages under `src/app/[locale]/natori/`, APIs under `src/app/api/natori/`)
- Natori code: `src/features/natori/` (folder rules in `CLAUDE.md`)
- Shared UI: `src/components/ui`

## Non-negotiables
- Do not open `.env` / `.env.*` or read secrets.
- Keep changes minimal and scoped to the request.
- Avoid broad refactors unless explicitly requested.
- Keep TypeScript strict; avoid `any` unless required and explained.
- Avoid destructive commands (e.g., `rm -rf`, reset, wipe).

## Collaboration workflow
- Read the current file before editing it (agent sessions can read the repo directly; do not ask the user to paste code).
- For partial edits, specify exact replacement blocks and locations.
- Bug fixes with one clear cause: explain the cause, then implement. Visual / wording / workflow preferences: show 2-3 options (with screenshots when visual) and let the artist pick before implementing.

## UI/UX conventions
- Maintain existing visual language unless asked to redesign. The public portfolio (`src/features/natori/components/portfolio/`) is "paper and stationery": cream paper background, hand-drawn frames (`.pf-sketch`), marker underlines (`.pf-marker`), paper buttons (`.pf-btn`). No English tracking labels, no card shadows, no decorative animation.
- Prefer Tailwind utility classes over new CSS files. Portfolio-wide rules live in `PortfolioStyles.tsx`; colors come from `constants/portfolioContent.ts` (`portfolioColors`).
- Use `next/image` for images except in the public portfolio, which deliberately uses plain `img` (object-fit overrides and the private-image guard in `middleware.ts`).

## Supabase/data conventions
- Keep queries typed and handle errors.
- Prefer `maybeSingle()` where a row may not exist.
- Log errors with a tagged prefix (e.g., `[profiles]`).

## Testing and verification
- Before pushing, run `npx tsc --noEmit`, ESLint on the changed files, and `npx vitest run` (the whole suite; CI runs it in every phase job, and a red job costs about 17 minutes to retry).
- Some tests pin source strings (e.g. `src/features/natori/constants/__tests__/portfolioDesignTokens.test.ts`). When a visual change breaks one, update the assertion to the new approved design in the same PR; never delete or skip it.
- CI phase jobs (`scripts/natori-phase-*/browser.mjs`) locate CTAs by accessible name (`相談・見積もり`, `作品を見る`) and check management button colors (`#BE185D`, hover `#9D174D`) and 4.5:1 contrast. Keep accessible names stable (decorations go in `aria-hidden`), keep `natoriPrimaryAction` colors, and keep the `fixed` class on the mobile sticky CTA. Phase 7 reports only `VISUAL_BROWSER_FAILED`; read its `check(...)` calls to find the cause.
- To look at a page locally (Vercel preview hosts return 403 by project rule): `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next dev -p 3100`, then screenshot `/etorie/demo/app/portfolio` (and `/portfolio/contact?structured=1`) with Playwright using `executablePath: '/opt/pw-browsers/chromium'`.
- If changes are non-trivial, say in the PR what was checked by hand and what the artist should check in production.

## PRs
- One topic per branch (`claude/natori-<topic>`), PR body in Japanese (目的 / 変更 / 確認). Squash-merge only after every check is green; production deploys from `main` automatically. Database migrations are applied to production by the artist, so state the SQL and the order (before or after the code) in the PR.
- Do not change production settings (Vercel rules, env, Supabase) from a session without an explicit go-ahead; never read `.env*` or secret values (variable names only).

## Related docs
- See `CLAUDE.md` for the natori folder rules.
- Remaining audit work and how to hand it to a new session: `docs/natori/Natori_Audit_20261101_Handoff.md` (report: `Natori_Audit_20261101_Report.md`).
- What legacy code is kept and why: `docs/cleanup-index.md`.

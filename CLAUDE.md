# me-ish / AURA: Claude Code Instructions

## Project context
- Repo: me-ish-next (Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase, Stripe, thirdweb).
- Products:
  - me-ish gallery
  - me-ish AURA (aiPortfolio)

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

## Repo conventions
- App Router: src/app
- Components: src/components
- AURA logic: src/lib/aiPortfolio


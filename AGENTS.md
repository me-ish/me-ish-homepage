# AGENTS.md

Shared working agreement for coding agents operating in this repo.

## Project basics
- Repo: Next.js App Router + TypeScript + Tailwind + shadcn/ui + Supabase + Stripe + thirdweb.
- App routes: `src/app`
- Components: `src/components`
- AURA logic: `src/lib/aura`
- AURA components: `src/components/aura`

## Non-negotiables
- Do not open `.env` / `.env.*` or read secrets.
- Keep changes minimal and scoped to the request.
- Avoid broad refactors unless explicitly requested.
- Keep TypeScript strict; avoid `any` unless required and explained.
- Avoid destructive commands (e.g., `rm -rf`, reset, wipe).

## Collaboration workflow
- If asked to edit a component and its latest code is not provided, request it first.
- For partial edits, specify exact replacement blocks and locations.

## UI/UX conventions
- Maintain existing visual language unless asked to redesign.
- Prefer Tailwind utility classes over new CSS files.
- Use `next/image` for images unless there is a clear reason not to.

## Supabase/data conventions
- Keep queries typed and handle errors.
- Prefer `maybeSingle()` where a row may not exist.
- Log errors with a tagged prefix (e.g., `[profiles]`).

## Testing and verification
- If changes are non-trivial, propose a quick manual check path.
- Do not run heavy tests unless requested.

## Related docs
- See `CLAUDE.md` for additional project-specific instructions.

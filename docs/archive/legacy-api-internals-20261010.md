# Retired legacy API internals — 2026-10-10

## Scope

Baseline: `3bb19000bfec71959299cc0678ef5c97eca42f8e` (PR #140).
Preservation branch: `archive/legacy-api-internals-before-20261010`.
The adjacent manifest records original paths, Git blobs, SHA-256, sizes and
line counts for all 16 replaced/deleted source files (132,707 bytes / 3,991 lines).
These are source counts, not deployment-size or image-storage savings.

PR #139 already stopped these URLs through middleware. This change removes
their dormant business logic and makes each exported handler independently
return the same 503 JSON and `Cache-Control: no-store` response.

| Route under `/api/` | Retained methods | Service |
| --- | --- | --- |
| `ai-guide` | POST | gallery |
| `aura/form/submit` | GET, POST | aura |
| `aura/form/ai-suggest` | POST | aura |
| `aura/studio/ai/polish` | POST | aura |
| `card/form/submit` | POST | card |
| `aura/checkout` | GET | aura |
| `card/checkout` | GET | card |
| `cron/exhibit-ending-soon` | GET, POST | gallery |
| `cron/exhibit-end` | GET, POST | gallery |
| `cron/exhibit-delete` | GET, POST | gallery |
| `cron/float-daily-slots` | GET, POST | gallery |
| `internal/send-submit-email` | POST | gallery |

The 17 handlers preserve their original runtime/dynamic/revalidation/duration
exports. They no longer parse requests, initialize provider clients, call
OpenAI/Stripe/mail, or read/write database or Storage objects. The shared
server response helper has no external effects. Middleware remains unchanged.

Remove only these now-unreferenced libraries:

- `src/lib/aura/aura.generate.ts`
- `src/lib/aura/aura.variant.ts`
- `src/lib/card/card.generate.ts`
- `src/lib/aiGuide/prompt.ts`

## Protected dependencies

Retain `aura.variant.base.ts`, schemas, renderers, published/preview/save paths,
Studio and its shared uploader, public gallery and AI-guide UI, bank/support,
customer fulfillment, Stripe webhook/COA, payout and Natori cron, and all
Natori/Etorie code. Studio's AI-polish button was already blocked by middleware;
this cleanup does not remove the Studio component or change that policy.

Retain the actual gallery upload route, `entryUpload`, `entryUploadGrant`, all
Phase scripts/workflows/fixtures, packages/lockfile, root layout/fonts and
Supabase migrations. This batch performs no database or Storage operation.
The OpenAI package remains required elsewhere.

## Verification

New direct-handler tests bypass middleware, cover every retained HTTP method,
and reject provider imports/network or request processing. Run them together
with existing suspension/publication-continuation tests. Normal CI supplies
the full unit/type/lint/e2e gates. No existing tests are removed or weakened.
This path set does not trigger Phase 0A; its actual upload dependencies are
unchanged. The previously accepted `braces` development-dependency audit
finding remains separate from functional validation.

## Restore for review

Original code remains in Git rather than an on-disk TypeScript archive that
would enter the current typecheck. To inspect it separately:

```sh
git fetch origin archive/legacy-api-internals-before-20261010
git worktree add --detach ../me-ish-legacy-api-reference-20261010 3bb19000bfec71959299cc0678ef5c97eca42f8e
```

Any reintroduction requires a new reviewed change. Restore only the intended
manifest paths on a new branch, retain newer Natori work, and retest imports
and behavior. Restoring these internals alone does not reopen the service:
middleware and the earlier database restrictions remain separate controls.
Do not revert all of main or remove the earlier suspension migration.

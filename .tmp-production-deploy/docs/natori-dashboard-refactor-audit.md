# Natori Dashboard Refactor Audit

Date: 2026-05-21

This note records the current structure and a low-risk migration plan for moving from the paused me-ish gallery product toward a Natori production support dashboard.

## Current Shape

- Framework: Next.js App Router with the active locale root at `src/app/[locale]`.
- Existing Natori public pages:
  - `src/app/[locale]/natori/page.tsx`
  - `src/app/[locale]/natori/links/page.tsx`
  - `src/app/[locale]/natori/links/layout.tsx`
  - `src/app/[locale]/natori/works/[slug]/page.tsx`
  - `src/components/natori/*`
  - `src/lib/natori/works.ts`
- Shared assets worth keeping:
  - `src/components/ui/*`
  - `src/lib/supabase/*`
  - compatibility Supabase wrappers: `src/lib/supabaseClient.ts`, `src/lib/supabaseServer.ts`, `src/lib/supabaseBrowser.ts`, `src/lib/supabaseAdmin.ts`
  - `src/lib/auth/*`
  - `src/lib/sanitize.ts`, `src/lib/apiResponse.ts`, `src/lib/rateLimit.ts`, `src/lib/utils.ts`
  - `src/components/providers/QueryProvider.tsx`
  - `src/components/contact/ContactForm.tsx`
  - `src/components/legal/LegalNotices.tsx`
- Product-specific modules currently mixed under the same app:
  - Gallery product: gallery routes, entry routes, purchase routes, payout admin, certificate routes, 2D/3D gallery components.
  - AURA product: `src/app/[locale]/aura`, `src/app/api/aura`, `src/components/aura`, `src/lib/aura`.
  - Card product: `src/app/[locale]/card`, `src/app/api/card`, `src/components/card`, `src/lib/card`.

## Gallery-Specific Code

Treat these as legacy-gallery candidates. Do not delete them until route traffic, DB dependencies, webhooks, and admin workflows have been confirmed inactive.

### Routes

- `src/app/[locale]/white/*`
- `src/app/[locale]/float/*`
- `src/app/[locale]/galleries/forest/page.tsx`
- `src/app/[locale]/entry/*`
- `src/app/[locale]/works/[id]/*`
- `src/app/[locale]/purchase/*`
- `src/app/[locale]/receipt/[sessionId]/*`
- `src/app/[locale]/cert/*`
- `src/app/[locale]/settings/bank/page.tsx`
- `src/app/[locale]/guides/sales/page.tsx`
- Gallery-facing parts of `src/app/[locale]/mypage/*`
- Gallery-facing parts of `src/app/[locale]/artists/*`

### APIs And Admin

- `src/app/api/purchase/*`
- Gallery sections inside `src/app/api/webhook/stripe/route.ts`
- `src/app/api/entries/*`
- `src/app/api/cert/*`
- `src/app/api/files/download/route.ts`
- `src/app/api/cron/exhibit-*`
- `src/app/api/cron/float-daily-slots/route.ts`
- `src/app/api/cron/close-monthly-payout/route.ts`
- `src/app/api/cron/payout-reminder/route.ts`
- `src/app/api/admin/payouts/*`
- `src/app/admin/entries/*`
- `src/app/admin/payouts/*`
- Gallery entry-related APIs under `src/app/admin/api/entries/*`

### Components

- `src/components/whiteGallery/*`
- `src/components/floatGallery/*`
- `src/components/gallery2d/*`
- `src/components/themeGalleries/*`
- `src/components/entryForm/*`
- `src/components/purchase/*`
- `src/components/cert/*`
- Gallery-specific pieces in `src/components/shared/*`: `ArtworkFrame`, `Avatar*`, `Gallery*`, joystick/camera/zoom display components.

### Lib, Types, Data, Assets

- `src/lib/gallery/*`
- Gallery-specific parts of `src/lib/portfolio/*`
- `src/lib/coa/*`
- Gallery purchase/payout email templates in `src/lib/emailTemplates/*`
- Entry/gallery schemas in `src/lib/schemas/entry.ts`
- Gallery tables and views in generated Supabase types: `entries`, `entry_*`, `sales`, `payout*`, `cert_links`, `v_pending_payouts`, `v_admin_entry_workflow`, `entry_view_stats`.
- Gallery specs and assets:
  - `public/gallery_structure.json`
  - `public/GALLERY_SPEC.md`
  - `public/models/test-float.glb`
  - gallery-only sample images and textures if no other product uses them.

## Reusable Code

Keep these for the Natori dashboard unless a later audit proves they are dead:

- Supabase clients and typed DB access: `src/lib/supabase/*`, wrapper files in `src/lib/supabase*.ts`, `src/types/supabase.ts`, `src/lib/supabase/database.types.ts`.
- Auth and admin helpers: `src/lib/auth/*`, `src/lib/isAdmin.ts`, `src/lib/adminAudit.ts`.
- UI and layout primitives: `src/components/ui/*`, `src/components/providers/*`, `src/lib/design/*`, `src/lib/utils.ts`.
- Safety utilities: `src/lib/sanitize.ts`, `src/lib/apiResponse.ts`, `src/lib/rateLimit.ts`.
- Contact/email infrastructure where generic: `src/components/contact/ContactForm.tsx`, `src/lib/emailTemplates/generateContactEmail.ts`, `src/app/api/send-email/send-contact/route.ts`.
- Natori public assets and components: `public/natori/*`, `public/og/natori-links.jpg`, `src/components/natori/*`, `src/lib/natori/*`.
- AURA and card modules should stay separate. They are not gallery-old, and their Stripe webhook branches must not be removed as part of gallery cleanup.

## Recommended Target Structure

Because this repo uses `src/app/[locale]`, route code should stay locale-aware unless the i18n strategy changes:

```txt
src/app/[locale]/natori/
  links/
  estimate/
  projects/
  prices/
  templates/
  admin/

src/app/api/natori/
  estimate/
  projects/
  prices/
  templates/

src/components/
  common/
  natori/
  ui/

src/lib/
  auth/
  supabase/
  natori/

src/types/
  natori/

_archive/
  gallery-old/
```

Recommended Natori module split:

- `src/lib/natori/pricing.ts`: pure pricing tables and estimate calculation.
- `src/lib/natori/projects.ts`: project status types and server-side query helpers.
- `src/lib/natori/templates.ts`: reply template types and text helpers.
- `src/lib/natori/validation.ts`: Zod schemas for dashboard forms and API payloads.
- `src/types/natori/*`: dashboard domain types that should not depend on gallery `entries`.
- `src/components/natori/dashboard/*`: dashboard shell, sidebar, table, form, and editor components.

## Move Or Archive Plan

Phase 1, no behavior change:

- Add this audit note and `_archive/gallery-old/README.md`.
- Keep all active code in place.
- Add a route ownership map before moving files.

Phase 2, explicit deprecation:

- Add comments or docs marking gallery routes as paused.
- Hide gallery CTAs from public navigation if product direction requires it.
- Keep `/natori/links` untouched.

Phase 3, archive after confirmation:

- Move gallery-only components into `_archive/gallery-old/src/components/...`.
- Move gallery-only public specs/assets into `_archive/gallery-old/public/...`.
- Move gallery-only docs into `_archive/gallery-old/docs/...`.
- Do not move API routes, Stripe webhook branches, admin payout code, or Supabase migrations until production traffic and DB usage are verified.

## Current Risks Noted

- `src/lib/natori/works.ts` and Natori pages contain mojibake strings and several image paths that appear to be mojibake versions of real filenames. This is a content/data cleanup task, not part of the folder refactor.
- `src/app/[locale]/natori/links/page.tsx` uses `(lk as any).iconText`; replace with a discriminated link type when touching this page.
- Supabase wrappers are duplicated between `src/lib/supabase/*` and compatibility files. Keep compatibility wrappers now; migrate new Natori code to `@/lib/supabase/server` and `@/lib/supabase/client`.
- Gallery, AURA, and card all share the Stripe webhook. Any gallery deprecation must preserve AURA/card checkout handling.

## Verification On 2026-05-21

- `npm.cmd run lint`: passed with existing warnings.
- `npx.cmd tsc --noEmit --pretty false`: passed.
- `npm.cmd test`: passed, 14 files and 129 tests.
- No `npm run typecheck` script exists in `package.json`.


# Phase 7 server-error investigation — 2026-10-10

## Observed failure and correction to the previous report

PR #154's `ready_for_review` run [38052662090](https://github.com/me-ish/me-ish-homepage/actions/runs/38052662090), head `ac10dd85410253a32128d4ad022e4d609b18bc2b`, failed at 12:51 UTC. The earlier run [38051281229](https://github.com/me-ish/me-ish-homepage/actions/runs/38051281229) on the same head passed. The earlier cleanup report missed this later failure. The standard main CI passing after PR #153 did not rerun or supersede this separate workflow.

Artifact `11670067624` records Phase 6A's five browser cases, three reload-persistence checks and four captures as successful, with no route failures. However, `compileErrors: ["SyntaxError"]` correctly failed its final gate. Phase 6B/7's subsequent visual checks were not reached in that failed run. This is unrelated to the braces audit policy. No original raw stack/message was retained, so the exact historical exception cannot be conclusively reconstructed.

## Reproduction and bounded remedy

A disposable local app using the installed Next.js **15.5.27**, React 18.2.0 and Node 24.19.0 reproduced the same class of error without Supabase, credentials, Natori data or mail/Stripe access. It has a locale layout returning `ja`/`en` from `generateStaticParams`, eight trivial dynamic pages and 40 concurrent requests per server start. The build directory is reused across three starts, like the sequential isolated browser suites.

- Original: starts 1/2 returned 40/40 HTTP 200; start 3 returned 35 HTTP 200 and **5 HTTP 500**, with `SyntaxError: Unexpected end of JSON input`.
- A separate source-classification run reproduced 10 HTTP 500 responses and identified `next/dist/server/load-manifest.external.js` as the JSON parser caller. Parsed contents and raw stacks were not exported.
- Development-only empty static params: **120/120 HTTP 200 across three starts**, zero detected server errors.

The installed Next implementation in `server/dev/next-dev-server.js` reads/parses and rewrites the shared prerender manifest without an atomic replacement; `server/load-manifest.external.js` synchronously parses it. The manifest was valid again after requests completed, consistent with a transient read during a write. Upstream reports document this race in other Next versions: [#96664](https://github.com/vercel/next.js/issues/96664), [#96259](https://github.com/vercel/next.js/issues/96259). Our local 15.5.27 reproduction, rather than the other versions alone, grounds this remedy. This is a strong explanation for the historical CI failure, not proof of its lost stack.

`src/app/[locale]/layout.tsx` now returns an empty static-params list **only in development**. Next resolves supported locale pages on demand, avoiding the development manifest writer. Production builds still enumerate `ja` and `en`; runtime locale validation and translations are retained. This is not a dependency upgrade or a suppression/retry of SyntaxError.

## Diagnostics and acceptance

The Phase 6A runner now records only fixed server-error classifications and numeric case indexes, handles errors split across output chunks, and bounds diagnostic noise. It exports no raw messages, request bodies, URLs, credentials or arbitrary stack paths. Server errors still fail the job. The result distinguishes successful individual cases from a failed overall server-output gate (`SERVER_OUTPUT_ERRORS`), rather than implying that five successful cases mean the suite passed.

Local regression checks: six locale tests cover production params, supported development locales and unsupported-locale rejection; four diagnostic tests cover split streams, disclosure protection and bounded output. Type check, final GitHub checks and preview-build results are recorded below when complete.

Production rollout requires owner confirmation. No DB, Storage, business operation or dependency change is part of this PR. Real card payments, delivery emails and real requests are not exercised by these isolated tests.

## Diagnostic-only CI and a second harness race

Diagnostic-only head `e7ace582ef2dc9c31c92d214db157f80ef729d9a` completed Phase 6A (38058258170) and Phase 7 (38058258189) successfully; the old SyntaxError did not recur in those runs. Standard CI 38058258178 passed, with 1,984 unit tests and 111 first-pass browser cases, one successful retry (Phase 5's 360px navigation timeout), and two existing skips.

Phase 6B run 38058258176 failed `important-cta-all-states-light`, with seven other cases successful and no server compile errors. Artifact 11671254695 records all light-theme mobile contrast samples through `hover`, but no `focus` sample. The test reset focus to a button at the top of the document and then pressed Tab, which could scroll the Hero into view. The real mobile CTA correctly disappears when the Hero is visible, so the test could lose its target before its programmatic focus sample.

The contrast harness now prevents scroll while resetting/focusing controls. Tab still establishes keyboard modality, but its default movement is suppressed in this color/focus-style sampling helper; neither the old nor new helper tests tab order. Color contrast (4.5), focus-visible and outline requirements are unchanged. A mandatory isolated Chromium control first proves that the old reset hides a synthetic IntersectionObserver-controlled CTA, then requires the corrected path to retain its visibility, scroll position and keyboard focus ring. Its booleans are saved in `focusControls`. The real CTA component and its hiding behavior are unchanged.

The local Chromium control could not run because the browser binary download returned an invalid archive. The mandatory control and all actual eight Phase 6B cases must pass in the pinned CI browser before acceptance; this is not treated as locally verified.

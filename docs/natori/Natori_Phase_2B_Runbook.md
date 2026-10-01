# Natori Phase 2B: stacked Draft and verification boundary

Depends on unmerged Draft PR102 branch codex/natori-phase-2a. Current base includes the follow-up replacement-action freeze and explicit candidate fixture. Do not merge or deploy this stack automatically; retarget only after reviewing the actual merged base.

F08: Natori-specific durable inbox dispatches after signature verification and before shared event claim. Other product handlers are unchanged. Processing returns retryable503; only completed or durable needs_review receives200. Project-first completion checks claim token, generation and lease; payment/session ledger effect, event completion and notification intent commit together. Existing amount/quote/session checks are retained; accepted quote amount, owner and currency receive additional guards. Existing transactions/events are not rewritten. Legacy payment with unknown mail history produces no inferred resend. Closed/archived delayed payment records funds without reopening work. Expand-only, feature flag NATORI_PAYMENT_INTEGRITY_ENABLED, explicit NATORI_STRIPE_MODE=test/live.

## Available isolation and missing actual Stripe profile

Read-only inspection (names only, no secret values): repository secrets=[], repository variables=[]; Preview environment secrets=[], variables=[]. Environments exist for Preview and several Production deployments, but production configuration was not inspected. Existing PhaseT explicitly excludes actual Stripe and denies inherited Stripe credentials/external egress. No new credentials, environments or webhooks were created.

Synthetic CI reuses disposable real DB/Auth/Storage with sealed networking. Stripe SDK generates signatures from a per-run random fake secret; this verifies actual route signature code and DB recovery, NOT provider delivery or real Stripe test-mode objects. The PC has no Docker, so DB tests run on disposable Linux CI.

For actual provider evidence, parent must arrange a separate test-only profile (suggested GitHub environment NatoriStripeTest, currently absent), not generic Preview: secret names NATORI_STRIPE_TEST_SECRET_KEY (existing test-only restricted API credential), NATORI_STRIPE_TEST_WEBHOOK_SECRET (dedicated test destination signature); non-secret variables NATORI_STRIPE_TEST_ACCOUNT_ID and NATORI_STRIPE_TEST_ENDPOINT_URL. Map secret names into runtime STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET only inside a reviewed test runner; set NATORI_STRIPE_MODE=test. Dedicated ephemeral DB and synthetic owner/customer fixtures are required. Do not pass production/Vercel keys, existing customer records or mail credentials into this profile.

Required provider permissions: test Checkout sessions/events read for2B; test products/prices/payment links write and read for2C; test payments/refunds read and synthetic test refund creation for2D. Existing credential should have least necessary scopes. Test webhook destination subscribes only to required test Checkout events, adding refund events in2D. GitHub settings/CI environment management is needed to supply the profile securely. Do not ask for secret values in chat or open.env files. No credential creation or production Stripe operations are authorized.

## Verification and resume

Mandatory isolated tests: same event concurrency, separate event/same session, abandoned claim503 then lease recovery, fencing old worker, DB/committed-response/ACK loss, legacy shared event with no transaction, known historical transaction with unknown mail, amount/quote/currency mismatch, duplicate session, terminal delayed payment and signature/mode/anon denial. Full unit regressions protect AURA/CARD/entry/gallery dispatch. Prior N and2A DB/browser suites run before2B. Actual process kill and real Stripe test-mode delivery remain separate outstanding acceptance evidence; simulated omitted completion must not be described as a killed process.

U05 reads payment_confirmed_at and durable inbox facts; confirmed payments no longer display perpetual payment-guide waiting. Public failure is unavailable, not unpaid. Management lists owner-scoped needs_review and lease-expired processing. These views still need dedicated regression verification before2B is declared complete. Rollback keeps inbox-aware consumer and received facts; never restore legacy insert-only dedup for new inbox events or delete events/transactions. This PR authorizes no merge, productionDB/env/deploy or real mail.

If actual Stripe2B–2D verification remains blocked, retain their explicit pending gates and progress independent3A,3B,5 and6 work. Phase2C depends on2A/2B schema and provider profile;2D depends on the inbox. Phase7 records remaining acceptance gaps rather than claiming success. Phase4 is already deployed and is not recreated.

## Initial code checkpoint

Stack base: 0598f2cb1bc5bd667aa9b19ac16c74c5b903c811, PR102 follow-up freeze fix. Its Phase2A run36884386058/job110443846531 passed DB14/browser6 and cleanup0; existing regression workflows passed, including all general CI jobs. Earlier two failed freeze-test runs were fixture/selector errors, not product success evidence: the final case changes price to leave the candidate and uses the actual button label.

Local2B type/lint/checksum/bundles/shell syntax passed. Before adding the public read-model views, full unit suite1240/136 passed; after adding views/5 new tests, targeted37/4 passed. Full exact-head CI and the15 real isolated DB/synthetic signed-event cases have not yet passed and are mandatory. No actual Stripe provider/profile/process-kill evidence. Do not call Phase2B complete at this checkpoint.

Resume: inspect current branch/head/status and existing runs; fix SQL/integration or regression failures without bypassing gates; verify owner-scoped attention and public payment views against real DB; retain explicit actual-provider gap. Preserve the Phase2A stack until reviewed/merged independently; never auto-merge. Then2C/2D implementation may proceed with provider gates pending, and independent3A/3B/5/6 work should continue.

## First isolated run and follow-up

Head036a674: run36886058711/job110449530581 passed full unit/type/static gates, previous PhaseN DB23/browser9 and2A DB14/browser6. New2B passed14/15; separate-event/same-session returned503 because local purpose and notification column purpose were ambiguous in the reuse SELECT. Rename local to v_purpose without changing replay semantics; rerun on the new exact head. cleanup exit1 propagated the failed mandatory gate and must not be described as a cleanup operation failure without its evidence.

Additional mandatory evidence now has18 cases, including actual SIGKILL of a dedicated fixture-only child at claimed and committed-before-ACK boundaries, owner reclaim/completion/read denial, and payment-state/review-attention against real DB facts. The first lease test is no longer merely omitted completion; assertions verify SIGKILL and recovery. Actual Stripe delivery remains pending and is separate from SDK synthetic signatures. Newinbox service_role privileges explicitly omit DELETE despite Supabase default grants. This follow-up head is not yet verified.

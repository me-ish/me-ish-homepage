# Phase 6A / F19 prepared implementation

Task mutation sends one task key and a done flag. `natori_update_task_v1` locks the owner project first, then task rows in stable order, changes one flag and derives status/next action from the newest DB tasks within that transaction. The old `natori_update_task_and_status` wrapper retains its signature and ignores client status/next action. No task write establishes payment, delivery, completion or requester receipt, or reopens closed/completed/archived projects.

`mutation_revision` advances on every project update, including payment, close, delivery and acceptance. Its DB and client checks cap the revision at JavaScript's safe integer limit. A task result carries a canonical projection and revision. The board stores confirmed rows separately from local checkbox intents, rejects equal/older task responses, and reloads coherent server rows after conflicts. A single SQL statement reads project/revision and task rows for GET. Older requests cannot rewind newer task/lifecycle facts or erase a row updated/created while their snapshot was loading.

Legacy material rows remain stored without bulk correction. They are excluded from the pending production projection because the existing UI hides them. All editable tasks checked means `delivery_prep` and a delivery notification action; it never auto completes or records final receipt. Existing finish/delivery stage mappings remain `delivery_prep`. Demo interactions remain local and do not fabricate payment evidence.

Migration was generated in the task preparation directory with installed Supabase CLI 2.109.1, `supabase migration new natori_task_integrity`, with telemetry disabled. No linked project, production DB, customer rows, real provider or real mail was used.

## Application and verification

1. Integrate preceding Phase 2D/3A/3B/5 implementations before this phase. Review `edits.json` exact/scoped blocks, `edits.patch`, source hashes and prepared hashes. Prepared full files are review artifacts; apply the guarded blocks to current files so independent refund/reference changes survive.
2. Run the task applicator without `--apply`; it validates existing blocks, new destinations and all existing migration checksums. Repository writes require the active authorized parent execution environment. `--apply` backs up existing files, writes source/migration changes and registers only the new manifest entry. It does not commit, push or execute migrations.
3. Run full repository strict types, lint, unit tests and baseline static verification after parent integration. Create a normal commit and dependent Draft PR with its base and head SHA. Keep production merge/deploy/DB execution separately authorized.
4. The sealed Linux Phase T runner installs the Phase 6A migration immediately after the Phase N fixture, before any prior management browser reads the new coherent GET. It runs Phase 6A tests after earlier phase fixtures/tests. Preserve prior flags and mounts during shared runner integration.
5. Require 12/12 Phase 6A DB scenarios and 5/5 real-session Chromium scenarios with zero skips, plus the preceding phase gates. Unit/component tests cover reverse responses, same/different tasks, pending overlays, missing older list rows, immutable terminal/payment facts, failure recovery and demo behavior.

Prepared DB scenarios include two clients on different/same tasks, a blocked worker reading the committed latest tasks, legacy forged projection parameters, hidden material history, last task versus conditional stage writer, synthetic signed payment webhook, close/receipt races and a coherent snapshot before/after an uncommitted transaction. Browser tests use real disposable Supabase sessions, actual task routes and actual board; response delay/reversal is only in the test transport. No real Stripe call or mail is allowed.

## Deferred evidence and manual acceptance

The preparation's source graph types, lint, unit/component tests and bundle compile pass locally. DB and Chromium scripts are prepared for the sealed GitHub Linux job and have not been executed for Phase 6A at this checkpoint. Windows has no callable Docker/psql test stack. Passing an earlier phase's CI does not count as Phase 6A DB/browser success.

`scripts/natori-phase-6a/dry-run-corrections.sql` is a read-only candidate report requiring an explicitly supplied owner. It is not executed here and contains no update/delete statement. Existing row repair requires a separate reviewed plan and authorization. Completed/closed reopen behavior remains separately deferred.

Quick manual check after isolated CI: in a disposable synthetic project with a paid fixture in the isolated database, toggle two tasks rapidly, then check/uncheck the same task; compare status, next action and flags after reload. Check the final task leads to delivery preparation. Open a second tab and confirm payment/close/receipt cannot be undone by a delayed task response. For an old hidden material task, finish visible tasks and confirm the hidden raw flag is retained. Real mail and iPhone Safari acceptance occur with the user after Phase 7.

## Correction validation before renewed isolated CI

The shared read-model payment-date normalization also applies to task projection guards and assignment. A legal legacy row with `paid_at = NULL` and an existing `payment_confirmed_at` retains both raw facts and can display a committed task result. The task result includes twelve explicit row-backed metadata fields from the same locked project row; advancing its revision preserves a concurrently committed title, client, amount, dates and note. Related reference/refund/consultation rows remain outside this task projection. No token hashes, leases or whole raw project rows are returned.

Two new unit files add nine regression cases. The previous source reproduces six behavioral failures; corrected source passes all 1,531 unit cases in 177 files with zero skips, strict types, scoped lint and baseline/schema/fixture checks. Every prior 1,522 and Phase 5 1,488 test identity is retained.

The original run 36995588116 at head 35f7495749a140711e7294c5cbab660deed1f4d5 remains a failed diagnostic: prior 349 cases passed, Phase 6A DB ran 11 passing and one QUOTE_FIXTURE failure, and the five Phase 6A browser cases did not execute. Quote setup now follows the actual lifecycle trigger: create its quote during inquiry, then enter awaiting payment. Legacy-null payment and a real details PATCH followed by held GET/task responses are asserted by the renewed fixtures. Acceptance still requires a new exact-head isolated run with all 12 DB and five browser cases and all preceding gates passing.

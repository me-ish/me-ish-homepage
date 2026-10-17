# Natori audit followups 2026-10-17

Base: `main@b29e9dbd987fc0ad7d2ba404c8138f06c214a028` (PR #179).
Source audit: Natori_Audit_Report_2026-10-16.md, U01/U02/U03 and S01 preparation.
The reduced dashboard and portfolio from PR #179 are retained.

## Implemented in this change

| Audit ID | Change | Verification |
| --- | --- | --- |
| U01 | Successful changed-history reads notify the staff parent for new messages, rough OKs, closed state and notification changes, whether found by polling, manual refresh or focus resume. Callback identity changes do not restart the reader. | Actual panel/thread with synthetic client reply updates the parent label; unchanged polls do not loop; failed reads keep the draft and do not publish a false projection. Existing operation/ownership/rough followup tests remain green. |
| U01 | Inquiries and dashboard refresh when returning to the visible page. Related focus/pageshow/visibility events are coalesced. Detail/mail/busy editors pause inquiry refresh, including late responses, and dashboard resume only reads project counts so profile inputs are not replaced. | Resume-hook tests cover visibility, enabled state, overlapping requests, latest callback, errors/retry and cleanup. Real management-form tests retain an edited profile and detail amount across resume and late responses. |
| U02 | Once opened, the staff conversation remains mounted while showing project details, keeping the actual File objects and text. Hidden conversations stop polling and ignore late background history reads until reopened. Closing or Escape asks before discarding a draft; reopening returns focus to the composer. | Round-trip with text and PNG, close/Escape cancellation, hidden polling, late reads, immediate reopening after initial-load cancellation, actor isolation and no unintended POST/session-storage write. |
| U02 | Unsent text, selected files, pending send or in-flight action installs a browser beforeunload guard. | Client draft prevents a cancelable unload event; clearing the draft removes the guard. Browser/mobile support remains a manual gate. |
| U03 | Rough cards carry the actual message ID, display submission order and Japan-time date/time, and link to the exact message and attachment. Approval confirmation identifies the selected submission. | Two same-day submissions link to their own actual message/file; confirmation and POST match the selected rough ID. Answered/terminal cards retain identification without reintroducing prohibited actions. |

The rough number describes the order in the currently displayed set; it is not a
new stored contract revision. The existing rough ID remains the approval identity.
No quote, payment, rough-OK, delivery, authorization or database fact is rewritten.

Drafts are retained in memory for the project-details round-trip. They are not
automatically copied into browser storage. Browser reload/close protection is a
best-effort warning, not a guarantee of restoration after navigation, an OS kill,
or browser termination. Existing durable recovery for an already attempted send
is preserved. Verify iPhone Safari behavior before treating U02 as fully accepted
across supported devices.

## S01 preparation, not a completed production fix

Read-only aggregate preflight on 2026-10-17 still found:

- Public `natori-portfolio`: 42 objects, including 12 legacy project thumbnails
  and 3 `refs/` objects requiring classification.
- Private `natori-management-assets`: 0 objects.

`supabase/operations/natori-legacy-management-assets/inventory.sql` produces an
owner-scoped private candidate manifest with review-required defaults. It does
not copy/delete objects, change references, alter buckets or assume that an
unreferenced object is safe to retire. Its SELECT was checked with EXPLAIN against
the current catalog using a synthetic owner UUID; EXPLAIN did not fetch objects
or customer rows. The companion README defines copy verification, conflict stops,
public-reference review, selective origin retirement and CDN/rollback limits.

Publication/contract classification is still required before a production
cutover. Private manifests and real object associations must remain outside
GitHub, public logs and CI artifacts. S01 remains open.

## Validation

- TypeScript: `npx tsc --noEmit`, pass.
- ESLint for all changed TypeScript/TSX product and test files, pass.
- Focused Vitest suite: **22 files / 179 tests pass**, including **19 new cases**.
- `git diff --check`, pass.
- No full-suite, real-browser, Stripe, Resend, production-write, Storage-copy,
  migration, merge or release was performed locally.
- Local runtime is Node 24.19.0; repository/CI target is Node 22. CI is the
  appropriate place to confirm the same commit on the target runtime.

Test command:

```sh
npx vitest run \
  src/features/natori/components/consultation/__tests__ \
  src/features/natori/components/dashboard/__tests__/InquiryDetailPanel.auditFollowups.test.tsx \
  src/features/natori/components/dashboard/__tests__/InquiryDetailPanel.test.tsx \
  src/features/natori/components/dashboard/__tests__/InquiryTalkMenu.test.tsx \
  src/features/natori/lib/__tests__/talkTimeline.test.ts \
  src/features/natori/components/admin/__tests__/useRefreshOnResume.test.tsx \
  src/features/natori/components/dashboard/__tests__/InquiriesBoardFilter.test.tsx \
  src/features/natori/components/dashboard/__tests__/DashboardTodaySummaryLink.test.tsx \
  src/features/natori/components/dashboard/__tests__/ManagementResumeDrafts.test.tsx
```

## Preview/manual acceptance

Use only a dedicated test environment and synthetic owner/client data.

1. At desktop and 390px width, open a staff conversation, type text and select a
   PNG. Visit project details, return, and confirm both remain. Cancel close and
   Escape, then confirm closing explicitly. Check no message was sent.
2. With the staff conversation open, send a client message from another test
   tab. Confirm the message, reply-waiting label, attention filter and counts
   agree after refresh. Leave and resume the inquiries/dashboard tab; ensure a
   failed read is visible and does not erase an unsent draft.
3. Submit two same-day roughs with different attachments. Use each card's link
   and keyboard to reach the intended message. Check both confirmation text and
   the stored rough ID. Repeat with an answered rough and a closed project.
4. On a real iPhone Safari, verify keyboard, scrolling to the anchor, returning
   focus, draft warning and the limitations of beforeunload. OS termination
   cannot be certified by jsdom tests.

## Next work

S01 classification/cutover remains highest priority. The remaining audit items
Q01 (extended delivery resend), Q03 (stale metadata saves), S02/S03/O01 (shared
link revocation, message quota, payment stop recovery), W01 (canonical workflow),
Q02 (amendments/corrected delivery), D01 and S04 are not claimed fixed here.
Keep the original immutable business evidence and use separate reviewed changes
for database, financial or contract-flow work.

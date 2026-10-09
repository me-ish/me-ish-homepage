# Legacy service stop: database boundary

This operation complements the application's gallery / AURA / CARD suspension.
It does not delete or rewrite business rows, files, buckets, old policies, or
historical migrations. It is deliberately separate from Phase T / Phase 0A.

## Reviewed changes

- Add restrictive INSERT and UPDATE policies for `anon` and `authenticated` on
  `entries`, `profiles`, and `portfolio_settings`. Existing gallery profile and
  portfolio editing is paused as well as new entries. Existing SELECT and DELETE
  behavior is preserved. New `likes` and `entry_comments` INSERTs are also
  denied; existing unlike/delete and comment soft-delete behavior is preserved.
- Add command-specific restrictive INSERT / UPDATE policies for the seven legacy
  Storage buckets. The four `natori-*` buckets and all object reads remain
  unchanged. Storage table grants, bucket settings, object names, and bytes do
  not change.
- Revoke client and PUBLIC execution of the two AURA promotion RPCs plus
  `set_entry_portfolio_hidden`, `increment_entry_likes`, and `toggle_like`.
  Existing explicit `service_role` execution remains unchanged. The financial
  `finalize_sale` and `admin_mark_sales_paid` RPCs are not altered.

The reviewed production catalog already denies client writes to `aura_requests`
through RLS and to `card_requests` / `aura_projects` through table privileges.
The `renewals` table does not exist in that catalog. No placeholder table or
new access grant is created to match stale application code.

Bank-account maintenance, manual payout operations, Auth, `admin_emails`,
`processed_stripe_events`, and all Natori tables/functions remain unchanged.
Server-role operations bypass these policies; the matching application guards
are therefore an essential part of the stop.

## Before applying

1. Obtain a fresh read-only catalog and compare the target RLS state, RPC ACLs,
   role boundaries, and remaining client-writable paths with this reviewed scope.
   Review any drift; never remove preflight checks simply to proceed.
2. Pass the dedicated `Legacy service stop SQL` CI gate and the application stop
   checks. This gate tests PostgreSQL permissions with a synthetic fixture. It is
   **not** a Supabase Storage restore, HTTP upload, or production application test.
3. Deploy and verify the application's new-use stop, including the gallery
   upload **sign and finish** actions and server actions. Keep existing public
   pages, image proxies, Natori intake, and Stripe webhook processing working.
4. Capture the protected Natori catalog/data counts and published page/image
   checks for comparison after the operation. Preserve a reviewed before-state
   catalog outside Git; do not commit personal data or credential-bearing URLs.

`apply.sql` uses a transaction, short lock timeout, and fail-closed preflight. In
an explicitly reviewed SQL session, set `meish.legacy_stop` to `apply-20261009`,
then execute that complete file. It must run as the existing `postgres` role;
it creates no credential or role. Do not run all project migrations as a shortcut.
A repeat application intentionally fails rather than silently accepting drift.

Signed gallery upload URLs issued before the application stop can remain valid
for two hours. These policies must not be described as revoking those URLs.
Record the application cutover time and recheck the affected object counts after
the validity window. Do not rotate shared signing keys or remove a bucket.

## Verification and rollback

Read the catalogs after application: the ten added policies must match the
reviewed expressions, the five writer RPCs must deny `anon` / `authenticated`,
and their existing `service_role` execution must remain available. Compare all
protected catalogs and the public/private read checks. Do not test attempted
writes against real customer rows or objects.

If rollback is required, keep the application's suspension active while deciding
whether creation should resume. Set `meish.legacy_stop` to `rollback-20261009` and
execute the complete `rollback.sql`. It first verifies the added policy definitions
and reduced RPC ACLs, then drops **only** this operation's policies and restores
exactly the reviewed grants. `toggle_like` originally had no explicit `anon`
grant, so rollback restores PUBLIC and authenticated grants only. ACL equality
means the same grantor/grantee/privilege sets; array ordering is irrelevant.

Rollback does not reverse legitimate data changes made by other processes. No
production row or Storage object is deleted by either operation.

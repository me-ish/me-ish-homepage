# Etorie P1-05 intake RPC verification runbook

## Scope and current status

This runbook covers the isolated-environment review of:

- `public.natori_create_project_with_tasks_v2`
- `public.natori_confirm_project_type_v1`

The migration and SELECT-only catalog verification were prepared locally. No
production or verification Supabase project was connected to or changed while
preparing them. The transactional behavior below therefore remains a remote
verification gate; it is not represented as already proven evidence.

## Frozen RPC contract

`natori_create_project_with_tasks_v2` accepts an explicit owner and project ID,
requester name/email, validated RequestData V1, uploaded reference-file paths,
and normalized reference links. The server generates one UUID before upload and
uses it as both the submission ID and `natori_projects.id`. Reference images are
therefore scoped as `{projectId}/{fileUuid}.webp`, and the project primary key
enforces one project per submission.

On success the RPC returns `project_id` and `created_at`. It always creates an
active `inquiry` project with `type = undecided`, `amount = NULL`,
`due_date = NULL`, and zero tasks. It inserts project, file metadata, and link
rows in the same PostgreSQL transaction.

`natori_confirm_project_type_v1` accepts only `icon`, `sd`, `standing`, or
`illustration`. It locks the active owner-scoped project row with
`SELECT ... FOR UPDATE`. It returns one of `confirmed`, `already_confirmed`,
`not_found`, `conflict`, or `invalid_type` and never silently rebuilds tasks.
The same-type retry is `already_confirmed` only while the project is still
prework and the persisted task identity exactly matches the six-row template.

RequestData is parsed through the shared Zod schema before the RPC and validated
again from PostgreSQL `jsonb`. The database's existing 64 KiB envelope measures
canonical `jsonb::text`, while the application guard measures compact
`JSON.stringify` output. A payload at that boundary can therefore pass the app
guard and still be rejected safely by the database; both representations belong
in the isolated boundary test, and the database limit is authoritative.

Both `consultation` and `quote` intake accept `requestType = undecided` and
`commissionScope = undecided`. In P1-05, `quote` means that the requester wants
a quote; it is not an issued formal quote and must not import the P1-09 issuance
preconditions. Invalid enum values, `other`-detail consistency, budget, and
deadline validation remain unchanged. Regardless of inquiry mode or those two
request fields, create-v2 persists `type = undecided`, `amount = NULL`,
`due_date = NULL`, and zero tasks.

## URL normalization contract

The server uses the WHATWG `URL` parser and computes `normalized_url`; callers
do not supply a trusted normalized value. The frozen rules are:

- HTTPS only;
- lowercase scheme and hostname;
- remove port 443 and the fragment;
- retain a nondefault port;
- retain path case, path trailing slash, query values, and query order;
- `/a` and `/a/` remain different;
- host-only and explicit root slash both serialize to `/` and are duplicates;
- do not follow redirects, fetch metadata, or download the URL.

The RPC rechecks array/object shape, lengths, HTTPS prefix, canonical authority,
absence of a fragment/default port, nonnegative sort order, and duplicate
normalized URLs. URL parsing and normalization itself remains the server
adapter's responsibility, as allowed by the target design.

## Owner and Storage boundary

The RPC rejects a null owner and an owner absent from `auth.users`. All created
rows inherit that one project owner. Every reference path must:

- belong to the explicit project/submission UUID prefix;
- use the current `{uuid}.webp` upload form;
- exist in private bucket `natori-inquiry-refs`;
- be unique in the submission;
- not already be linked to another project. A row linked to the same project ID
  is accepted only by the exact-envelope idempotent replay check.

Storage upload happens before the database transaction. After a definite RPC
rejection, the application reads the file ledger and best-effort deletes only
submitted paths confirmed to be unlinked; read failure retains every object.
Successful DB creation never triggers cleanup. A response-loss or malformed
success is retried once with the same project UUID and exact envelope. The RPC
accepts that retry only when the committed project, files, and links still match
exactly. If the retry remains ambiguous, the application retains the objects for
orphan reconciliation instead of deleting bytes that a committed row may use.

The existing owner resolver is session-first, followed by
`NATORI_OWNER_USER_ID`, followed by a single discovered owner. This matches the
current application contract requested for P1-05, but it is unsafe to enable for
a public route while an unrelated logged-in requester can supply the session.
P1-06 must resolve that public-intake boundary before enabling the new writer.
The production value and behavior of `NATORI_OWNER_USER_ID` were not inspected;
Vercel confirmation remains a release blocker.

The current admin edit form still sends its legacy generic details payload. The
server now delegates only `undecided -> concrete` to
`natori_confirm_project_type_v1`, treats the unchanged concrete type as a no-op,
and rejects concrete-to-concrete rewrites; it never writes `type` through the
generic update. P1-07 must still add dedicated confirmation/conflict UX. P1-09
remains responsible for the database-level concrete-type guard in
`natori_issue_quote_v2`. Until those gates are complete, this migration is an
inactive additive API and must not be treated as permission to enable the public
writer.

For compatibility, a legacy mixed details payload is handled in two steps: the
type-and-task RPC commits first, then non-type detail fields are updated. The
generic UPDATE never includes `type`, but the two steps are not one transaction;
if the second step fails, type/tasks remain confirmed and the UI receives an
error for the remaining fields. P1-07 should present these as separate actions.

No periodic Storage orphan job was added in P1-05. An unresolved ambiguous RPC
outcome therefore requires operator reconciliation by project UUID; adding and
verifying scheduled orphan handling remains a release prerequisite for P1-06.

## Isolated integration matrix

Prepare a new non-production Supabase branch/project, apply all six active
migrations in order, create a dedicated fixture Auth owner, and upload only tiny
non-sensitive fixture WebP objects. Record row counts before each case and run
each failure case with a new project UUID.

Create-v2 success cases:

1. Consultation: confirm `inquiry`, `undecided`, null amount/due, consultation
   next action, zero tasks, exact RequestData V1, and expected files/links.
2. Quote with `requestType = undecided` and `commissionScope = undecided`:
   confirm the same initial administrative state (`type = undecided`, null
   amount/due, and zero tasks) with the quote next action. This is quote intake,
   not formal quote issuance; P1-09 owns issuance preconditions.
3. Confirm the returned project ID equals the submitted UUID and exactly one
   project exists for it.

Create-v2 rollback cases:

1. Invalid or empty RequestData.
2. Six links; duplicate normalized links; an HTTP URL.
3. Six files; duplicate path; wrong UUID prefix; missing Storage object.
4. A path already linked to another project, or a non-exact reuse of an existing
   project/submission UUID.
5. Null or nonexistent Auth owner.

For a fresh attempted UUID, confirm every failure leaves zero project, file, and
link rows. For an existing-UUID collision, confirm all pre-existing rows remain
byte-for-byte/logically unchanged. Object cleanup is checked separately through
the application test path.

Type-confirm cases:

1. Confirm each concrete type from a clean undecided/prework project and compare
   all six task rows with the template SELECT.
2. Retry the same type and expect `already_confirmed` with no row changes.
3. Race two same-type calls and confirm one template only.
4. Race different types and confirm one winner plus one `conflict`.
5. Expect `conflict` for a different concrete type, partial/unexpected existing
   tasks (including an unexpected `done` state), a production/payment-confirmed
   project, or `closed`.
6. Expect `not_found` for archived, absent, and owner-mismatched projects.
7. Expect `invalid_type` for `undecided`, `other`, or unknown input.

## Catalog and release gates

Run `supabase/verification/etorie-p1-05-intake-rpcs-selects.sql` read-only and
attach the output. Require:

- exact function identities and result types;
- `SECURITY DEFINER` plus an exact empty `search_path`;
- effective EXECUTE for the function owner and `service_role` only;
- owner-only internal helpers;
- 24 expected template rows and six unique keys per type;
- unchanged old create-RPC body hash/ACL;
- six expected active migration-history entries.

The generated database types intentionally remain unchanged. P1-05 contains one
narrow `unknown`-based runtime-parsed adapter; remove it after P1-11 regenerates
the canonical types. Do not enable the public v2 writer, run `db push`, or repair
history until the owner boundary and every isolated integration case above have
been reviewed.

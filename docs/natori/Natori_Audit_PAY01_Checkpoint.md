# PAY-01 implementation checkpoint

Base: `main` / `9abcd1310aba049d512221c2786119af06b12e35`.
Branch: `codex/audit-pay01-delivery-completion`.
This is an independent Draft change; it does not include or merge #162/#163.
The Draft PR description identifies the latest remote HEAD, CI runs, native
artifact and independent-review conclusion. No production change is implied.

## Behavior

- Generic admin status PATCH, advance and Undo reject entry, exit and same-status
  writes at `delivered`/`completed`; they never create `completed_at`.
- New project creation cannot fabricate an unissued `delivered` project. The
  historical results form retains completed registration with original paid and
  completed dates, without customer receipt/token/mail facts.
- Delivery mail uses the existing dedicated issue service. Disabled integrity
  returns `not-configured` before reads, credential rotation or provider sending;
  the obsolete direct token reset/delivery update path is removed.
- The new database guard rejects initial completion without matching persisted
  release acceptance, formal fact fabrication on INSERT, and terminal rewinds.
  Ordinary metadata/payment projections retain historical facts and dates;
  existing terminal task locking remains intact.
- Direct release INSERT/UPDATE are denied to the service. Only the existing
  validated issue and accept RPCs use the trusted owner, empty search path and
  service-only EXECUTE. Their predecessor source, language, owner, invoker mode
  and runtime settings are pinned before elevation. Effective table/column ACL
  drift stops the transaction. No existing customer row is modified by migration.

## Local evidence

6.1 Sol / xhigh implemented and tested the app and forward SQL; Astra / xhigh
independently reviews the critical DB and delivery boundary. Final committed-tree
and native-evidence review are reported separately in the Draft PR.

- Red → green: the original source failed 10 new boundary assertions (35 passed).
  The same focused set passed all 45 after repair.
- Broader focused app checks: 13 files / 189 passed. Historical creation/UI and
  strict caller-failure checks also passed in their scoped follow-up runs.
- Final full unit suite: **238 files / 2,284 tests passed** with `maxWorkers=1`.
  An earlier full run found the new migration missing from the inventory;
  the inventory was updated and the unchanged assertions then passed.
- Typecheck passed after handling the new create-result union and correcting a
  synthetic fixture type. Lint passed with pre-existing AnnouncementCard img/alt
  warnings. Passing jsdom tests also emit existing navigation diagnostics.
- Baseline static check: **32 active / 55 archived, 0 failures**. Frozen baseline
  pair: `d395d0735ab8e25826a2654f9d38f4c3e7688f08f47405e861ba6bd2956d980a`.
  The manifest adds only this forward migration; frozen/archived SQL is unchanged.
- `git diff --check` passed.

## Required native gate and reproducibility

`Natori PAY-01` runs `scripts/natori-pay01/run.sh` with digest-pinned official
PostgreSQL 17.11, no network, no published ports and a private Unix socket.
`acceptance.py` executes nine exact named prerequisite migrations and the new
forward SQL. Auth/Storage platform schemas are synthetic stand-ins; business
tables, guards, task/refund functions and delivery RPC bodies use checked-in SQL.
The gate reproduces the old completion/Undo poisoning and executes the repaired
issue/acceptance path, rejection, real locks/races, retries, rollback, role/column
ACL drift and historical compatibility. Only names/counts and source provenance
are retained. See [native procedure](../../scripts/natori-pay01/README.md).

No local native PostgreSQL pass is claimed: this workspace could not start the
engine as an unprivileged user. The dedicated CI is the real execution gate.
Its product job and normal repository CI independently check full units/types.
The required native result and artifact hashes are in the Draft PR description.

## Application and limits

See [deployment procedure](Natori_Audit_PAY01_Deployment_Runbook.md): reviewed
secure code first, only the named migration second, synthetic acceptance before
releasing the hold. Feature flags and exact predecessor definitions are gates.
All active migrations must not be replayed because migration 7 has an unrelated
pre-existing duplicate CHECK. Existing-row investigation/repair and live provider
checks are separate approved operations. Production merge, DB/permission changes,
deployment and customer data repair have not been performed by this change.

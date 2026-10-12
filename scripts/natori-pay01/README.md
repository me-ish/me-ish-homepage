# PAY-01 native PostgreSQL acceptance

`bash scripts/natori-pay01/run.sh` runs only on a dedicated GitHub-hosted Linux
runner. It accepts no database URL or production configuration. PostgreSQL 17.11
uses an official digest-pinned Linux amd64 image, no network, no published ports,
no host data mounts, a temporary data filesystem, and a private Unix socket.
Cleanup verifies the exact per-run container label before removing that resource.

The suite executes the **exact raw SQL** from the nine named prerequisite
migrations in `acceptance.py`, followed by
`20261012064005_natori_pay01_completion_evidence.sql`. Auth and Storage stand-ins
contain only platform schemas needed by those exact migrations. All business
tables, triggers and RPC bodies come from checked-in migration files. The suite
does not replay the active migration directory; the unrelated known baseline
CHECK duplication is not changed or suppressed.

The pre-fix portion reproduces generic completion followed by Undo, then observes
the real acceptance RPC reject the poisoned `completed_at`. The fixed portion
tests dedicated publication and acceptance, two real concurrent acceptance
sessions waiting on the project row, matching acceptance/completion dates,
retries, forged fields/GUCs, terminal Undo, no-release/unpaid/expired cases,
notification failure rollback, immutable evidence, manual historical registration,
legacy accepted release adoption, production tasks and refund reconciliation.
Browser RPC grants remain denied. A separate synthetic-fixture DML grant exercises
the existing owner RLS policies and proves the project guard still rejects forged
formal evidence while ordinary owner metadata updates remain possible.

The migration fingerprints the reviewed predecessor RPC bodies, owner, language,
invoker status and runtime settings before elevating the two dedicated RPCs. Drift,
disabled prerequisite guards or remaining effective release DML grants abort the
whole transaction. Native checks test source/runtime/trigger/column-ACL drift
before the successful migration. No existing customer row or timestamp is repaired.

Artifacts contain only check names/counts, engine/version, source hashes, pinned
image reference and commit SHA. They contain no tokens, sessions, row snapshots,
mail/provider payloads, logs or customer data. The fixture uses synthetic UUIDs,
hashes and `.invalid` addresses only. This gate verifies database behavior and the
product unit/type regressions; it does not claim production deployment or browser
HTTP/Storage end-to-end acceptance.

Deployment requires the existing delivery-integrity feature enabled. Code must
reject generic formal status edits and stop the disabled-integrity mail path
before any token update or external send. Apply only the named forward migration
after reviewing its exact hashes and native results, in the held deployment window
described by `docs/natori/Natori_Audit_PAY01_Deployment_Runbook.md`.

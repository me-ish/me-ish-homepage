# PAY-01 recovery proposal — not approved for execution

Root is the only production operator. These files do not authorize another send
of the uncertain original request. Application flags, temporary hold and blocked
legacy hosts stay unchanged. No automatic retry is permitted for an uncertain
fence or recovery request.

| Payload | Purpose | Changes |
| --- | --- | --- |
| `fence.sql` | Additional tracked `natori_pay01_recovery_fence` migration | Strict catalog/history checks, then only the original two `ALTER FUNCTION … SECURITY DEFINER` statements and commit. No role, owner or schema changes. |
| `observe.sql` | Fresh read-only observation after confirmed fence commit | Metadata/hash/privilege checks and transaction counts; never emits SQL text, session identity or business rows. |
| `recovery.sql` | Tracked `natori_pay01_completion_evidence` migration under a new payload attestation | Original PAY SQL with exactly two `and not f.prosecdef` changed to `and f.prosecdef`, plus the project trigger's `DROP`/`CREATE` changed to `CREATE OR REPLACE TRIGGER`. |

Original raw PAY SQL is 8,489 bytes, SHA-256
`2e32bbd971beaa51deec9dcc3dab639ac2aeed9cf42eb673086f8776eb8301c1`.
Recovery SQL is 8,422 bytes, SHA-256
`bcf20b05509084e4fa0027787773b93fb3527994742b1de41fe4724d4ac9e3c3`.
The recovery payload is different. It must never be described as the original
approved bytes. The original repository migration and fixed 154-check postflight
remain unchanged.

`CREATE OR REPLACE TRIGGER` avoids the separate drop, preserves the existing
trigger OID, and recalculates the trigger contract to row-level BEFORE
INSERT/UPDATE (`tgtype=23`, enabled `O`). Its transaction, firing and rollback
behavior must pass the native gate before this proposal is considered executable.
The final business guard body and delivery RPC bodies are otherwise unchanged.

Required operator order:

1. Confirm ordinary full-text `BEGIN`/`COMMIT` execution, the primary, complete
   `pg_read_all_stats` visibility, disabled prepared transactions, the exact source
   hashes/runtime/ACLs, and PAY absence. An already completed PAY is verified and
   skipped, never recovered.
2. Send the separately approved fence once; retain its tool receipt and additional
   history record. Uncertainty stops the procedure.
3. From a new READ COMMITTED snapshot run `observe.sql`. Its read-only DO gate
   checks all activity counts in one aggregate first and raises on any open,
   unknown or disabled activity. A separate later SELECT takes a new statement
   snapshot for catalog/history. It never combines old catalog visibility with
   activity sampled after a concurrent commit. Require `decision=ready`,
   PAY history 0, fence history 1, every readiness/primary/freshness/visibility flag
   true, and other open/unknown/prepared transaction counts all 0. Any null is
   failure. This explicitly blocks a transaction which passed the old original
   DO before the fence, including an old Repeatable Read snapshot.
4. Maintain the held application window. Root sends the newly approved recovery
   payload once, under the original migration name; no history repair or active
   migration replay is permitted.
5. Confirm receipt/history, run the unchanged fixed production postflight, and
   attest the new fence/recovery payload hashes separately. If the original PAY
   completed meanwhile, verify its receipt/final evidence and skip recovery.

The observation is an operator gate, not a substitute for a database lock or a
guarantee about arbitrary future transactions. This proposal relies on ordinary
transaction semantics and the held window; it does not infer a special provider
execution model. No production call was made while preparing these files.

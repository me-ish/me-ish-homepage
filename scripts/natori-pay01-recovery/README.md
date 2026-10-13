# Recovery native proof

Proposal preparation only; no production Supabase or Vercel operation is performed.
The dedicated branch push workflow runs ordinary native PostgreSQL 17.11 SQL in
the same digest-pinned, network-disabled, Unix-socket-only form as the existing
combined helper. Only this run's labeled disposable container is cleaned up.

The unchanged combined helper supplies 18 explicitly named prerequisites and four
exact raw forward SHA pins. Each synthetic recovery case applies the first three
forward files unchanged. The original PAY file remains unchanged and is used to
exercise delayed original transactions. No active migration directory is replayed.

The focused cases prove:

1. An original transaction held immediately after its DO is detected; recovery is
   refused until it aborts, then the new payload succeeds.
2. An old original finishing after its DO and after the fence is recognized and
   skipped, with no recovery send or duplicate history.
3. A late original starting its DO after the fence fails, with no catalog/history
   changes.
4. A held Repeatable Read snapshot blocks recovery until drained.
5. A staged fence failure after its first ALTER and ACL drift roll back; recovery
   ACL failure restores the previous trigger/body/history. Successful replacement
   preserves the trigger OID, sets `tgtype=23`/enabled `O`, and fires on real INSERT
   and UPDATE attempts.
6. The first observer DO statement is running and visibly waiting on a test-only
   advisory barrier before its activity aggregate. Old PAY then commits and the
   barrier releases. Activity is sampled afterwards; the separate fresh catalog
   SELECT sees the completed guard/history and skips, never reports ready. The
   in-memory copy has exactly one instrumented line and removing it reproduces
   the unchanged observer payload; the file hash is rechecked after execution.
7. Disabled old activity and a role without complete stats visibility are refused.

The final scenario reuses the existing combined helper's 54 assertion conditions,
including business evidence, RPC/body/runtime/ACL/trigger checks. Its last forward
application is routed to the new fence/recovery payload. The original
`exact_raw_forward_pay01` descriptor is explicitly renamed so the evidence does
not claim unchanged PAY bytes. The unchanged other 53 descriptors and all 54
conditions are retained. History has the three original forward names plus one
fence and one recovered PAY.

The migration-history table is a synthetic fixture. Its name/count record is
appended after ordinary SQL COMMIT; the suite does not establish a special
provider callback behavior. Production acceptance still requires root's actual
tool receipts, primary/configuration/visibility checks, new payload approval and
the unchanged fixed 154-check postflight.

Artifacts contain source hashes, pinned image/commit/tree, check names/counts and
pass/fail classification. They exclude session IDs, query text, raw logs, business
rows and credentials. A source-only syntax pass is not reported as native success.

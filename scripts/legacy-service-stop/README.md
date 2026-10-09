# Legacy service stop authorization gate

Run `bash scripts/legacy-service-stop/run.sh` in the dedicated GitHub-hosted
workflow. The script accepts no external database connection. It creates a
PostgreSQL 17 container with no network, no published ports and a private Unix
socket, then destroys only its labelled container. Fixture data lives in tmpfs.
The exact pulled image digest is recorded in the synthetic evidence artifact.

The gate executes the actual reviewed `supabase/operations/legacy-service-stop/`
SQL. It checks baseline behavior, denied client INSERT / UPDATE / UPSERT and
RPC calls, preserved reads / DELETE / service-role writes, unchanged Natori and
financial writes, acknowledgement guards, atomic rejection of ACL/policy drift,
an allowlisted stopped-state catalog delta (10 policies and 5 RPC ACLs only),
and an exact canonical catalog comparison after rollback. UPDATE denial is
checked as zero affected rows, not assumed to throw an error.

The fixture is intentionally synthetic. Its permissive client policies prove
that the new restrictive policies override existing allows; it is not a dump of
production policies. It models the reviewed RPC signatures and ACLs with small
writing stand-ins. This gate does **not** establish production policy completeness,
Storage HTTP/signed-upload behavior, existing image availability, application
flows or Stripe behavior. Those remain separate cutover checks. In particular,
issued signed upload tokens are not exercised here.

Historical Phase T / 0A fixtures and workflows are untouched. No production data,
credentials or raw production catalog are committed or included in the artifact.

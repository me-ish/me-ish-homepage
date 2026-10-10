# Isolated empty-schema retirement gate

Run `bash scripts/retire-empty-legacy-schema/run.sh` only on its dedicated
GitHub-hosted Linux workflow. It rejects external DB/provider configuration and
uses a networkless PostgreSQL 17.6 container with synthetic records.

See `supabase/operations/retire-empty-legacy-schema/README.md` for the concrete
scope, acknowledgement and production sequence. The fixture has target DDL
from a read-only catalog; it contains no real user data or credentials.

`verify-delta.py BEFORE AFTER schema|storage` compares canonical catalog JSON
from `scripts/legacy-service-stop/catalog.sql`. The only allowed differences
are the exact reviewed target definitions and their owned indexes/policies.

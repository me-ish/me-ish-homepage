#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# No database URL, network endpoint, secrets or production client is accepted.
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || {
  echo 'Dedicated GitHub-hosted Linux runner required'; exit 1;
}
[[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]] || exit 1
for key in DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE \
  SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN \
  STRIPE_SECRET_KEY RESEND_API_KEY; do
  [[ -z ${!key:-} ]] || { echo "Unexpected inherited configuration: $key"; exit 1; }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$root" rev-parse --show-toplevel)
operations="$repo/supabase/operations/retire-empty-legacy-schema"
work=$(mktemp -d "${RUNNER_TEMP:?}/retire-empty-legacy-schema.XXXXXXXX")
results="$work/results"
mkdir "$results"
printf 'LEGACY_SCHEMA_RESULTS=%s\n' "$results" >> "${GITHUB_ENV:?}"
container="retire-empty-legacy-schema-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
image='postgres:17.6-bookworm'
started=0

cleanup() {
  local status=$?
  trap - EXIT
  if (( started )); then
    if [[ $(docker inspect -f '{{index .Config.Labels "meish.retire-empty-legacy-schema"}}' "$container" 2>/dev/null) == "$container" ]]; then
      docker rm -f "$container" >/dev/null || status=1
    else
      echo 'Dedicated container ownership check failed'; status=1
    fi
  fi
  printf 'Dedicated PostgreSQL cleanup: exit=%s\n' "$status"
  exit "$status"
}
trap cleanup EXIT

docker pull "$image" >/dev/null
docker image inspect --format '{{json .RepoDigests}}' "$image" > "$results/postgres-image.json"
# Trust authentication is confined to this container's private Unix socket.
# No network, host ports, host volume or production settings are mounted.
docker run --detach --name "$container" --network none --memory 512m --cpus 2 \
  --label "meish.retire-empty-legacy-schema=$container" \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m \
  --env POSTGRES_HOST_AUTH_METHOD=trust "$image" \
  postgres -c listen_addresses='' -c max_connections=20 >/dev/null
started=1
ready=0
for attempt in {1..30}; do
  if docker exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -h /var/run/postgresql -U postgres -d postgres' >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
[[ $ready == 1 ]] || { echo 'Disposable PostgreSQL did not become ready'; exit 1; }

dbsql() {
  docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 \
    -h /var/run/postgresql -U postgres -d postgres "$@"
}

operation() {
  local mode=$1
  if [[ $mode == schema ]]; then
    { printf "SET meish.legacy_schema_cleanup = 'reviewed-20261010';\n"; cat "$operations/20261010120011_retire_empty_legacy_schema.sql"; } | dbsql
  else
    { printf "SET meish.legacy_storage_cleanup = 'reviewed-20261010';\n"; cat "$operations/remove-storage-policies.sql"; } | dbsql
  fi
}
catalog() { dbsql -At < "$repo/scripts/legacy-service-stop/catalog.sql" > "$1"; }
data() { dbsql -At < "$root/protected-data.sql" > "$1"; }
same() { cmp -s "$1" "$2" || { echo "Mismatch: $3"; exit 1; }; }
reject() {
  local mode=$1 expected=$2
  catalog "$work/reject-before.json"
  data "$work/data-before.json"
  if operation "$mode" > "$work/rejection.log" 2>&1; then
    echo "Expected rejection: $expected"; exit 1
  fi
  grep -Fq "$expected" "$work/rejection.log" || { cat "$work/rejection.log"; exit 1; }
  catalog "$work/reject-after.json"
  data "$work/data-after.json"
  same "$work/reject-before.json" "$work/reject-after.json" "$expected catalog rollback"
  same "$work/data-before.json" "$work/data-after.json" "$expected data rollback"
  echo "PASS rejection and atomic rollback: $expected" | tee -a "$results/checks.txt"
}
[[ $(dbsql -Atc 'SHOW server_version_num') == 1700* ]] || exit 1
[[ $(dbsql -Atc 'SHOW listen_addresses') == '' ]] || exit 1
dbsql < "$root/fixture.sql" >/dev/null
catalog "$results/catalog-before.json"
data "$results/data-before.json"

for mode in schema storage; do
  file='20261010120011_retire_empty_legacy_schema.sql'
  [[ $mode == schema ]] || file='remove-storage-policies.sql'
  if dbsql < "$operations/$file" > "$work/rejection.log" 2>&1; then
    echo 'Missing acknowledgement unexpectedly accepted'; exit 1
  fi
  grep -Fq 'REVIEWED_SESSION_REQUIRED' "$work/rejection.log"
  catalog "$work/guard.json"
  same "$results/catalog-before.json" "$work/guard.json" 'missing acknowledgement'
  echo "PASS explicit acknowledgement required: $mode" | tee -a "$results/checks.txt"
done

# A populated target must never be dropped, regardless of prior deletion approval.
dbsql -c 'INSERT INTO public.aura_requests DEFAULT VALUES;'
reject schema LEGACY_SCHEMA_TABLE_NOT_EMPTY
dbsql -c 'DELETE FROM public.aura_requests;'

# Late DROP failures must roll back earlier function/view drops too.
dbsql -c 'CREATE VIEW public.synthetic_dependency AS SELECT * FROM public.entry_comments;'
reject schema 'because other objects depend on it'
dbsql -c 'DROP VIEW public.synthetic_dependency;'
dbsql -c 'ALTER TABLE public.natori_projects ADD COLUMN synthetic_ref uuid REFERENCES public.aura_requests(id);'
reject schema 'because other objects depend on it'
dbsql -c 'ALTER TABLE public.natori_projects DROP COLUMN synthetic_ref;'

# PostgreSQL does not track references inside PL/pgSQL bodies: explicit guard.
dbsql <<'SQL'
CREATE FUNCTION public.synthetic_dependency() RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN RETURN (SELECT count(*) FROM public.entry_comments); END $$;
SQL
reject schema LEGACY_SCHEMA_UNEXPECTED_FUNCTION_DEPENDENCY
dbsql -c 'DROP FUNCTION public.synthetic_dependency();'

dbsql -c 'ALTER TABLE public.card_requests ADD COLUMN synthetic_drift boolean;'
reject schema LEGACY_SCHEMA_TABLE_DRIFT
dbsql -c 'ALTER TABLE public.card_requests DROP COLUMN synthetic_drift;'
dbsql -c 'ALTER FUNCTION public.increment_entry_likes(bigint) SET search_path TO public, pg_temp;'
reject schema LEGACY_SCHEMA_FUNCTION_DRIFT
dbsql -c 'ALTER FUNCTION public.increment_entry_likes(bigint) SET search_path TO public;'
dbsql -c 'ALTER VIEW public.entry_comment_counts RENAME COLUMN comment_count TO changed_count;'
reject schema LEGACY_SCHEMA_VIEW_DRIFT
dbsql -c 'ALTER VIEW public.entry_comment_counts RENAME COLUMN changed_count TO comment_count;'

catalog "$work/before-apply.json"
operation schema > "$results/schema-apply.txt"
catalog "$results/catalog-after-schema.json"
python3 "$root/verify-delta.py" "$work/before-apply.json" "$results/catalog-after-schema.json" schema | tee -a "$results/checks.txt"
data "$work/data-after-schema.json"
same "$results/data-before.json" "$work/data-after-schema.json" 'schema application preserves all protected records'
reject schema LEGACY_SCHEMA_TABLE_MISSING_OR_CHANGED
reject storage LEGACY_STORAGE_BUCKETS_MUST_ALREADY_BE_ABSENT

# Synthetic metadata only, in this networkless disposable PostgreSQL instance.
# Production bucket deletion MUST use Storage API, never this fixture command.
dbsql -c "DELETE FROM storage.buckets WHERE id NOT LIKE 'natori-%';"
dbsql -c 'ALTER POLICY "upload own avatar" ON storage.objects WITH CHECK (true);'
reject storage LEGACY_STORAGE_POLICY_DRIFT
dbsql -c "ALTER POLICY \"upload own avatar\" ON storage.objects WITH CHECK ((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text));"
catalog "$work/before-storage.json"
operation storage > "$results/storage-apply.txt"
catalog "$results/catalog-after-storage.json"
python3 "$root/verify-delta.py" "$work/before-storage.json" "$results/catalog-after-storage.json" storage | tee -a "$results/checks.txt"
data "$results/data-after.json"
same "$results/data-before.json" "$results/data-after.json" 'Natori, Stripe, Auth and historical records and objects'
reject storage LEGACY_STORAGE_POLICY_DRIFT

echo 'PASS both operations; protected data unchanged; no production connection' | tee -a "$results/checks.txt"

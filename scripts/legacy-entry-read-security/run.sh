#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || {
  echo 'Dedicated GitHub-hosted Linux runner required'; exit 1;
}
[[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]] || exit 1
for key in DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE \
  SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN \
  STRIPE_SECRET_KEY RESEND_API_KEY; do
  [[ ! -v $key ]] || { echo "Unexpected inherited configuration: $key"; exit 1; }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$root" rev-parse --show-toplevel)
migration="$repo/supabase/migrations/20261011221028_lockdown_legacy_entries_reads.sql"
work=$(mktemp -d "${RUNNER_TEMP:?}/legacy-entry-read.XXXXXXXX")
results="$work/results"
mkdir "$results"
printf 'ENTRY_READ_RESULTS=%s\n' "$results" >> "${GITHUB_ENV:?}"
container="entry-read-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
image='postgres:17.6-bookworm'
started=0
cleanup() {
  local status=$?
  trap - EXIT
  if (( started )); then
    if [[ $(docker inspect -f '{{index .Config.Labels "meish.entry-read-test"}}' "$container" 2>/dev/null) == "$container" ]]; then
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
docker run --detach --name "$container" --network none --memory 512m --cpus 2 \
  --label "meish.entry-read-test=$container" \
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
dbsql() { docker exec -i "$container" psql -X -q -v ON_ERROR_STOP=1 -h /var/run/postgresql -U postgres -d postgres "$@"; }
catalog() { dbsql -At < "$root/catalog.sql" > "$1"; }
same() { cmp -s "$1" "$2" || { echo "Catalog changed after rejection: $3"; exit 1; }; }
reject() {
  local expected=$1
  if dbsql < "$migration" > "$work/rejection.log" 2>&1; then
    echo "Expected rejection: $expected"; exit 1
  fi
  grep -Fq "$expected" "$work/rejection.log" || { cat "$work/rejection.log"; exit 1; }
}
[[ $(dbsql -Atc 'SHOW server_version_num') == 1700* ]] || { echo 'PostgreSQL 17 required'; exit 1; }
[[ $(dbsql -Atc 'SHOW listen_addresses') == '' ]] || { echo 'TCP must be disabled'; exit 1; }
dbsql < "$root/fixture.sql" >/dev/null
dbsql < "$root/before.sql" 2>&1 | tee -a "$results/checks.txt"

dbsql -c 'ALTER TABLE public.entries DISABLE ROW LEVEL SECURITY;'
catalog "$work/rls-before.json"
reject ENTRY_READ_LOCKDOWN_RLS_REQUIRED
catalog "$work/rls-after.json"
same "$work/rls-before.json" "$work/rls-after.json" 'RLS guard'
dbsql -c 'ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;'

dbsql -c 'GRANT SELECT ON public.v_server_entries TO anon;'
catalog "$work/view-before.json"
reject ENTRY_READ_LOCKDOWN_UNSAFE_DEPENDENT_VIEW
catalog "$work/view-after.json"
same "$work/view-before.json" "$work/view-after.json" 'definer-view guard'
dbsql -c 'REVOKE SELECT ON public.v_server_entries FROM anon;'

dbsql -c 'CREATE ROLE fixture_reader NOLOGIN; GRANT SELECT ON public.entries TO fixture_reader; GRANT fixture_reader TO anon;'
catalog "$work/inherited-before.json"
reject ENTRY_READ_LOCKDOWN_ANON_PRIVILEGE_REMAINS
catalog "$work/inherited-after.json"
same "$work/inherited-before.json" "$work/inherited-after.json" 'atomic postcondition rollback'
dbsql -c 'REVOKE fixture_reader FROM anon;'

catalog "$results/catalog-before.json"
dbsql < "$migration" >/dev/null
dbsql < "$root/checks.sql" 2>&1 | tee -a "$results/checks.txt"
catalog "$results/catalog-after.json"
reject ENTRY_READ_LOCKDOWN_POLICY_ALREADY_EXISTS
catalog "$work/repeat-after.json"
same "$results/catalog-after.json" "$work/repeat-after.json" 'repeat apply'
sha256sum "$migration" > "$results/migration-sha256.txt"
echo 'PASS RLS, unsafe-view, inherited-grant and repeat guards; atomic rejection' | tee -a "$results/checks.txt"
echo 'PASS isolated PostgreSQL authorization; no production connection'

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
operations="$repo/supabase/operations/legacy-service-stop"
work=$(mktemp -d "${RUNNER_TEMP:?}/legacy-service-stop.XXXXXXXX")
results="$work/results"
mkdir "$results"
printf 'LEGACY_STOP_RESULTS=%s\n' "$results" >> "${GITHUB_ENV:?}"
container="legacy-service-stop-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
image='postgres:17.6-bookworm'
started=0

cleanup() {
  local status=$?
  trap - EXIT
  if (( started )); then
    if [[ $(docker inspect -f '{{index .Config.Labels "meish.legacy-service-stop"}}' "$container" 2>/dev/null) == "$container" ]]; then
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
  --label "meish.legacy-service-stop=$container" \
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
  { printf "SET meish.legacy_stop = '%s-20261009';\n" "$mode"; cat "$operations/$mode.sql"; } | dbsql
}
catalog() { dbsql -At < "$root/catalog.sql" > "$1"; }
same() { cmp -s "$1" "$2" || { echo "Catalog mismatch: $3"; exit 1; }; }
reject() {
  local mode=$1 expected=$2
  if operation "$mode" > "$work/rejection.log" 2>&1; then
    echo "Expected $mode rejection: $expected"; exit 1
  fi
  grep -Fq "$expected" "$work/rejection.log" || { cat "$work/rejection.log"; exit 1; }
}
behavior() {
  local state=$1 role
  for role in anon authenticated service_role; do
    dbsql -v "stop_state=$state" -v "test_role=$role" < "$root/checks.sql" >/dev/null
    printf 'PASS behavior state=%s role=%s\n' "$state" "$role" | tee -a "$results/checks.txt"
  done
}

[[ $(dbsql -Atc 'SHOW server_version_num') == 1700* ]] || { echo 'PostgreSQL 17 required'; exit 1; }
[[ $(dbsql -Atc 'SHOW listen_addresses') == '' ]] || { echo 'TCP must be disabled'; exit 1; }
dbsql < "$root/fixture.sql" >/dev/null
catalog "$results/catalog-before.json"
behavior baseline

if dbsql < "$operations/apply.sql" > "$work/rejection.log" 2>&1; then
  echo 'Missing approval guard unexpectedly accepted'; exit 1
fi
grep -Fq 'LEGACY_STOP_REVIEWED_APPLY_SESSION_REQUIRED' "$work/rejection.log"
catalog "$work/catalog-guard.json"
same "$results/catalog-before.json" "$work/catalog-guard.json" 'missing apply acknowledgement'

dbsql -c 'REVOKE EXECUTE ON FUNCTION public.aura_claim_first20_free(text,uuid) FROM anon;'
catalog "$work/catalog-drift.json"
reject apply LEGACY_STOP_RPC_ACL_DRIFT
catalog "$work/catalog-rejected.json"
same "$work/catalog-drift.json" "$work/catalog-rejected.json" 'apply ACL drift must be atomic'
dbsql -c 'GRANT EXECUTE ON FUNCTION public.aura_claim_first20_free(text,uuid) TO anon;'
catalog "$work/catalog-restored.json"
same "$results/catalog-before.json" "$work/catalog-restored.json" 'fixture ACL reset'

operation apply >/dev/null
catalog "$results/catalog-stopped.json"
python3 "$root/verify-delta.py" "$results/catalog-before.json" "$results/catalog-stopped.json" | tee -a "$results/checks.txt"
behavior stopped
reject apply LEGACY_STOP_POLICY_ALREADY_EXISTS
catalog "$work/catalog-reapply.json"
same "$results/catalog-stopped.json" "$work/catalog-reapply.json" 'repeat apply must not mutate'

if dbsql < "$operations/rollback.sql" > "$work/rejection.log" 2>&1; then
  echo 'Missing rollback approval guard unexpectedly accepted'; exit 1
fi
grep -Fq 'LEGACY_STOP_REVIEWED_ROLLBACK_SESSION_REQUIRED' "$work/rejection.log"
catalog "$work/catalog-rollback-guard.json"
same "$results/catalog-stopped.json" "$work/catalog-rollback-guard.json" 'missing rollback acknowledgement'

dbsql -c 'ALTER POLICY legacy_stop_insert ON public.entries WITH CHECK (true);'
catalog "$work/catalog-policy-drift.json"
reject rollback LEGACY_STOP_ROLLBACK_POLICY_DRIFT
catalog "$work/catalog-policy-rejected.json"
same "$work/catalog-policy-drift.json" "$work/catalog-policy-rejected.json" 'rollback drift must be atomic'
dbsql -c 'ALTER POLICY legacy_stop_insert ON public.entries WITH CHECK (false);'
catalog "$work/catalog-stop-restored.json"
same "$results/catalog-stopped.json" "$work/catalog-stop-restored.json" 'fixture policy reset'

operation rollback >/dev/null
catalog "$results/catalog-rollback.json"
same "$results/catalog-before.json" "$results/catalog-rollback.json" 'exact rollback'
behavior baseline
echo 'PASS acknowledgement and drift guards; exact catalog rollback' | tee -a "$results/checks.txt"
echo 'PASS isolated PostgreSQL authorization gate; no production connection'

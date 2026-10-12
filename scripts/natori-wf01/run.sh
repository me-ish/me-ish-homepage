#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || {
  echo 'Dedicated GitHub-hosted Linux runner required'; exit 1;
}
[[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]] || exit 1
for key in DOCKER_HOST DOCKER_CONTEXT DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE \
  SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN \
  STRIPE_SECRET_KEY RESEND_API_KEY; do
  [[ -z ${!key:-} ]] || { echo "Unexpected inherited configuration: $key"; exit 1; }
done
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$root" rev-parse --show-toplevel)
work=$(mktemp -d "${RUNNER_TEMP:?}/natori-wf01.XXXXXXXX")
results="$work/results"
mkdir "$results"
printf 'WF01_RESULTS=%s\n' "$results" >> "${GITHUB_ENV:?}"
container="natori-wf01-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
# Official Linux amd64 PostgreSQL 17.11 manifest; no floating image tag.
image='postgres:17.11-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df'
started=0
cleanup() {
  local status=$?
  trap - EXIT
  if (( started )); then
    if [[ $(docker inspect -f '{{index .Config.Labels "natori.wf01"}}' "$container" 2>/dev/null) == "$container" ]]; then
      docker rm -f "$container" >/dev/null || status=1
    else echo 'Dedicated container ownership check failed'; status=1; fi
  fi
  printf 'Dedicated PostgreSQL cleanup: exit=%s\n' "$status"
  exit "$status"
}
trap cleanup EXIT

docker pull "$image" >/dev/null
docker run --detach --name "$container" --network none --memory 512m --cpus 2 \
  --label "natori.wf01=$container" --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=natori_wf01 "$image" \
  postgres -c listen_addresses='' -c max_connections=20 >/dev/null
started=1
ready=0
for attempt in {1..30}; do
  if docker exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres && pg_isready -h /var/run/postgresql -U postgres -d natori_wf01' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || { echo 'Disposable PostgreSQL did not become ready'; exit 1; }
[[ $(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container") == none ]] || exit 1
[[ $(docker inspect -f '{{len .HostConfig.PortBindings}}' "$container") == 0 ]] || exit 1
[[ $(docker inspect -f '{{.Config.Image}}' "$container") == "$image" ]] || exit 1
printf '%s\n' "$image" > "$results/postgres-image.txt"
git -C "$repo" rev-parse HEAD > "$results/source-commit.txt"
python3 "$root/acceptance.py" --container "$container" --results "$results"

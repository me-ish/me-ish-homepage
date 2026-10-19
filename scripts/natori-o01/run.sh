#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
for key in DATABASE_URL PGHOST PGPORT PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN STRIPE_SECRET_KEY RESEND_API_KEY; do
 [[ -z ${!key:-} ]] || { echo "Unexpected inherited configuration: $key"; exit 1; }
done
repo=$(git rev-parse --show-toplevel)
results=$(mktemp -d "${RUNNER_TEMP:-/tmp}/natori-o01.XXXXXXXX")
[[ -z ${GITHUB_ENV:-} ]] || printf 'O01_RESULTS=%s\n' "$results" >> "$GITHUB_ENV"
container="natori-o01-$(date -u +%Y%m%d%H%M%S)-$$"
image='postgres:17.11-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df'
started=0
cleanup(){
 local status=$?
 trap - EXIT
 if (( started )); then
  if [[ $(docker inspect -f '{{index .Config.Labels "natori.o01"}}' "$container") == "$container" ]]; then docker rm -f "$container" >/dev/null; else status=1; fi
 fi
 printf 'O01 evidence: %s; exit=%s\n' "$results" "$status"
 exit "$status"
}
trap cleanup EXIT
docker pull "$image" >/dev/null
docker run --detach --name "$container" --network none --memory 512m --cpus 2 --label "natori.o01=$container" --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=256m --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=natori_pay01 "$image" postgres -c listen_addresses='' -c max_connections=20 >/dev/null
started=1
for attempt in {1..30}; do if docker exec "$container" pg_isready -h /var/run/postgresql -U postgres -d natori_pay01 >/dev/null 2>&1; then break; fi; sleep 1; done
[[ $(docker inspect -f '{{.HostConfig.NetworkMode}}' "$container") == none ]]
[[ $(docker inspect -f '{{len .HostConfig.PortBindings}}' "$container") == 0 ]]
[[ $(docker inspect -f '{{.Config.Image}}' "$container") == "$image" ]]
printf '%s\n' "$image" > "$results/postgres-image.txt"
python3 "$repo/scripts/natori-o01/verify-db.py" --container "$container" --results "$results"

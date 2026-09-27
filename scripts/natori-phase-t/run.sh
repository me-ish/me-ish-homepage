#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# This entry point intentionally supports only a disposable GitHub-hosted Linux job.
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || { echo 'GitHub-hosted Linux runner required'; exit 1; }
[[ ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]] || exit 1
[[ $(node --version) == v22.* ]] || { echo 'Use the repository .node-version'; exit 1; }
for key in SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN DATABASE_URL STRIPE_SECRET_KEY RESEND_API_KEY; do
  [[ -z ${!key:-} ]] || { echo "Unexpected inherited configuration: $key"; exit 1; }
done

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
work=$(mktemp -d "${RUNNER_TEMP:?}/natori-phase-t.XXXXXXXX")
project="natori-phase-t-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
network="$project"
runner="$project-test"
db="supabase_db_$project"
subnet='172.30.250.0/24'
chain="NT${GITHUB_RUN_ID: -12}${GITHUB_RUN_ATTEMPT}"
mkdir -p "$work/stack/supabase" "$work/runtime" "$work/results" "$work/bin"
printf 'PHASE_T_RESULTS=%s\n' "$work/results" >> "$GITHUB_ENV"
network_created=0
firewall_created=0
stack_started=0

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ $(docker inspect -f '{{index .Config.Labels "natori.phase-t"}}' "$runner" 2>/dev/null) == "$project" ]]; then
    docker rm -f "$runner" >/dev/null
  fi
  if (( stack_started )); then
    # Exact project ID; never --all or prune. No shared stack is touched.
    timeout 90 "$work/bin/supabase" stop --workdir "$work/stack" --project-id "$project" --no-backup >"$work/stop.private" 2>&1
    if (( $? != 0 )); then echo 'Dedicated stack cleanup failed'; status=1; fi
  fi
  if (( network_created )); then docker network rm "$network" >/dev/null || status=1; fi
  if (( firewall_created )); then
    sudo iptables -D DOCKER-USER -j "$chain"
    sudo iptables -F "$chain"
    sudo iptables -X "$chain"
  fi
  # Remove only sensitive files created below our unique mktemp directory.
  WORK="$work" python3 - <<'PY'
import os
from pathlib import Path
w=Path(os.environ['WORK'])
for p in [w/'runtime/credentials.json', w/'status.private', w/'startup.private', w/'stop.private', w/'stack/supabase/config.toml']:
    if p.is_file(): p.unlink()
PY
  printf 'CLEANUP dedicated resources: exit=%s\n' "$status"
  exit "$status"
}
trap cleanup EXIT

echo 'BUILD: download tools/images; production credentials are absent'
curl --fail --silent --show-error --location --connect-timeout 15 --max-time 120 --retry 1 \
  https://github.com/supabase/cli/releases/download/v2.118.0/supabase_2.118.0_linux_amd64.tar.gz -o "$work/cli.tar.gz"
printf 'f6089a86fb9d9221c958193a277338daddd6822f706929943812fa32e106c86d  %s\n' "$work/cli.tar.gz" | sha256sum -c -
tar --no-same-owner -xzf "$work/cli.tar.gz" -C "$work/bin" supabase
[[ $("$work/bin/supabase" --version) == 2.118.0 ]]
export SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
"$work/bin/supabase" start --help >"$work/results/cli-start-help.txt"
"$work/bin/supabase" stop --help >"$work/results/cli-stop-help.txt"

# Same resolved Node version as setup-node(.node-version), no npm/project dependencies.
node_image="node:$(node -p 'process.versions.node')-bookworm-slim"
timeout 180 docker pull "$node_image" >"$work/pull.private" 2>&1
ROOT="$root" WORK="$work" PROJECT="$project" node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
let config = readFileSync(`${process.env.ROOT}/supabase/config.toml`, 'utf8');
config = config.replace('natori-phase-t-placeholder', process.env.PROJECT);
config = config.replace('[auth]', `[auth]\njwt_secret = "${randomBytes(48).toString('hex')}"\npublishable_key = "sb_publishable_${randomBytes(24).toString('base64url')}"\nsecret_key = "sb_secret_${randomBytes(24).toString('base64url')}"`);
writeFileSync(`${process.env.WORK}/stack/supabase/config.toml`, config, { mode: 0o600 });
JS

# Inbound publication guard before any Supabase ports are bound.
sudo iptables -N "$chain"
sudo iptables -A "$chain" -d "$subnet" ! -s "$subnet" -j DROP
sudo iptables -A "$chain" -j RETURN
sudo iptables -I DOCKER-USER 1 -j "$chain"
firewall_created=1
docker network create --internal --subnet "$subnet" --label "natori.phase-t=$project" "$network" >/dev/null
network_created=1
stack_started=1
if ! timeout 540 "$work/bin/supabase" start --workdir "$work/stack" --network-id "$network" \
  --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor >"$work/startup.private" 2>&1; then
  echo 'Supabase startup failed; mandatory tests have NOT passed'
  # Only classifications, never raw CLI logs (which can contain credentials).
  WORK="$work" python3 - <<'PY'
import os,re
from pathlib import Path
text=(Path(os.environ['WORK'])/'startup.private').read_text(errors='replace').lower()
for label in ['invalid config','unknown field','failed to pull','unhealthy','permission denied','connection refused','timeout','failed to start']:
    if label in text: print('startup classification: '+label)
PY
  docker ps -a --filter "label=com.supabase.cli.project=$project" --format '{{.Names}} {{.Status}}'
  exit 1
fi
"$work/bin/supabase" status --workdir "$work/stack" -o json >"$work/status.private" 2>/dev/null
[[ $(docker network inspect -f '{{.Internal}}' "$network") == true ]]
for service_name in db auth storage kong; do
  [[ $(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "supabase_${service_name}_$project") == "$project" ]]
  [[ $(docker inspect -f '{{.State.Running}}' "supabase_${service_name}_$project") == true ]]
done
api_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$network\").IPAddress}}" "supabase_kong_$project")
[[ $api_ip =~ ^172\.30\.250\.[0-9]+$ ]]
WORK="$work" API_IP="$api_ip" node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const s=JSON.parse(readFileSync(`${process.env.WORK}/status.private`));
if (!s.ANON_KEY || !s.SERVICE_ROLE_KEY || s.API_URL !== 'http://127.0.0.1:55431') throw new Error('Unexpected disposable status format');
writeFileSync(`${process.env.WORK}/runtime/credentials.json`, JSON.stringify({anon:s.ANON_KEY,service:s.SERVICE_ROLE_KEY}), {mode:0o600});
writeFileSync(`${process.env.WORK}/runtime/network.json`, JSON.stringify({origin:`http://${process.env.API_IP}:8000`}), {mode:0o600});
JS
node "$root/build-fixture.mjs" "$work/current.sql"
dbsql() { docker exec -i -e PGOPTIONS='-c phase_t.sandbox=ephemeral' "$db" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
dbsql <"$work/current.sql" >/dev/null
dbsql -At <"$root/catalog.sql" >"$work/results/catalog-current.json"
node "$root/verify-catalog.mjs" "$work/results/catalog-current.json" current

{
  printf 'tested_sha=%s\nhead_sha=%s\n' "$(git rev-parse HEAD)" "${PHASE_T_HEAD_SHA:-unknown}"
  printf 'supabase_cli=2.118.0\nnode=%s\nrunner_image=%s\n' "$(node --version)" "${ImageVersion:-unknown}"
  docker version --format 'docker_server={{.Server.Version}} docker_client={{.Client.Version}}'
  python3 --version
  sudo iptables --version
  dbsql -Atqc 'SHOW server_version;'
  docker ps --filter "label=com.supabase.cli.project=$project" --format '{{.Names}} {{.Image}}'
  for img in $(docker ps --filter "label=com.supabase.cli.project=$project" --format '{{.Image}}') "$node_image"; do
    docker image inspect --format '{{json .RepoDigests}}' "$img"
  done
} >"$work/results/versions.txt"

[[ $(id -u) != 0 ]]
docker run -d --name "$runner" --label "natori.phase-t=$project" --network "$network" \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges:true --read-only \
  --pids-limit 64 --memory 256m --cpus 1 --log-driver none \
  --mount "type=bind,source=$root,target=/tests,readonly" \
  --mount "type=bind,source=$work/runtime,target=/runtime,readonly" \
  --mount "type=bind,source=$work/results,target=/results" \
  "$node_image" node -e 'setTimeout(() => {}, 900000)' >/dev/null
pid=$(docker inspect -f '{{.State.Pid}}' "$runner")
[[ $pid =~ ^[1-9][0-9]*$ ]]
# All descendants inherit this network namespace; they have no NET_ADMIN capability,
# host namespace access or Docker socket. DNS and IPv6 are denied as well.
sudo nsenter -t "$pid" -n iptables -F OUTPUT
sudo nsenter -t "$pid" -n iptables -P OUTPUT DROP
sudo nsenter -t "$pid" -n iptables -A OUTPUT -d "$api_ip" -p tcp --dport 8000 -j ACCEPT
sudo nsenter -t "$pid" -n iptables -A OUTPUT -j REJECT
sudo nsenter -t "$pid" -n ip6tables -P OUTPUT DROP
echo 'TEST: kernel egress allowlist active; no downloads or production destinations'
timeout 45 docker exec "$runner" node /tests/isolation.mjs
timeout 180 docker exec "$runner" node /tests/storage.mjs current
dbsql <"$root/fixtures/candidate.sql" >/dev/null
dbsql -At <"$root/catalog.sql" >"$work/results/catalog-candidate.json"
node "$root/verify-catalog.mjs" "$work/results/catalog-candidate.json" candidate
timeout 180 docker exec "$runner" node /tests/storage.mjs candidate
sudo nsenter -t "$pid" -n iptables -nvL OUTPUT >"$work/results/egress-counters.txt"
sudo nsenter -t "$pid" -n ip6tables -S OUTPUT >>"$work/results/egress-counters.txt"
echo 'Required real Storage tests completed; production remains unchanged'

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
repo=$(git rev-parse --show-toplevel)
phase0a=${PHASE_0A:-0}
phase0b=${PHASE_0B:-0}
[[ $phase0b == 0 || $phase0b == 1 ]] || exit 1
[[ $phase0a == 0 || $phase0a == 1 ]] || exit 1
work=$(mktemp -d "${RUNNER_TEMP:?}/natori-phase-t.XXXXXXXX")
project="natori-phase-t-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
network="$project"
build_network="$project-build"
runner="$project-test"
db="supabase_db_$project"
subnet='172.30.250.0/24'
chain="NT${GITHUB_RUN_ID: -12}${GITHUB_RUN_ATTEMPT}"
mkdir -p "$work/stack/supabase" "$work/runtime" "$work/results" "$work/bin"
printf 'PHASE_T_RESULTS=%s\n' "$work/results" >> "$GITHUB_ENV"
network_created=0
build_network_created=0
firewall_created=0
stack_started=0

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ $(docker inspect -f '{{index .Config.Labels "natori.phase-t"}}' "$project-browser" 2>/dev/null) == "$project" ]]; then
    docker rm -f "$project-browser" >/dev/null
  fi
  if [[ $(docker inspect -f '{{index .Config.Labels "natori.phase-t"}}' "$runner" 2>/dev/null) == "$project" ]]; then
    docker rm -f "$runner" >/dev/null
  fi
  if (( stack_started )); then
    # Exact project ID; never --all or prune. No shared stack is touched.
    timeout 90 "$work/bin/supabase" stop --workdir "$work/stack" --project-id "$project" --no-backup >"$work/stop.private" 2>&1
    if (( $? != 0 )); then echo 'Dedicated stack cleanup failed'; status=1; fi
  fi
  if (( network_created )); then docker network rm "$network" >/dev/null || status=1; fi
  if (( build_network_created )); then docker network rm "$build_network" >/dev/null || status=1; fi
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

extra_mounts=()
test_memory=256m
if [[ $phase0a == 1 ]]; then
  mkdir -p "$work/phase0a"
  node "$repo/scripts/natori-phase-0a/build.mjs" "$work/phase0a/integration.cjs"
  extra_mounts+=(--mount "type=bind,source=$work/phase0a,target=/phase0a,readonly")
  extra_mounts+=(--mount "type=bind,source=$repo/node_modules,target=/app/node_modules,readonly")
  extra_mounts+=(-e NODE_PATH=/app/node_modules)
  test_memory=512m
fi

if [[ $phase0b == 1 ]]; then
  mkdir -p "$work/phase0b"
  node "$repo/scripts/natori-phase-0b/build.mjs" "$work/phase0b/integration.cjs"
  node "$repo/scripts/natori-phase-0b/build-fixture.mjs" "$work/phase0b.sql"
  extra_mounts+=(--mount "type=bind,source=$work/phase0b,target=/phase0b,readonly")
  if [[ $phase0a == 0 ]]; then
    extra_mounts+=(--mount "type=bind,source=$repo/node_modules,target=/app/node_modules,readonly")
    extra_mounts+=(-e NODE_PATH=/app/node_modules)
  fi
  test_memory=512m
fi

echo 'BUILD: download tools/images; production credentials are absent'
curl --fail --silent --show-error --location --connect-timeout 15 --max-time 120 --retry 1 \
  https://github.com/supabase/cli/releases/download/v2.118.0/supabase_2.118.0_linux_amd64.tar.gz -o "$work/cli.tar.gz"
printf 'f6089a86fb9d9221c958193a277338daddd6822f706929943812fa32e106c86d  %s\n' "$work/cli.tar.gz" | sha256sum -c -
tar --no-same-owner -xzf "$work/cli.tar.gz" -C "$work/bin" supabase
[[ $("$work/bin/supabase" --version) == 2.118.0 ]]
export SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
"$work/bin/supabase" start --help >"$work/results/cli-start-help.txt"
"$work/bin/supabase" stop --help >"$work/results/cli-stop-help.txt"

# Same resolved Node version as setup-node(.node-version). Phase 0A additionally
# mounts only locked dependencies installed during construction, never .env files.
node_image="node:$(node -p 'process.versions.node')-bookworm-slim"
timeout 180 docker pull "$node_image" >"$work/pull.private" 2>&1
if [[ $phase0b == 1 ]]; then bash "$repo/scripts/natori-phase-0b/prepare-browser.sh" "$repo" "$work" "$node_image" "$project"; fi
ROOT="$root" WORK="$work" PROJECT="$project" node --input-type=module <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
let config = readFileSync(`${process.env.ROOT}/supabase/config.toml`, 'utf8');
config = config.replace('natori-phase-t-placeholder', process.env.PROJECT);
config = config.replace('[db]', `[db]\npassword = "${randomBytes(32).toString('hex')}"`);
config = config.replace('[auth]', `[auth]\njwt_secret = "${randomBytes(48).toString('hex')}"\npublishable_key = "sb_publishable_${randomBytes(24).toString('base64url')}"\nsecret_key = "sb_secret_${randomBytes(24).toString('base64url')}"`);
writeFileSync(`${process.env.WORK}/stack/supabase/config.toml`, config, { mode: 0o600 });
JS

# Inbound publication guard before any Supabase ports are bound.
sudo iptables -N "$chain"
sudo iptables -A "$chain" -d "$subnet" ! -s "$subnet" -j DROP
sudo iptables -A "$chain" -d 172.30.249.0/24 ! -s 172.30.249.0/24 -j DROP
sudo iptables -A "$chain" -j RETURN
sudo iptables -I DOCKER-USER 1 -j "$chain"
firewall_created=1
# CLI bootstrap needs the host-published DB port. Bind it to loopback only.
docker network create --subnet 172.30.249.0/24 --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  --label "natori.phase-t=$project" "$build_network" >/dev/null
build_network_created=1
stack_started=1
if ! timeout 540 "$work/bin/supabase" start --output-format json --workdir "$work/stack" --network-id "$build_network" \
  --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor >"$work/startup.private" 2>&1; then
  echo 'Supabase startup failed; mandatory tests have NOT passed'
  # Only classifications, never raw CLI logs (which can contain credentials).
  WORK="$work" python3 - <<'PY'
import os,re,json,tomllib
from pathlib import Path
w=Path(os.environ['WORK'])
raw=(w/'startup.private').read_text(errors='replace')
text=raw.lower()
for label in ['invalid config','unknown field','failed to pull','unhealthy','permission denied','connection refused','timeout','failed to start']:
    if label in text: print('startup classification: '+label)
secrets=tomllib.loads((w/'stack/supabase/config.toml').read_text())['auth']
for line in raw.splitlines():
    try: err=json.loads(line).get('error',{})
    except (ValueError,AttributeError): continue
    if not isinstance(err,dict): continue
    code=err.get('code','')
    if re.fullmatch(r'[A-Za-z0-9_]+',code): print('startup code: '+code)
    message=str(err.get('message',''))
    for name in ['jwt_secret','publishable_key','secret_key']:
        message=message.replace(secrets.get(name,'<unset>'),'[redacted]')
    message=re.sub(r'eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(?:secret|publishable)_[\w-]+|[a-fA-F0-9]{48,}', '[redacted]', message)
    message=re.sub(r'(?:https?|postgres(?:ql)?)://[^\s\"\']+', '[url]', message)
    message=re.sub(r'(?i)(password|token|secret|key)\s*[=:]\s*[^\s,;]+', r'\1=[redacted]', message)
    print('startup error: '+message[:800])
# Some bootstrap errors use plain stderr instead of the structured error envelope.
# Suppress credential-bearing lines and opaque strings, then show only the last 12.
safe=[]
for line in raw.splitlines():
    line=re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', line)
    if re.search(r'(?i)token|secret|password|api.?key|authorization|postgresql://|service.role|jwt',line): continue
    for value in secrets.values():
        if isinstance(value,str) and len(value)>15: line=line.replace(value,'[redacted]')
    line=re.sub(r'[A-Za-z0-9_./+=:-]{24,}', '[opaque]', line)
    safe.append(line[:300])
for line in safe[-12:]: print('startup diagnostic: '+line)
PY
  docker ps -a --filter "label=com.supabase.cli.project=$project" --format '{{.Names}} {{.Status}}'
  exit 1
fi
"$work/bin/supabase" status --workdir "$work/stack" -o json >"$work/status.private" 2>/dev/null
for service_name in db auth storage kong; do
  [[ $(docker inspect -f '{{index .Config.Labels "com.supabase.cli.project"}}' "supabase_${service_name}_$project") == "$project" ]]
  [[ $(docker inspect -f '{{.State.Running}}' "supabase_${service_name}_$project") == true ]]
done
# FREEZE: move every stack container onto an internal-only network, preserving DNS aliases.
# There is no test process yet. No container may retain its construction network.
docker network create --internal --subnet "$subnet" --label "natori.phase-t=$project" "$network" >/dev/null
network_created=1
mapfile -t stack_containers < <(docker ps -aq --filter "label=com.supabase.cli.project=$project")
(( ${#stack_containers[@]} >= 4 ))
for container in "${stack_containers[@]}"; do
  [[ $(docker inspect -f '{{len .NetworkSettings.Networks}}' "$container") == 1 ]]
  mapfile -t aliases < <(docker inspect -f "{{range (index .NetworkSettings.Networks \"$build_network\").Aliases}}{{println .}}{{end}}" "$container" | sed '/^$/d')
  alias_args=()
  for alias in "${aliases[@]}"; do alias_args+=(--alias "$alias"); done
  docker network connect "${alias_args[@]}" "$network" "$container"
done
for container in "${stack_containers[@]}"; do
  docker network disconnect "$build_network" "$container"
  [[ $(docker inspect -f '{{len .NetworkSettings.Networks}}' "$container") == 1 ]]
done
[[ $(docker network inspect -f '{{len .Containers}}' "$build_network") == 0 ]]
[[ $(docker network inspect -f '{{.Internal}}' "$network") == true ]]
# Clear pre-freeze database pools and DNS caches on services that consume Postgres.
for service_name in auth rest storage kong; do docker restart "supabase_${service_name}_$project" >/dev/null; done
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
# Local fixture provisioning needs the Storage table owner's administrative role.
# This is a Unix-socket connection inside the verified disposable DB container only.
# HTTP authorization tests below still use anon/user/service JWTs, never this role.
dbsql() { docker exec -i -e PGOPTIONS='-c phase_t.sandbox=ephemeral -c search_path=pg_catalog,public' "$db" psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }
dbsql <"$work/current.sql" >/dev/null
dbsql -At <"$root/catalog.sql" >"$work/results/catalog-current.json"
node "$root/verify-catalog.mjs" "$work/results/catalog-current.json" current

{
  printf 'tested_sha=%s\nhead_sha=%s\n' "$(git rev-parse HEAD)" "${PHASE_T_HEAD_SHA:-unknown}"
  printf 'supabase_cli=2.118.0\nnode=%s\nrunner_image=%s\n' "$(node --version)" "${ImageVersion:-unknown}"
  if [[ $phase0a == 1 || $phase0b == 1 ]]; then
    node -e 'const fs=require("node:fs");for(const p of ["@supabase/supabase-js","@supabase/ssr","sharp","tus-js-client","esbuild"])console.log(`${p}=${JSON.parse(fs.readFileSync(`node_modules/${p}/package.json`,"utf8")).version}`)'
    sha256sum "$repo/package-lock.json"
  fi
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
  --pids-limit 64 --memory "$test_memory" --cpus 1 --log-driver none \
  --tmpfs /state:rw,noexec,nosuid,size=1m,mode=1777 \
  --mount "type=bind,source=$root,target=/tests,readonly" \
  --mount "type=bind,source=$work/runtime,target=/runtime,readonly" \
  --mount "type=bind,source=$work/results,target=/results" \
  "${extra_mounts[@]}" \
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
timeout 40 docker exec "$runner" node --input-type=module -e '
  import {readFileSync} from "node:fs";
  const {origin}=JSON.parse(readFileSync("/runtime/network.json"));
  let ready=false;
  for(let n=0;n<30;n++) {
    try { const r=await fetch(`${origin}/auth/v1/health`,{signal:AbortSignal.timeout(1000),redirect:"error"});if(r.ok){ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,500));
  }
  if(!ready) process.exit(1);
'
timeout 45 docker exec "$runner" node /tests/isolation.mjs
timeout 180 docker exec "$runner" node /tests/storage.mjs current
if [[ $phase0a == 1 ]]; then
  dbsql <"$repo/scripts/natori-phase-0a/extra-buckets.sql" >/dev/null
  dbsql <"$repo/supabase/migrations/20260927010903_natori_phase_0a_gallery_intake.sql" >/dev/null
  dbsql -At <"$root/catalog.sql" >"$work/results/catalog-phase0a-before.json"
  node "$repo/scripts/natori-phase-0a/verify-catalog.mjs" "$work/results/catalog-phase0a-before.json" before
  timeout 240 docker exec "$runner" node /phase0a/integration.cjs before
  # Mandatory negative gate: unset approval must reject without dropping any policy.
  if dbsql <"$repo/supabase/operations/natori-phase-0a/restrict-storage.sql" >"$work/cutover-guard.private" 2>&1; then
    echo 'FAIL cutover approval guard'; exit 1
  fi
  grep -Fq 'Explicit Phase 0A cutover approval required' "$work/cutover-guard.private"
  dbsql -At <"$root/catalog.sql" >"$work/results/catalog-phase0a-guard.json"
  node "$repo/scripts/natori-phase-0a/verify-catalog.mjs" "$work/results/catalog-phase0a-guard.json" before
  echo 'PASS cutover approval guard: no catalogue changes'
  # Same-name drift must also reject, even when the acknowledgement is set.
  dbsql -c 'ALTER POLICY "Allow public access 1exduyn_1" ON storage.objects WITH CHECK (true);' >/dev/null
  if { echo "SET natori.phase_0a_cutover='approved';"; cat "$repo/supabase/operations/natori-phase-0a/restrict-storage.sql"; } | dbsql >"$work/cutover-drift.private" 2>&1; then
    echo 'FAIL cutover catalogue drift guard'; exit 1
  fi
  grep -Fq 'Reviewed write policy differs:' "$work/cutover-drift.private"
  dbsql -c 'DROP POLICY "Allow public access 1exduyn_1" ON storage.objects; CREATE POLICY "Allow public access 1exduyn_1" ON storage.objects FOR UPDATE TO public USING (bucket_id = '\''artworks'\'');' >/dev/null
  dbsql -At <"$root/catalog.sql" >"$work/results/catalog-phase0a-drift-restored.json"
  node "$repo/scripts/natori-phase-0a/verify-catalog.mjs" "$work/results/catalog-phase0a-drift-restored.json" before
  echo 'PASS cutover catalogue drift guard: no partial policy removal'
  # Only the already verified disposable DB gets the acknowledgement flag.
  { echo "SET natori.phase_0a_cutover='approved';"; cat "$repo/supabase/operations/natori-phase-0a/restrict-storage.sql"; } | dbsql >/dev/null
  dbsql -At <"$root/catalog.sql" >"$work/results/catalog-phase0a-after.json"
  node "$repo/scripts/natori-phase-0a/verify-catalog.mjs" "$work/results/catalog-phase0a-after.json" after
else
  dbsql <"$root/fixtures/candidate.sql" >/dev/null
  dbsql -At <"$root/catalog.sql" >"$work/results/catalog-candidate.json"
  node "$root/verify-catalog.mjs" "$work/results/catalog-candidate.json" candidate
fi
timeout 180 docker exec "$runner" node /tests/storage.mjs candidate
if [[ $phase0a == 1 ]]; then timeout 240 docker exec "$runner" node /phase0a/integration.cjs after; fi
if [[ $phase0b == 1 ]]; then
  dbsql <"$work/phase0b.sql" >/dev/null
  timeout 240 docker exec "$runner" node /phase0b/integration.cjs
  bash "$repo/scripts/natori-phase-0b/run-browser.sh" "$repo" "$work" "$runner" "$project" "$pid"
fi
sudo nsenter -t "$pid" -n iptables -nvL OUTPUT >"$work/results/egress-counters.txt"
sudo nsenter -t "$pid" -n ip6tables -S OUTPUT >>"$work/results/egress-counters.txt"
echo 'Required real Storage tests completed; production remains unchanged'

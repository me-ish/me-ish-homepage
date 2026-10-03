#!/usr/bin/env bash
set -Eeuo pipefail
repo=$1 work=$2 runner=$3 project=$4 pid=$5
[[ $work == "${RUNNER_TEMP:?}"/natori-phase-t.* && $project == natori-phase-t-* ]] || exit 1
[[ $(docker inspect -f '{{index .Config.Labels "natori.phase-t"}}' "$runner") == "$project" ]]
[[ $(docker inspect -f '{{.State.Pid}}' "$runner") == "$pid" ]]
sudo nsenter -t "$pid" -n iptables -I OUTPUT 1 -d 127.0.0.1 -p tcp --dport 3000 -j ACCEPT
sudo nsenter -t "$pid" -n iptables -I OUTPUT 2 -s 127.0.0.1 -d 127.0.0.1 -p tcp --sport 3000 -m conntrack --ctstate ESTABLISHED -j ACCEPT
timeout 45 docker exec "$runner" node /tests/isolation.mjs
phase4_mount=()
if [[ ${PHASE_6B:-0} == 1 ]]; then
  phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-6b,target=/phase6b-browser,readonly")
  phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-7,target=/phase7-browser,readonly")
fi
if [[ ${PHASE_7:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$work/phase7,target=/phase7,readonly"); fi
if [[ ${PHASE_6A:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-6a,target=/phase6a-browser,readonly"); fi
if [[ ${PHASE_5:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-5,target=/phase5-browser,readonly"); fi
if [[ ${PHASE_3B:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-3b,target=/phase3b-browser,readonly"); fi
if [[ ${PHASE_3A:-0} == 1 ]]; then
  phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-3a,target=/phase3a-browser,readonly")
  phase4_mount+=(--mount "type=bind,source=$work/phase3a,target=/phase3a,readonly")
fi
if [[ ${PHASE_2D:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-2d,target=/phase2d-browser,readonly"); fi
if [[ ${PHASE_2C:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-2c,target=/phase2c-browser,readonly"); fi
if [[ ${PHASE_4:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-4,target=/phase4-browser,readonly"); fi
if [[ ${PHASE_1:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-1,target=/phase1-browser,readonly"); fi
if [[ ${PHASE_2A:-0} == 1 ]]; then phase4_mount+=(--mount "type=bind,source=$repo/scripts/natori-phase-2a,target=/phase2a-browser,readonly"); fi

docker run -d --name "$project-browser" --label "natori.phase-t=$project" --network "container:$runner" \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges:true --read-only \
  --pids-limit 256 --memory 4g --cpus 2 --shm-size 256m --log-driver none \
  --tmpfs /tmp:rw,nosuid,size=512m,mode=1777 \
  --mount "type=bind,source=$work/browser-bin,target=/runtime-bin,readonly" \
  --mount "type=bind,source=$work/browser-app,target=/app" \
  --mount "type=bind,source=$repo/node_modules,target=/app/node_modules,readonly" \
  --mount "type=bind,source=$repo/scripts/natori-phase-n,target=/browser-test,readonly" \
  "${phase4_mount[@]}" \
  --mount "type=bind,source=$work/runtime,target=/runtime,readonly" \
  --mount "type=bind,source=$work/results,target=/results" \
  -e PHASE_N_BROWSER=ephemeral -e HOME=/tmp -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  mcr.microsoft.com/playwright:v1.58.2-noble /runtime-bin/node -e 'setTimeout(()=>{},1800000)' >/dev/null
timeout 600 docker exec "$project-browser" /runtime-bin/node /browser-test/browser.mjs

if [[ ${PHASE_4:-0} == 1 ]]; then timeout 480 docker exec "$project-browser" /runtime-bin/node /phase4-browser/browser.mjs; fi

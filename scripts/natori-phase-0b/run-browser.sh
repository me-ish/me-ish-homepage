#!/usr/bin/env bash
set -Eeuo pipefail
repo=$1 work=$2 runner=$3 project=$4 pid=$5
[[ $work == "${RUNNER_TEMP:?}"/natori-phase-t.* && $project == natori-phase-t-* ]] || exit 1
[[ $(docker inspect -f '{{index .Config.Labels "natori.phase-t"}}' "$runner") == "$project" ]]
[[ $(docker inspect -f '{{.State.Pid}}' "$runner") == "$pid" ]]
# Only the verified namespace's own Next port is added. No host publication,
# tunnel, DNS, general loopback, external network or new service connection.
sudo nsenter -t "$pid" -n iptables -I OUTPUT 1 -d 127.0.0.1 -p tcp --dport 3000 -j ACCEPT
sudo nsenter -t "$pid" -n iptables -I OUTPUT 2 -s 127.0.0.1 -d 127.0.0.1 -p tcp --sport 3000 -m conntrack --ctstate ESTABLISHED -j ACCEPT
cp "$work/results/isolation.json" "$work/results/isolation-before-browser.json"
timeout 45 docker exec "$runner" node /tests/isolation.mjs
# Next/Chromium and all descendants share the namespace just re-tested above.
# Test code only; the unprivileged container cannot change firewall or reach Docker.
docker run -d --name "$project-browser" --label "natori.phase-t=$project" --network "container:$runner" \
  --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges:true --read-only \
  --pids-limit 256 --memory 4g --cpus 2 --shm-size 256m --log-driver none \
  --tmpfs /tmp:rw,nosuid,size=512m,mode=1777 \
  --mount "type=bind,source=$work/browser-bin,target=/runtime-bin,readonly" \
  --mount "type=bind,source=$work/browser-app,target=/app" \
  --mount "type=bind,source=$repo/node_modules,target=/app/node_modules,readonly" \
  --mount "type=bind,source=$repo/scripts/natori-phase-0b,target=/browser-test,readonly" \
  --mount "type=bind,source=$work/runtime,target=/runtime,readonly" \
  --mount "type=bind,source=$work/results,target=/results" \
  -e PHASE_0B_BROWSER=ephemeral -e HOME=/tmp -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  mcr.microsoft.com/playwright:v1.58.2-noble /runtime-bin/node -e 'setTimeout(()=>{},720000)' >/dev/null
timeout 600 docker exec "$project-browser" /runtime-bin/node /browser-test/browser.mjs

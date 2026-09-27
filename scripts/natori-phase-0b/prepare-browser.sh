#!/usr/bin/env bash
set -Eeuo pipefail
repo=$1 work=$2 node_image=$3 project=$4
[[ $work == "${RUNNER_TEMP:?}"/natori-phase-t.* && $project == natori-phase-t-* ]] || exit 1
[[ $(node -p 'require("./node_modules/playwright/package.json").version') == 1.58.2 ]] || { echo 'Review the locked browser image version'; exit 1; }
# Construction only. No credentials, test code or ports in this image retrieval.
timeout 240 docker pull mcr.microsoft.com/playwright:v1.58.2-noble >"$work/browser-pull.private" 2>&1
mkdir -p "$work/browser-bin"
docker run --rm --network none --label "natori.phase-t=$project" "$node_image" cat /usr/local/bin/node >"$work/browser-bin/node"
chmod 755 "$work/browser-bin/node"
node "$repo/scripts/natori-phase-0b/prepare-browser.mjs" "$work/browser-app"
cp "$work/browser-app/source-checksums.json" "$work/results/browser-source-checksums.json"
docker image inspect --format '{{json .RepoDigests}}' mcr.microsoft.com/playwright:v1.58.2-noble >"$work/results/browser-versions.txt"
printf 'playwright=1.58.2\nnode=%s\n' "$(node --version)" >>"$work/results/browser-versions.txt"

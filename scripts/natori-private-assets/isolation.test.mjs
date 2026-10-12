import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { postgresReady } from "./postgres-ready.mjs";
import { commandFailure } from "./command-error.mjs";
import { localApplicationURL } from "./local-redirect.mjs";
import { assertNoEnvFiles } from "./env-guard.mjs";
const app = "http://127.0.0.1:43210";
test("permits only the same-port localhost alias and preserves locale/search", () => {
  assert.equal(
    localApplicationURL(
      "http://localhost:43210/en/natori/portfolio?_rsc=fixture",
      app,
    ).href,
    app + "/en/natori/portfolio?_rsc=fixture",
  );
});
test("refuses external origins, lookalikes, credentials, alternate ports and schemes", () => {
  for (const input of [
    "http://outside.invalid:43210/",
    "http://localhost.outside.invalid:43210/",
    "http://127.0.0.2:43210/",
    "http://localhost:43211/",
    "https://localhost:43210/",
    "http://user:pass@localhost:43210/",
    "file:///tmp/fixture",
  ])
    assert.throws(() => localApplicationURL(input, app));
});
test("environment guard refuses by filename without opening its contents", () => {
  const directory = mkdtempSync("/tmp/sec01-env-guard-");
  assert.doesNotThrow(() => assertNoEnvFiles(directory));
  writeFileSync(directory + "/.env.local", "SYNTHETIC_DO_NOT_READ");
  assert.throws(() => assertNoEnvFiles(directory), /Environment files present/);
});

test("Phase7 actual guard accepts the split reader and rejects altered workflow provenance", () => {
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  const output = join(mkdtempSync("/tmp/natori-phase-t."), "browser-app");
  mkdirSync(output);
  writeFileSync(join(output, "source-checksums.json"), "{}");
  const script = join(repo, "scripts/natori-phase-7/prepare-browser.mjs");
  const options = {
    cwd: repo,
    env: { PATH: process.env.PATH, PHASE_7_BROWSER: "ephemeral" },
    stdio: "pipe",
  };
  execFileSync(process.execPath, [script, output], options);
  const contract = JSON.parse(
    readFileSync(join(output, "phase7-surface-contract.json"), "utf8"),
  );
  const path = "src/features/natori/server/portfolioSiteService.ts";
  assert.equal(
    contract.actual_source_sha256[path],
    createHash("sha256")
      .update(readFileSync(join(repo, path)))
      .digest("hex"),
  );
  const altered = mkdtempSync("/tmp/sec01-provenance-negative-");
  const first = "src/features/natori/types/portfolioDisplay.ts";
  mkdirSync(dirname(join(altered, first)), { recursive: true });
  writeFileSync(
    join(altered, first),
    readFileSync(join(repo, first), "utf8") +
      "\n// Synthetic unauthorized provenance change\n",
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [script, output], {
        ...options,
        cwd: altered,
      }),
    /ACCEPTED_PHASE_6B_REQUIRED/,
  );
});
test("command failure diagnostics cannot disclose token-bearing argv or stderr", () => {
  const error = {
    status: 1,
    signal: null,
    message: "docker run --env SERVICE_KEY=SYNTHETIC_SECRET",
    stderr:
      "SEC01_EXISTING_BUCKET_CONFIGURATION_REQUIRES_REVIEW SYNTHETIC_SECRET",
  };
  const safe = commandFailure(error, "docker", "run");
  assert.ok(!String(safe).includes("SYNTHETIC_SECRET"));
  assert.match(String(safe), /status=1/);
  assert.match(
    String(safe),
    /SEC01_EXISTING_BUCKET_CONFIGURATION_REQUIRES_REVIEW/,
  );
});

test("database readiness rejects socket-only startup and requires a successful TCP SQL probe", () => {
  const calls = [];
  const socketOnly = (_command, args) => {
    calls.push(args);
    throw Error("Synthetic TCP connection refused");
  };
  assert.equal(postgresReady(socketOnly, "sec01-acceptance-fixture-db"), false);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("-h"));
  assert.ok(calls[0].includes("127.0.0.1"));
  const failedSql = (_command, args) => {
    if (args.includes("psql")) throw Error("Synthetic SQL probe failed");
    return "";
  };
  assert.equal(postgresReady(failedSql, "sec01-acceptance-fixture-db"), false);
  const wrongSql = (_command, args) => (args.includes("psql") ? "0\n" : "");
  assert.equal(postgresReady(wrongSql, "sec01-acceptance-fixture-db"), false);
  const ready = (_command, args) => (args.includes("psql") ? "1\n" : "");
  assert.equal(postgresReady(ready, "sec01-acceptance-fixture-db"), true);
});

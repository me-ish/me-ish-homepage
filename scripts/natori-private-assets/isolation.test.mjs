import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { postgresReady } from "./postgres-ready.mjs";
import { storageProxyHeaders } from "./storage-proxy.mjs";
import { commandFailure } from "./command-error.mjs";
import { fetchLocalApplication, localApplicationURL } from "./local-redirect.mjs";
import { assertNoEnvFiles } from "./env-guard.mjs";
const app = "http://127.0.0.1:43210";
test("Storage forwarding replaces caller-controlled origin/prefix and preserves signed authorization", () => {
  const headers = storageProxyHeaders({
    "x-forwarded-host": "outside.invalid",
    "x-forwarded-proto": "https",
    "x-forwarded-port": "443",
    "x-forwarded-prefix": "//outside.invalid/escape",
    authorization: "Bearer SYNTHETIC_ANON",
    "x-signature": "SYNTHETIC_SIGNATURE",
    "x-upsert": "true",
    "upload-offset": "6291456",
  }, app);
  assert.equal(headers["x-forwarded-host"], "127.0.0.1:43210");
  assert.equal(headers["x-forwarded-port"], "43210");
  assert.equal(headers["x-forwarded-proto"], "http");
  assert.equal(headers["x-forwarded-prefix"], "/storage/v1");
  assert.equal(headers.authorization, "Bearer SYNTHETIC_ANON");
  assert.equal(headers["x-signature"], "SYNTHETIC_SIGNATURE");
  assert.equal(headers["x-upsert"], "true");
  assert.equal(headers["upload-offset"], "6291456");
  for (const origin of ["https://127.0.0.1:43210", "http://outside.invalid:43210", "http://localhost:43210", "http://user:pass@127.0.0.1:43210"])
    assert.throws(() => storageProxyHeaders({}, origin));
});
test("permits only the same-port localhost alias and preserves its host, locale and search", () => {
  assert.equal(
    localApplicationURL(
      "http://localhost:43210/en/natori/portfolio?_rsc=fixture",
      app,
    ).href,
    "http://localhost:43210/en/natori/portfolio?_rsc=fixture",
  );
});
test("loopback host redirect reaches the owned IPv4 listener and preserves method, headers and body", async (t) => {
  const received = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({
      host: request.headers.host.split(":")[0],
      path: request.url,
      method: request.method,
      cookie: request.headers.cookie,
      body: Buffer.concat(chunks).toString(),
    });
    if (received.length === 1) {
      response.writeHead(307, {
        Location: `http://localhost:${server.address().port}/en/natori/portfolio?_rsc=fixture`,
      });
      response.end();
    } else response.end("owned-loopback-response");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const diagnostics = [];
  const response = await fetchLocalApplication("/natori/portfolio", origin, {
    method: "PUT",
    headers: { Cookie: "sec01=SYNTHETIC_COOKIE" },
    body: "SYNTHETIC_BODY",
  }, (value) => diagnostics.push(value));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "owned-loopback-response");
  assert.deepEqual(received.map((value) => value.host), ["127.0.0.1", "localhost"]);
  assert.equal(received[1].path, "/en/natori/portfolio?_rsc=fixture");
  for (const value of received) {
    assert.equal(value.method, "PUT");
    assert.equal(value.cookie, "sec01=SYNTHETIC_COOKIE");
    assert.equal(value.body, "SYNTHETIC_BODY");
  }
  const safe = JSON.stringify(diagnostics);
  assert.ok(!safe.includes("SYNTHETIC_") && !safe.includes("_rsc"));
  assert.equal(diagnostics.at(-1).routeClass, "portfolio");
  assert.equal(diagnostics.at(-1).redirects[0].toHost, "localhost");
});
test("actual HTTP redirect guard refuses an external destination and bounds a local loop", async (t) => {
  let calls = 0;
  const server = createServer((request, response) => {
    calls++;
    response.writeHead(307, {
      Location: request.url === "/external"
        ? "http://outside.invalid/DO_NOT_FETCH"
        : "/loop",
    });
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  await assert.rejects(fetchLocalApplication("/external", origin), /External application redirect refused/);
  assert.equal(calls, 1);
  await assert.rejects(fetchLocalApplication("/loop", origin), /Local application redirect loop/);
  assert.equal(calls, 6);
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

test("Phase7 fixture records the actual product source it copied", () => {
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

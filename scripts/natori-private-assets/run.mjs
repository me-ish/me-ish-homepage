import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, randomBytes, createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  openSync,
  chmodSync,
  readdirSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { postgresReady } from "./postgres-ready.mjs";
import { commandFailure } from "./command-error.mjs";
import { assertNoEnvFiles } from "./env-guard.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
assertNoEnvFiles(root);
for (const key of [
  "DATABASE_URL",
  "PGHOST",
  "PGPASSWORD",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
])
  assert.ok(
    !Object.hasOwn(process.env, key),
    "Remove inherited configuration: " + key,
  );
const directory = mkdtempSync("/tmp/sec01-acceptance-");
chmodSync(directory, 0o700);
const sanitized = join(directory, "sanitized");
mkdirSync(sanitized, { mode: 0o700 });
if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_ENV)
  appendFileSync(process.env.GITHUB_ENV, `SEC01_RESULTS=${sanitized}\n`);
const prefix = "sec01-acceptance-" + randomBytes(6).toString("hex"),
  names = {
    db: prefix + "-db",
    auth: prefix + "-auth",
    rest: prefix + "-rest",
    storage: prefix + "-storage",
  };
const images = {
  db: "postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3",
  auth: "supabase/gotrue:v2.196.0@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232",
  rest: "postgrest/postgrest:v14.17@sha256:c9dc201e555f5d8e37e7f39cdd4df0229774996e213bfd7de8d10ac609030f2c",
  storage:
    "supabase/storage-api:v1.74.0@sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85",
};
const call = (cmd, args, input) => {
  try {
    return execFileSync(cmd, args, {
      cwd: root,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    // Raw argv/stdout/stderr are private, excluded from the artifact whitelist.
    appendFileSync(
      join(directory, "commandFailures.private.log"),
      String(error) + "\n",
      { mode: 0o600 },
    );
    throw commandFailure(error, cmd, args[0] ?? "none");
  }
};
const sql = (text) =>
  call(
    "docker",
    [
      "exec",
      "-i",
      names.db,
      "psql",
      "-X",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      "127.0.0.1",
      "-p",
      "5432",
      "-U",
      "postgres",
    ],
    text,
  );
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(fn, label) {
  for (let n = 0; n < 120; n++) {
    try {
      if (await fn()) return;
    } catch {}
    await pause(500);
  }
  throw Error(label + " not ready");
}
async function port() {
  const s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
const secret = "sec01-synthetic-jwt-" + randomBytes(24).toString("hex");
function jwt(role) {
  const b = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const v =
    b({ alg: "HS256", typ: "JWT" }) +
    "." +
    b({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
  return v + "." + createHmac("sha256", secret).update(v).digest("base64url");
}
const containers = [],
  children = [];
let network = false,
  fixturePath;
let stage = "initialization",
  driftIndex = null;
function docker(name, args) {
  call("docker", [
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    prefix,
    "--label",
    "meish.sec01-acceptance=" + prefix,
    ...args,
  ]);
  containers.push(name);
}
function child(file, log) {
  const fd = openSync(join(directory, log), "w", 0o600);
  const c = spawn(
    process.execPath,
    [join(root, "scripts/natori-private-assets", file)],
    {
      cwd: root,
      env: { PATH: process.env.PATH, SEC01_ACCEPTANCE_DIR: directory },
      stdio: ["ignore", fd, fd],
    },
  );
  children.push(c);
  return c;
}
const hash = (v) => createHash("sha256").update(v).digest("hex");
const inventory = call("git", ["ls-files"])
  .trim()
  .split("\n")
  .filter(
    (path) =>
      path.startsWith("scripts/natori-private-assets/") ||
      path.startsWith("scripts/natori-phase-7/") ||
      path.startsWith("src/features/natori/") ||
      (path.startsWith("src/app/") &&
        (path.includes("/natori/") ||
          path.includes("/natori-portfolio.png/"))) ||
      path === "src/middleware.ts" ||
      path === "src/types/supabase.ts" ||
      path === "next.config.mjs" ||
      path === "package-lock.json" ||
      path === ".node-version" ||
      path === "supabase/baseline/manifest.json" ||
      path ===
        "supabase/migrations/20261012013126_secure_natori_portfolio_assets.sql" ||
      ["ci.yml", "natori-phase-7.yml", "natori-private-assets.yml"].some(
        (name) => path === ".github/workflows/" + name,
      ),
  );
assert.ok(inventory.length > 100, "Critical tracked source inventory required");
writeFileSync(
  join(sanitized, "source.json"),
  JSON.stringify(
    {
      checkedOutHead: call("git", ["rev-parse", "HEAD"]).trim(),
      prHead: process.env.SEC01_PR_HEAD_SHA ?? null,
      base: process.env.SEC01_BASE_SHA ?? null,
      diffSha256: hash(call("git", ["diff", "HEAD"])),
      fileSha256: Object.fromEntries(
        inventory.map((path) => [path, hash(readFileSync(join(root, path)))]),
      ),
      images,
    },
    null,
    2,
  ),
);
console.log("Dedicated synthetic acceptance: " + directory);
try {
  stage = "image-preflight";
  for (const image of Object.values(images)) {
    try {
      call("docker", ["image", "inspect", image]);
    } catch {
      call("docker", ["pull", image]);
    }
  }
  stage = "internal-network";
  call("docker", [
    "network",
    "create",
    "--internal",
    "--label",
    "meish.sec01-acceptance=" + prefix,
    prefix,
  ]);
  network = true;
  stage = "database-bootstrap";
  docker(names.db, [
    "--tmpfs",
    "/var/lib/postgresql/data:rw,nosuid,nodev,size=512m",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    images.db,
  ]);
  const entrypoint = call("docker", [
    "exec",
    names.db,
    "cat",
    "/usr/local/bin/docker-entrypoint.sh",
  ]);
  const socketOnlyInit = /set -- "\$@" -c listen_addresses=''/.test(entrypoint);
  assert.ok(
    socketOnlyInit,
    "Pinned Postgres initialization transport assumption must be reviewed",
  );
  await wait(() => postgresReady(call, names.db), "Postgres TCP and SQL");
  writeFileSync(
    join(sanitized, "postgres-readiness.json"),
    JSON.stringify(
      {
        syntheticOnly: true,
        entrypointSha256: hash(entrypoint),
        socketOnlyInit,
        tcpReady: true,
        sqlProbe: 1,
        image: images.db,
      },
      null,
      2,
    ),
  );
  sql(`CREATE ROLE supabase_auth_admin LOGIN SUPERUSER PASSWORD 'synthetic-sec01'; ALTER ROLE supabase_auth_admin SET search_path=auth,public;
    CREATE ROLE supabase_storage_admin LOGIN SUPERUSER PASSWORD 'synthetic-sec01';
    CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'synthetic-sec01'; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT anon,authenticated,service_role TO authenticator;
    CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;
    CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claims',true)::jsonb->>'email'$$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'role'$$;
    GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role;`);
  stage = "auth-bootstrap";
  docker(names.auth, [
    "--env",
    "GOTRUE_API_HOST=0.0.0.0",
    "--env",
    "GOTRUE_API_PORT=9999",
    "--env",
    "GOTRUE_DB_DRIVER=postgres",
    "--env",
    `GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:synthetic-sec01@${names.db}:5432/postgres`,
    "--env",
    "GOTRUE_SITE_URL=http://127.0.0.1",
    "--env",
    "API_EXTERNAL_URL=http://127.0.0.1/auth/v1",
    "--env",
    "GOTRUE_JWT_SECRET=" + secret,
    "--env",
    "GOTRUE_JWT_ADMIN_ROLES=service_role",
    "--env",
    "GOTRUE_JWT_AUD=authenticated",
    "--env",
    "GOTRUE_EXTERNAL_EMAIL_ENABLED=true",
    "--env",
    "GOTRUE_MAILER_AUTOCONFIRM=false",
    "--env",
    "GOTRUE_SMTP_HOST=127.0.0.1",
    "--env",
    "GOTRUE_SMTP_PORT=1",
    images.auth,
  ]);
  docker(names.rest, [
    "--env",
    `PGRST_DB_URI=postgres://authenticator:synthetic-sec01@${names.db}:5432/postgres`,
    "--env",
    "PGRST_DB_SCHEMAS=public",
    "--env",
    "PGRST_DB_ANON_ROLE=anon",
    "--env",
    "PGRST_JWT_SECRET=" + secret,
    images.rest,
  ]);
  const anon = jwt("anon"),
    service = jwt("service_role");
  stage = "storage-bootstrap";
  docker(names.storage, [
    "--tmpfs",
    "/var/lib/storage:rw,nosuid,nodev,size=160m",
    "--env",
    `DATABASE_URL=postgres://supabase_storage_admin:synthetic-sec01@${names.db}:5432/postgres`,
    "--env",
    "ANON_KEY=" + anon,
    "--env",
    "SERVICE_KEY=" + service,
    "--env",
    "AUTH_JWT_SECRET=" + secret,
    "--env",
    `POSTGREST_URL=http://${names.rest}:3000`,
    "--env",
    "STORAGE_BACKEND=file",
    "--env",
    "GLOBAL_S3_BUCKET=synthetic-sec01",
    "--env",
    "FILE_STORAGE_BACKEND_PATH=/var/lib/storage",
    "--env",
    "TENANT_ID=synthetic-sec01",
    "--env",
    "REGION=ap-northeast-1",
    "--env",
    "ENABLE_IMAGE_TRANSFORMATION=false",
    "--env",
    "FILE_SIZE_LIMIT=50000000",
    images.storage,
  ]);
  const ip = (name) =>
    call("docker", [
      "inspect",
      "--format",
      "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
      name,
    ]).trim();
  const config = {
    syntheticOnly: true,
    container: names.db,
    api: `http://127.0.0.1:${await port()}`,
    app: `http://127.0.0.1:${await port()}`,
    authOrigin: `http://${ip(names.auth)}:9999`,
    restOrigin: `http://${ip(names.rest)}:3000`,
    storageOrigin: `http://${ip(names.storage)}:5000`,
    anon,
    service,
  };
  stage = "gateway-readiness";
  writeFileSync(join(directory, "runtime.json"), JSON.stringify(config), {
    mode: 0o600,
  });
  child("gateway.mjs", "gateway.private.log");
  await wait(
    async () => (await fetch(config.api + "/auth/v1/health")).ok,
    "Auth",
  );
  await wait(
    async () => (await fetch(config.api + "/storage/v1/status")).ok,
    "Storage",
  );
  // Vanilla PostgreSQL lacks the platform's Storage role grants. Reproduce that
  // contract in this owned database; restrictive policy tests still deny browsers.
  sql(
    "GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role; GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated; GRANT SELECT ON storage.buckets TO anon,authenticated; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA storage TO service_role;",
  );
  sql(
    readFileSync(
      join(root, "supabase/migrations/20260723111730_etorie_baseline.sql"),
      "utf8",
    ),
  );
  sql(
    readFileSync(
      join(
        root,
        "supabase/migrations/20260723111741_baseline_security_hardening.sql",
      ),
      "utf8",
    ),
  );
  const fixtureAdmin = createClient(config.api, config.service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init = {}) => {
        assert.equal(
          new URL(input instanceof Request ? input.url : input).origin,
          config.api,
          "External fixture request refused",
        );
        return fetch(input, {
          ...init,
          redirect: "error",
          signal: init.signal ?? AbortSignal.timeout(60_000),
        });
      },
    },
  });
  const secureMigration = readFileSync(
    join(
      root,
      "supabase/migrations/20261012013126_secure_natori_portfolio_assets.sql",
    ),
    "utf8",
  );
  for (const [index, drift] of [
    "true,50000000,ARRAY['image/webp','video/mp4']",
    "false,NULL,ARRAY['image/webp','video/mp4']",
    "false,50000001,ARRAY['image/webp','video/mp4']",
    "false,50000000,ARRAY['image/webp','video/mp4','text/html']",
  ].entries()) {
    driftIndex = index;
    stage = "bucket-drift.preflight";
    sql(
      `INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('natori-management-assets','natori-management-assets',${drift});`,
    );
    assert.throws(
      () => sql(secureMigration),
      /SEC01_EXISTING_BUCKET_CONFIGURATION_REQUIRES_REVIEW/,
    );
    assert.equal(
      call("docker", [
        "exec",
        names.db,
        "psql",
        "-X",
        "-q",
        "-t",
        "-A",
        "-U",
        "postgres",
        "-c",
        "SELECT to_regclass('public.natori_portfolio_assets') IS NULL;",
      ]).trim(),
      "t",
    );
    stage = "bucket-drift.cleanup";
    const empty = await fixtureAdmin.storage
      .from("natori-management-assets")
      .list("", { limit: 1 });
    assert.ok(
      !empty.error && Array.isArray(empty.data) && empty.data.length === 0,
      "Owned drift fixture must be empty",
    );
    const removed = await fixtureAdmin.storage.deleteBucket(
      "natori-management-assets",
    );
    if (removed.error) {
      const error = new Error("Owned fixture bucket API cleanup failed");
      error.name = "FixtureApiError";
      error.diagnostic = {
        operation: "deleteBucket",
        status: Number(removed.error.statusCode) || null,
      };
      throw error;
    }
  }
  driftIndex = null;
  stage = "secure-migration";
  sql(secureMigration);
  writeFileSync(
    join(sanitized, "schema.json"),
    JSON.stringify(
      {
        syntheticOnly: true,
        bucketDriftRefused: 4,
        selectedMigrationsOnly: true,
        fullActiveReplay: false,
        knownBlocker: "pre-existing migration 7 duplicate CHECK",
      },
      null,
      2,
    ),
  );
  sql("NOTIFY pgrst,'reload schema';");
  stage = "synthetic-data-setup";
  const setup = child("setup.mjs", "setup.private.log");
  await new Promise((r, j) =>
    setup.once("exit", (code) =>
      code === 0 ? r() : j(Error("Setup failed; private log retained")),
    ),
  );
  // A test-only legacy image route exercises the real Next optimizer without external hosts.
  fixturePath = join(root, "src/app/sec01-fixture-gallery.webp/route.ts");
  assert.ok(!existsSync(fixturePath));
  mkdirSync(join(root, "src/app/sec01-fixture-gallery.webp"), {
    recursive: true,
  });
  writeFileSync(
    fixturePath,
    `import {readFileSync} from 'node:fs'; export const runtime='nodejs'; export const dynamic='force-dynamic'; export function GET(){const d=process.env.SEC01_ACCEPTANCE_DIR;if(!d?.startsWith('/tmp/sec01-acceptance-'))return new Response(null,{status:404});return new Response(readFileSync(d+'/image.webp'),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=60'}});}`,
  );
  stage = "next-http-matrix";
  child("start-app.mjs", "app.private.log");
  const test = child("http.mjs", "http.private.log");
  await new Promise((r, j) =>
    test.once("exit", (code) =>
      code === 0
        ? r()
        : j(Error("HTTP acceptance failed; private log retained")),
    ),
  );
  writeFileSync(
    join(sanitized, "results.json"),
    readFileSync(join(directory, "results.json")),
  );
  console.log(
    "PASS real isolated Auth/Storage/HTTP acceptance; sanitized results.json retained",
  );
} catch (error) {
  if (existsSync(join(directory, "results.json")))
    writeFileSync(
      join(sanitized, "results.json"),
      readFileSync(join(directory, "results.json")),
    );
  else
    writeFileSync(
      join(sanitized, "results.json"),
      JSON.stringify({
        syntheticOnly: true,
        status: "failed",
        reason: "ISOLATED_RUNNER_FAILED",
        stage,
        driftIndex,
        failure: {
          category: error.name,
          location: error.stack?.match(/run\.mjs:\d+:\d+/)?.[0] ?? null,
          diagnostic: error.diagnostic ?? null,
        },
        noProductionExecution: true,
      }),
    );
  throw error;
} finally {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  for (
    let attempts = 0;
    attempts < 80 &&
    children.some((c) => c.exitCode === null && c.signalCode === null);
    attempts++
  )
    await pause(25);
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
  for (const name of containers.reverse()) {
    assert.equal(
      call("docker", [
        "inspect",
        "--format",
        '{{index .Config.Labels "meish.sec01-acceptance"}}',
        name,
      ]).trim(),
      prefix,
    );
    call("docker", ["rm", "-f", name]);
  }
  if (network) {
    assert.equal(
      call("docker", [
        "network",
        "inspect",
        "--format",
        '{{index .Labels "meish.sec01-acceptance"}}',
        prefix,
      ]).trim(),
      prefix,
    );
    call("docker", ["network", "rm", prefix]);
  }
  if (fixturePath && existsSync(fixturePath)) unlinkSync(fixturePath);
  console.log("Owned isolated services removed");
}

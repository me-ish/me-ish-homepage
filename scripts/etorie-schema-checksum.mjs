#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeCatalog,
  parseArgs,
  sha256,
  stableJson,
} from "./lib/etorie-schema-artifacts.mjs";

const args = parseArgs(process.argv.slice(2));
const databaseUrlEnv = args["db-url-env"] || "ETORIE_DATABASE_URL";
const databaseUrl = process.env[databaseUrlEnv];
const projectRef =
  args["project-ref"] || process.env.ETORIE_TARGET_PROJECT_REF || "unknown";
const outputRoot =
  args["output-root"] || path.join("artifacts", "schema-checksum");

if (!databaseUrl) {
  console.error(`Missing database URL environment variable: ${databaseUrlEnv}`);
  process.exit(1);
}
if (!/^[a-z0-9-]+$/i.test(projectRef)) {
  console.error("Invalid project ref label.");
  process.exit(1);
}

const scope = [
  "natori_projects",
  "natori_project_tasks",
  "natori_events",
  "natori_user_profiles",
  "natori_pricing_configs",
  "natori_portfolio_content",
  "natori_links_content",
  "natori_page_events",
  "natori_order_mail_logs",
  "natori_delivery_files",
  "natori_quotes",
  "natori_payment_transactions",
  "natori_inquiry_reference_files",
  "processed_stripe_events",
  "card_requests",
  "aura_projects",
];

const quotedScope = scope.map((name) => `'${name}'`).join(", ");
const sql = String.raw`
begin read only;
select jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'tables', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table"), '[]'::jsonb)
    from (
      select n.nspname as schema, c.relname as "table",
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and c.relname in (${quotedScope})
    ) x
  ),
  'columns', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.ordinal), '[]'::jsonb)
    from (
      select table_schema as schema, table_name as "table",
             ordinal_position as ordinal, column_name as "column",
             data_type as type, udt_schema, udt_name,
             (is_nullable = 'YES') as nullable,
             column_default as "default"
      from information_schema.columns
      where table_schema = 'public'
        and table_name in (${quotedScope})
    ) x
  ),
  'constraints', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.name), '[]'::jsonb)
    from (
      select n.nspname as schema, c.relname as "table", con.conname as name,
             con.contype::text as type,
             pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (${quotedScope})
    ) x
  ),
  'indexes', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.name), '[]'::jsonb)
    from (
      select schemaname as schema, tablename as "table",
             indexname as name, indexdef as definition
      from pg_indexes
      where schemaname = 'public'
        and tablename in (${quotedScope})
    ) x
  ),
  'triggers', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.name), '[]'::jsonb)
    from (
      select n.nspname as schema, c.relname as "table", t.tgname as name,
             pg_get_triggerdef(t.oid, true) as definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal
        and n.nspname = 'public'
        and c.relname in (${quotedScope})
    ) x
  ),
  'functions', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x.name, x."identityArguments"), '[]'::jsonb)
    from (
      select n.nspname as schema, p.proname as name,
             pg_get_function_identity_arguments(p.oid) as "identityArguments",
             pg_get_function_result(p.oid) as "returnType",
             l.lanname as language,
             p.prosecdef as "securityDefiner",
             p.provolatile::text as volatility,
             p.proisstrict as strict,
             p.proconfig as config,
             p.prosrc as body,
             pg_get_functiondef(p.oid) as definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public'
        and (p.proname like 'natori_%' or p.proname like 'touch_natori_%')
    ) x
  ),
  'functionAcl', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x.name, x."identityArguments", x.grantee, x.privilege), '[]'::jsonb)
    from (
      select n.nspname as schema, p.proname as name,
             pg_get_function_identity_arguments(p.oid) as "identityArguments",
             coalesce(r.rolname, 'public') as grantee,
             a.privilege_type as privilege,
             a.is_grantable as grantable
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      left join pg_roles r on r.oid = a.grantee
      where n.nspname = 'public'
        and (p.proname like 'natori_%' or p.proname like 'touch_natori_%')
        and coalesce(r.rolname, 'public') in ('public', 'anon', 'authenticated', 'service_role')
    ) x
  ),
  'policies', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.name), '[]'::jsonb)
    from (
      select schemaname as schema, tablename as "table", policyname as name,
             permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
        and tablename in (${quotedScope})
    ) x
  ),
  'tableGrants', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.grantee, x.privilege), '[]'::jsonb)
    from (
      select table_schema as schema, table_name as "table", grantee,
             privilege_type as privilege, is_grantable
      from information_schema.role_table_grants
      where (
        (table_schema = 'public' and table_name in (${quotedScope}))
        or (table_schema = 'storage' and table_name = 'objects')
      )
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
    ) x
  ),
  'buckets', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
    from (
      select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets
      where id in ('natori-inquiry-refs', 'natori-deliveries', 'natori-portfolio')
    ) x
  ),
  'storagePolicies', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.schema, x."table", x.name), '[]'::jsonb)
    from (
      select schemaname as schema, tablename as "table", policyname as name,
             permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
    ) x
  )
)::text;
commit;
`;

const result = spawnSync(
  "psql",
  [
    "--no-psqlrc",
    "--quiet",
    "--tuples-only",
    "--no-align",
    "--set=ON_ERROR_STOP=1",
    "--command",
    sql,
  ],
  {
    encoding: "utf8",
    env: { ...process.env, PGDATABASE: databaseUrl },
    windowsHide: true,
  },
);

if (result.error) {
  console.error(`Unable to run psql: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(result.stderr.trim() || "Catalog query failed.");
  process.exit(result.status || 1);
}

const line = result.stdout
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .find((entry) => entry.startsWith("{"));
if (!line) {
  console.error("Catalog query did not return JSON.");
  process.exit(1);
}

const capturedAt = new Date().toISOString();
const rawCatalog = JSON.parse(line);
const raw = {
  schemaVersion: 1,
  capturedAt,
  projectRef,
  scope,
  catalog: rawCatalog,
};
const normalized = {
  schemaVersion: 1,
  scope,
  catalog: normalizeCatalog(rawCatalog),
};
const normalizedJson = stableJson(normalized);
const checksum = sha256(normalizedJson);
const timestamp = capturedAt.replace(/\D/g, "").slice(0, 14);
const outputDir = path.join(outputRoot, projectRef, timestamp);

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "raw.json"), stableJson(raw), "utf8"),
  writeFile(
    path.join(outputDir, "normalized.json"),
    normalizedJson,
    "utf8",
  ),
  writeFile(path.join(outputDir, "sha256.txt"), `${checksum}\n`, "utf8"),
]);

console.log(`Schema snapshot: ${outputDir}`);
console.log(`SHA-256: ${checksum}`);

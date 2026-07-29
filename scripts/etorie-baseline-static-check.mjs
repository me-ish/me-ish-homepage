#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  ETORIE_EVIDENCE_EXPECTED_COUNT,
  readMigrationEvidence,
} from "./lib/etorie-migration-evidence.mjs";

const baselineName = "20260723111730_etorie_baseline.sql";
const hardeningName =
  "20260723111741_baseline_security_hardening.sql";
const phase1ExpandName =
  "20260729115313_etorie_phase1_expand.sql";
const phase1ConstraintsName =
  "20260729115323_etorie_phase1_project_constraints.sql";
const activeDirectory = path.join("supabase", "migrations");
const legacyDirectory = path.join("supabase", "legacy-migrations");
const baselinePath = path.join(activeDirectory, baselineName);
const hardeningPath = path.join(activeDirectory, hardeningName);
const phase1ExpandPath = path.join(activeDirectory, phase1ExpandName);
const phase1ConstraintsPath = path.join(
  activeDirectory,
  phase1ConstraintsName,
);
const fixturePath = path.join("supabase", "fixtures", "etorie-baseline.sql");
const phase1VerificationPath = path.join(
  "supabase",
  "verification",
  "etorie-p1-03-selects.sql",
);
const phase1SecurityVerificationPath = path.join(
  "supabase",
  "verification",
  "etorie-p1-04-security-selects.sql",
);
const manifestPath = path.join("supabase", "baseline", "manifest.json");
const legacyManifestPath = path.join(
  "supabase",
  "baseline",
  "legacy-migrations.json",
);
const legacyReadmePath = path.join(legacyDirectory, "README.md");

const [
  baseline,
  hardening,
  phase1Expand,
  phase1Constraints,
  phase1Verification,
  phase1SecurityVerification,
  fixture,
  manifestText,
  legacyText,
  legacyReadme,
  migrations,
  archivedMigrations,
] =
  await Promise.all([
    readFile(baselinePath, "utf8"),
    readFile(hardeningPath, "utf8"),
    readFile(phase1ExpandPath, "utf8"),
    readFile(phase1ConstraintsPath, "utf8"),
    readFile(phase1VerificationPath, "utf8"),
    readFile(phase1SecurityVerificationPath, "utf8"),
    readFile(fixturePath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(legacyManifestPath, "utf8"),
    readFile(legacyReadmePath, "utf8"),
    readdir(activeDirectory),
    readdir(legacyDirectory),
  ]);
const manifest = JSON.parse(manifestText);
const legacyManifest = JSON.parse(legacyText);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkDollarQuotes(sql, label) {
  const delimiters = [...sql.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)].map(
    (match) => match[0],
  );
  const stack = [];
  for (const delimiter of delimiters) {
    if (stack.at(-1) === delimiter) stack.pop();
    else stack.push(delimiter);
  }
  check(stack.length === 0, `${label}: unbalanced dollar quote delimiters`);
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

function executableStatements(sql) {
  return stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const active = migrations.filter((name) => name.endsWith(".sql")).sort();
const archived = archivedMigrations
  .filter((name) => name.endsWith(".sql"))
  .sort();
const activeVersions = active.map((name) => name.split("_", 1)[0]);
const baselineEvidenceNames = [baselineName, hardeningName];
const expectedActiveNames = [
  ...baselineEvidenceNames,
  phase1ExpandName,
  phase1ConstraintsName,
];
const expectedActivePaths = expectedActiveNames.map(
  (name) => `supabase/migrations/${name}`,
);
const manifestActiveNames = (manifest.activeMigrations ?? []).map((entry) =>
  path.basename(entry),
);

check(
  active.every((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)),
  "every active migration must use the 14-digit Supabase CLI filename format",
);
check(
  new Set(activeVersions).size === activeVersions.length,
  "active migration versions must be unique",
);
check(
  JSON.stringify(active) === JSON.stringify(expectedActiveNames),
  "active migrations must be the ordered baseline, hardening, expand, and constraint lane",
);
check(
  JSON.stringify(active.slice(0, 2)) ===
    JSON.stringify(baselineEvidenceNames),
  "baseline must sort immediately before security hardening",
);
check(
  JSON.stringify(manifestActiveNames) === JSON.stringify(active),
  "active directory and manifest active migration list must match exactly",
);
check(
  JSON.stringify(manifest.activeMigrations) ===
    JSON.stringify(expectedActivePaths),
  "manifest must declare the four current active migration paths",
);
check(
  manifest.activeMigrationDirectory === "supabase/migrations" &&
    manifest.legacyMigrationDirectory === "supabase/legacy-migrations",
  "manifest migration directories are invalid",
);
check(
  manifest.activeMigrationCount === active.length,
  "manifest active migration count is invalid",
);
check(
  manifest.legacyMigrationCount === archived.length,
  "manifest legacy migration count is invalid",
);
checkDollarQuotes(baseline, "baseline");
checkDollarQuotes(hardening, "hardening");
checkDollarQuotes(phase1Expand, "P1-03 expand");
checkDollarQuotes(phase1Constraints, "P1-03 constraints");
check(
  /^\s*--[\s\S]*?\bbegin;\s/i.test(baseline) && /\bcommit;\s*$/i.test(baseline),
  "baseline must be transaction wrapped",
);
check(
  /^\s*--[\s\S]*?\bbegin;\s/i.test(hardening) &&
    /\bcommit;\s*$/i.test(hardening),
  "hardening must be transaction wrapped",
);
check(
  /^\s*--[\s\S]*?\bbegin;\s/i.test(phase1Expand) &&
    /\bcommit;\s*$/i.test(phase1Expand),
  "P1-03 expand must be transaction wrapped",
);
check(
  /^\s*--[\s\S]*?\bbegin;\s/i.test(phase1Constraints) &&
    /\bcommit;\s*$/i.test(phase1Constraints),
  "P1-03 constraints must be transaction wrapped",
);
check(
  !baseline.includes("portfolio_profiles"),
  "portfolio_profiles must not appear in baseline",
);
check(
  !/create\s+policy[\s\S]*allow insert 1exduyn_0/i.test(
    stripSqlComments(baseline),
  ),
  "baseline must not create the broad Storage INSERT policy",
);
check(
  /drop\s+policy\s+if\s+exists\s+"Allow Insert 1exduyn_0"\s+on\s+storage\.objects/i.test(
    hardening,
  ),
  "hardening must drop the broad Storage INSERT policy",
);

const activeSql = [
  baseline,
  hardening,
  phase1Expand,
  phase1Constraints,
].join("\n");
const activeStatements = executableStatements(activeSql);
const storageObjectPolicies = activeStatements.filter(
  (statement) =>
    /^create\s+policy\b/i.test(statement) &&
    /\bon\s+storage\.objects\b/i.test(statement),
);
check(
  storageObjectPolicies.every(
    (statement) => !/\ballow insert 1exduyn_0\b/i.test(statement),
  ),
  "active migrations must not recreate Allow Insert 1exduyn_0",
);
check(
  storageObjectPolicies.every(
    (statement) =>
      !/\b(?:using|with\s+check)\s*\(\s*true\s*\)/i.test(statement),
  ),
  "active migrations must not create an unconditional storage.objects policy",
);

const executableBaseline = stripSqlComments(baseline);
check(
  /values\s*\(\s*'natori-inquiry-refs'\s*,\s*'natori-inquiry-refs'\s*,\s*false\s*,\s*10485760\s*,\s*array\s*\[\s*'image\/jpeg'\s*,\s*'image\/png'\s*,\s*'image\/webp'\s*,\s*'image\/gif'\s*\]::text\[\]\s*\)/i.test(
    executableBaseline,
  ),
  "natori-inquiry-refs must remain private with the approved 10 MiB image contract",
);
check(
  /values\s*\(\s*'natori-deliveries'\s*,\s*'natori-deliveries'\s*,\s*false\s*,\s*null\s*,\s*null\s*\)/i.test(
    executableBaseline,
  ),
  "natori-deliveries must remain private without inferred bucket limits",
);
check(
  /values\s*\(\s*'natori-portfolio'\s*,\s*'natori-portfolio'\s*,\s*true\s*,\s*null\s*,\s*null\s*\)/i.test(
    executableBaseline,
  ),
  "natori-portfolio must preserve public reads and server-managed writes",
);

const executableHardening = stripSqlComments(hardening);
const processedStripeGrants = [
  ...executableHardening.matchAll(
    /grant\s+([^;]+?)\s+on\s+table\s+public\.processed_stripe_events\s+to\s+([^;]+);/gi,
  ),
];
check(
  processedStripeGrants.length === 1,
  "hardening must declare exactly one processed_stripe_events grant",
);
for (const grant of processedStripeGrants) {
  const privileges = grant[1]
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .sort();
  check(
    JSON.stringify(privileges) ===
      JSON.stringify(["delete", "insert", "select"]),
    "processed_stripe_events service_role privileges must be SELECT, INSERT, DELETE only",
  );
  check(
    grant[2].trim().toLowerCase() === "service_role",
    "processed_stripe_events must not grant privileges to a client role",
  );
}
check(
  /revoke\s+all\s+privileges\s+on\s+table\s+public\.processed_stripe_events[\s\S]*from\s+public,\s*anon,\s*authenticated/i.test(
    executableHardening,
  ),
  "hardening must revoke processed_stripe_events client grants",
);
check(
  /grant\s+select,\s*insert,\s*delete\s+on\s+table\s+public\.processed_stripe_events[\s\S]*to\s+service_role/i.test(
    executableHardening,
  ),
  "hardening must grant only required processed_stripe_events operations",
);

const softDeleteDefinition = executableHardening.match(
  /create\s+or\s+replace\s+function\s+public\.natori_delete_project[\s\S]*?\$\$;/i,
)?.[0];
const softDeleteFunction = softDeleteDefinition?.match(
  /create\s+or\s+replace\s+function\s+public\.natori_delete_project[\s\S]*?as\s+\$\$([\s\S]*?)\$\$;/i,
)?.[1];
check(Boolean(softDeleteFunction), "hardening soft-delete function is missing");
check(
  softDeleteFunction && !/\bdelete\s+from\b/i.test(softDeleteFunction),
  "hardening natori_delete_project must not physically delete",
);
check(
  softDeleteFunction && /deleted_at\s*=\s*coalesce\(deleted_at,\s*now\(\)\)/i.test(softDeleteFunction),
  "hardening natori_delete_project must be idempotent soft delete",
);
check(
  softDeleteFunction &&
    /where\s+id\s*=\s*p_project_id\s+and\s+user_id\s*=\s*p_user_id/i.test(
      softDeleteFunction,
    ),
  "hardening natori_delete_project must enforce project ownership",
);
check(
  softDeleteDefinition &&
    /\bsecurity\s+definer\b/i.test(softDeleteDefinition) &&
    /\bset\s+search_path\s*=\s*pg_catalog\s*,\s*public\b/i.test(
      softDeleteDefinition,
    ),
  "hardening natori_delete_project must be SECURITY DEFINER with a fixed search_path",
);
check(
  /revoke\s+all\s+on\s+function\s+public\.natori_delete_project\(uuid,\s*uuid\)\s+from\s+public,\s*anon,\s*authenticated/i.test(
    executableHardening,
  ) &&
    /grant\s+execute\s+on\s+function\s+public\.natori_delete_project\(uuid,\s*uuid\)\s+to\s+service_role/i.test(
      executableHardening,
    ),
  "hardening natori_delete_project EXECUTE must be service_role-only",
);
check(
  /alter\s+table\s+public\.card_requests\s+enable\s+row\s+level\s+security/i.test(
    hardening,
  ),
  "card_requests RLS guard is missing",
);
check(
  /alter\s+table\s+public\.aura_projects\s+enable\s+row\s+level\s+security/i.test(
    hardening,
  ),
  "aura_projects RLS guard is missing",
);
const phase1Sql = `${phase1Expand}\n${phase1Constraints}`;
check(
  !/\b(?:insert\s+into|update\s+public\.|delete\s+from)\b/i.test(phase1Sql),
  "P1-03 migrations must not mutate existing rows",
);
check(
  !/create\s+policy[\s\S]*?(?:using|with\s+check)\s*\(\s*true\s*\)/i.test(
    phase1Sql,
  ),
  "P1-03 migrations must not create broad true policies",
);
check(
  !phase1Sql.includes(manifest.sourceProjectRef) &&
    !phase1Verification.includes(manifest.sourceProjectRef),
  "P1-03 artifacts must not embed the production project ref",
);
check(
  executableStatements(phase1Verification).every((statement) =>
    /^select\b/i.test(statement),
  ),
  "P1-03 verification SQL must contain SELECT statements only",
);
check(
  executableStatements(phase1SecurityVerification).every((statement) =>
    /^select\b/i.test(statement),
  ),
  "P1-04 security verification SQL must contain SELECT statements only",
);
check(
  fixture.includes("fixture_confirmation_required") &&
    fixture.includes("production_fixture_target_blocked"),
  "fixture production guards are missing",
);
check(
  fixture.includes("@example.invalid"),
  "fixture must use reserved non-deliverable email addresses",
);
check(
  manifest.baselineMigration === baselineName &&
    manifest.securityHardeningMigration === hardeningName,
  "manifest migration filenames do not match",
);
check(
  JSON.stringify(manifest.requiredSequence) ===
    JSON.stringify(expectedActiveNames),
  "manifest required sequence is invalid",
);
check(
  manifest.excludedObjects?.includes("public.portfolio_profiles"),
  "manifest must exclude public.portfolio_profiles",
);
const localLegacy = legacyManifest.migrations.filter(
  (entry) => entry.filename !== null,
);
const remoteOnly = legacyManifest.migrations.filter(
  (entry) => entry.status === "remote-only",
);
check(localLegacy.length === 55, "legacy manifest must contain 55 local files");
check(remoteOnly.length === 3, "legacy manifest must contain 3 remote-only rows");
check(
  legacyManifest.localLegacyFileCount === 55 &&
    legacyManifest.remoteOnlyCount === 3,
  "legacy manifest count fields are invalid",
);
check(
  legacyManifest.activeMigrationDirectory === "supabase/migrations" &&
    legacyManifest.legacyMigrationDirectory === "supabase/legacy-migrations",
  "legacy manifest directory fields are invalid",
);
check(
  JSON.stringify(archived) ===
    JSON.stringify(localLegacy.map((entry) => entry.filename).sort()),
  "legacy directory and manifest filenames must match exactly",
);

for (const entry of localLegacy) {
  const expectedOldPath = `supabase/migrations/${entry.filename}`;
  const expectedArchivedPath =
    `supabase/legacy-migrations/${entry.filename}`;
  check(
    entry.oldPath === expectedOldPath,
    `legacy oldPath mismatch: ${entry.filename}`,
  );
  check(
    entry.archivedPath === expectedArchivedPath,
    `legacy archivedPath mismatch: ${entry.filename}`,
  );
  check(
    !(await exists(entry.oldPath)),
    `legacy file remains active: ${entry.filename}`,
  );
  const content = await readFile(entry.archivedPath);
  const checksum = createHash("sha256").update(content).digest("hex");
  check(
    checksum === entry.sha256,
    `legacy checksum mismatch: ${entry.filename}`,
  );
  check(
    content.byteLength === entry.sizeBytes,
    `legacy size mismatch: ${entry.filename}`,
  );
  check(
    entry.version === entry.filename.split("_", 1)[0],
    `legacy version mismatch: ${entry.filename}`,
  );
  check(
    entry.replay === "evidence-only" || entry.replay === "unsupported",
    `legacy replay classification is invalid: ${entry.filename}`,
  );
}

for (const entry of remoteOnly) {
  check(
    entry.filename === null &&
      entry.oldPath === null &&
      entry.archivedPath === null &&
      entry.sizeBytes === null,
    `remote-only entry must not identify a migration file: ${entry.version}`,
  );
  check(
    /^[a-f0-9]{64}$/.test(entry.sha256),
    `remote-only evidence checksum is invalid: ${entry.version}`,
  );
  check(
    !activeVersions.includes(entry.version),
    `remote-only history was synthesized as an active migration: ${entry.version}`,
  );
}

const verificationText = await readFile(
  manifest.archiveVerification.verificationArtifact,
  "utf8",
);
const verification = JSON.parse(verificationText);
const directEvidence = await readMigrationEvidence({
  root: ".",
  beforePath: manifest.archiveVerification.beforeArtifact,
  afterPath: manifest.archiveVerification.afterArtifact,
  ledgerPath: legacyManifestPath,
});
for (const failure of directEvidence.verification.failures) {
  check(false, `archive evidence: ${failure}`);
}
for (const failure of directEvidence.git.failures) {
  check(false, `archive Git evidence: ${failure}`);
}
check(
  directEvidence.git.matchedCount === ETORIE_EVIDENCE_EXPECTED_COUNT,
  "archive Git blob comparison must match 55/55",
);
for (const label of ["before", "after", "ledger"]) {
  const direct = directEvidence.verification;
  check(
    direct.counts[label] === ETORIE_EVIDENCE_EXPECTED_COUNT,
    `${label} evidence must contain 55 entries`,
  );
  for (const field of [
    "filename",
    "path",
    "version",
    "sizeBytes",
    "sha256",
  ]) {
    check(
      direct.matches[label][field] === ETORIE_EVIDENCE_EXPECTED_COUNT,
      `${label} ${field} comparison must match 55/55`,
    );
  }
}
check(
  manifest.archiveVerification.status === "verified" &&
    manifest.archiveVerification.expectedCount === 55 &&
    manifest.archiveVerification.actualCount === 55 &&
    manifest.archiveVerification.allChecksumsMatch === true,
  "manifest archive verification status is invalid",
);
check(
  verification.expectedCount === 55 &&
    verification.actualCount === 55 &&
    verification.beforeCount === 55 &&
    verification.afterCount === 55 &&
    verification.ledgerCount === 55 &&
    verification.gitBlobCount === 55 &&
    verification.allChecksumsMatch === true &&
    verification.allSizesMatch === true &&
    verification.allPathsMatch === true &&
    verification.allVersionsMatch === true &&
    verification.allFilenamesMatch === true &&
    verification.gitBlobsMatch === true &&
    verification.missingFiles.length === 0 &&
    verification.unexpectedFiles.length === 0 &&
    verification.duplicateEntries.length === 0 &&
    verification.contentChanges.length === 0,
  "archive verification artifact reports a mismatch",
);

for (const [key, expected] of Object.entries(manifest.checksums)) {
  if (!key.startsWith("sha256:")) continue;
  const target = key.slice("sha256:".length);
  const content = await readFile(target);
  const checksum = createHash("sha256").update(content).digest("hex");
  check(checksum === expected, `manifest checksum mismatch: ${target}`);
}

const secretPattern =
  /\b(?:sk_live_[A-Za-z0-9]+|sb_secret_[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/;
for (const [label, content] of [
  [baselineName, baseline],
  [hardeningName, hardening],
  [phase1ExpandName, phase1Expand],
  [phase1ConstraintsName, phase1Constraints],
  ["etorie-p1-03-selects.sql", phase1Verification],
  ["etorie-p1-04-security-selects.sql", phase1SecurityVerification],
  ["etorie-baseline.sql", fixture],
  ["manifest.json", manifestText],
  ["legacy-migrations.json", legacyText],
  ["legacy-migrations/README.md", legacyReadme],
  ["verification.json", verificationText],
]) {
  check(!secretPattern.test(content), `${label}: possible secret value detected`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

const baselinePairDigest = createHash("sha256")
  .update(`${baseline}\n${hardening}`, "utf8")
  .digest("hex");
const activeLaneDigest = createHash("sha256")
  .update(
    `${baseline}\n${hardening}\n${phase1Expand}\n${phase1Constraints}`,
    "utf8",
  )
  .digest("hex");
console.log(`PASS: ${failures.length} failures`);
console.log(`Active migrations: ${active.length}`);
console.log(`Archived legacy migrations: ${archived.length}`);
console.log(`Frozen baseline pair SHA-256: ${baselinePairDigest}`);
console.log(`Current active lane SHA-256: ${activeLaneDigest}`);

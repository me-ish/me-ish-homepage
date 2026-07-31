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
const remainingPrivilegesName =
  "20260731111025_harden_natori_remaining_privileges.sql";
const intakeRpcsName =
  "20260731115652_etorie_intake_rpcs.sql";
const frozenPreIntakeMigrationChecksums = {
  [baselineName]:
    "cbe412613b6eadbe284499ea6f749afab6869bc9f6d40be17db9ac1f23d18ca4",
  [hardeningName]:
    "dc13f7299b14db7f46c157864e1ed8707c1b0c23c3e918fe7e1f3b5506582be1",
  [phase1ExpandName]:
    "b7e1ca1b96740376b7fad58f4ac490381c21275ae69d761d1cd68f95fe167a63",
  [phase1ConstraintsName]:
    "e9d8d678f379a60a8899f9a19ec617f265d23909cc758ef034a4087cf3e19a2f",
  [remainingPrivilegesName]:
    "ba775794f3f15d67e555df9c17624d4df6a84eee1df0a11a8131ce3f8971043c",
};
const activeDirectory = path.join("supabase", "migrations");
const legacyDirectory = path.join("supabase", "legacy-migrations");
const baselinePath = path.join(activeDirectory, baselineName);
const hardeningPath = path.join(activeDirectory, hardeningName);
const phase1ExpandPath = path.join(activeDirectory, phase1ExpandName);
const phase1ConstraintsPath = path.join(
  activeDirectory,
  phase1ConstraintsName,
);
const remainingPrivilegesPath = path.join(
  activeDirectory,
  remainingPrivilegesName,
);
const intakeRpcsPath = path.join(activeDirectory, intakeRpcsName);
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
const intakeRpcsVerificationPath = path.join(
  "supabase",
  "verification",
  "etorie-p1-05-intake-rpcs-selects.sql",
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
  remainingPrivileges,
  intakeRpcs,
  phase1Verification,
  phase1SecurityVerification,
  intakeRpcsVerification,
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
    readFile(remainingPrivilegesPath, "utf8"),
    readFile(intakeRpcsPath, "utf8"),
    readFile(phase1VerificationPath, "utf8"),
    readFile(phase1SecurityVerificationPath, "utf8"),
    readFile(intakeRpcsVerificationPath, "utf8"),
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

function stripDollarQuotedBodies(sql) {
  return sql.replace(
    /as\s+\$([A-Za-z_][A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/gi,
    "as omitted_body",
  );
}

function functionDefinition(sql, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.match(
    new RegExp(
      `create\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\$function\\$;`,
      "i",
    ),
  )?.[0];
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
  remainingPrivilegesName,
  intakeRpcsName,
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
  "active migrations must be the ordered baseline, hardening, expand, constraint, ACL, and intake RPC lane",
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
  "manifest must declare the six current active migration paths",
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
checkDollarQuotes(remainingPrivileges, "P1-04 remaining privileges");
checkDollarQuotes(intakeRpcs, "P1-05 intake RPCs");
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
  /^\s*--[\s\S]*?\bbegin;\s/i.test(remainingPrivileges) &&
    /\bcommit;\s*$/i.test(remainingPrivileges),
  "P1-04 remaining privilege hardening must be transaction wrapped",
);
check(
  /^\s*--[\s\S]*?\bbegin;\s/i.test(intakeRpcs) &&
    /\bcommit;\s*$/i.test(intakeRpcs),
  "P1-05 intake RPC migration must be transaction wrapped",
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
  remainingPrivileges,
  intakeRpcs,
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

const executableRemainingPrivileges = stripSqlComments(remainingPrivileges);
const remainingPrivilegeStatements = executableStatements(
  remainingPrivileges,
);
check(
  remainingPrivilegeStatements.length === 4 &&
    /^begin$/i.test(remainingPrivilegeStatements[0]) &&
    /^revoke\b/i.test(remainingPrivilegeStatements[1]) &&
    /^grant\b/i.test(remainingPrivilegeStatements[2]) &&
    /^commit$/i.test(remainingPrivilegeStatements[3]),
  "P1-04 remaining privilege hardening must contain only BEGIN, REVOKE, GRANT, COMMIT",
);
check(
  /revoke\s+all\s+privileges\s+on\s+table\s+public\.processed_stripe_events\s+from\s+public,\s*anon,\s*authenticated,\s*service_role\s*;/i.test(
    executableRemainingPrivileges,
  ),
  "P1-04 must revoke all processed_stripe_events privileges from client roles and service_role",
);
const finalProcessedStripeGrants = [
  ...executableRemainingPrivileges.matchAll(
    /grant\s+([^;]+?)\s+on\s+table\s+public\.processed_stripe_events\s+to\s+([^;]+);/gi,
  ),
];
check(
  finalProcessedStripeGrants.length === 1,
  "P1-04 must declare exactly one final processed_stripe_events grant",
);
for (const grant of finalProcessedStripeGrants) {
  const privileges = grant[1]
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .sort();
  check(
    JSON.stringify(privileges) ===
      JSON.stringify(["delete", "insert", "select"]),
    "P1-04 service_role privileges must be SELECT, INSERT, DELETE only",
  );
  check(
    grant[2].trim().toLowerCase() === "service_role",
    "P1-04 must grant processed_stripe_events only to service_role",
  );
}
check(
  !/\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+policy|drop\s+policy)\b/i.test(
    executableRemainingPrivileges,
  ),
  "P1-04 remaining privilege hardening must not change data, RLS, or policies",
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
  executableStatements(intakeRpcsVerification).every((statement) =>
    /^select\b/i.test(statement),
  ),
  "P1-05 intake RPC verification SQL must contain SELECT statements only",
);

const executableIntakeRpcs = stripSqlComments(intakeRpcs);
const intakeMigrationTopLevel = stripDollarQuotedBodies(executableIntakeRpcs);
const createIntakeDefinition = functionDefinition(
  intakeRpcs,
  "natori_create_project_with_tasks_v2",
);
const confirmTypeDefinition = functionDefinition(
  intakeRpcs,
  "natori_confirm_project_type_v1",
);
const requestDataValidationDefinition = functionDefinition(
  intakeRpcs,
  "natori_request_data_is_valid_v1",
);
check(
  !/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\s+table)\b/i.test(
    intakeMigrationTopLevel,
  ),
  "P1-05 migration must not mutate rows while the migration itself is applied",
);
check(
  Boolean(createIntakeDefinition) && Boolean(confirmTypeDefinition),
  "P1-05 must define both versioned RPCs",
);
check(
  /create\s+function\s+public\.natori_create_project_with_tasks_v2\s*\(\s*p_user_id\s+uuid,\s*p_project_id\s+uuid,\s*p_client_name\s+text,\s*p_client_email\s+text,\s*p_request_data\s+jsonb,\s*p_reference_files\s+jsonb,\s*p_reference_links\s+jsonb\s*\)/i.test(
    executableIntakeRpcs,
  ),
  "P1-05 create-v2 identity arguments are invalid",
);
check(
  /create\s+function\s+public\.natori_confirm_project_type_v1\s*\(\s*p_user_id\s+uuid,\s*p_project_id\s+uuid,\s*p_type\s+text\s*\)/i.test(
    executableIntakeRpcs,
  ),
  "P1-05 type-confirm identity arguments are invalid",
);
for (const [label, definition] of [
  ["create-v2", createIntakeDefinition],
  ["type-confirm", confirmTypeDefinition],
]) {
  check(
    definition &&
      /\bsecurity\s+definer\b/i.test(definition) &&
      /\bset\s+search_path\s*=\s*''/i.test(definition),
    `P1-05 ${label} must be SECURITY DEFINER with an empty search_path`,
  );
}
check(
  /revoke\s+all\s+on\s+function\s+public\.natori_create_project_with_tasks_v2\s*\(\s*uuid,\s*uuid,\s*text,\s*text,\s*jsonb,\s*jsonb,\s*jsonb\s*\)\s*from\s+public,\s*anon,\s*authenticated,\s*service_role/i.test(
    executableIntakeRpcs,
  ) &&
    /grant\s+execute\s+on\s+function\s+public\.natori_create_project_with_tasks_v2[\s\S]*?to\s+service_role/i.test(
      executableIntakeRpcs,
    ) &&
    /revoke\s+all\s+on\s+function\s+public\.natori_confirm_project_type_v1\s*\(\s*uuid,\s*uuid,\s*text\s*\)\s*from\s+public,\s*anon,\s*authenticated,\s*service_role/i.test(
      executableIntakeRpcs,
    ) &&
    /grant\s+execute\s+on\s+function\s+public\.natori_confirm_project_type_v1[\s\S]*?to\s+service_role/i.test(
      executableIntakeRpcs,
    ),
  "P1-05 RPC EXECUTE privileges must be service_role-only",
);
check(
  !/(?:create(?:\s+or\s+replace)?|drop)\s+function\s+public\.natori_create_project_with_tasks\s*\(/i.test(
    executableIntakeRpcs,
  ),
  "P1-05 must not redefine or drop the rollback-compatible create RPC",
);
check(
  !/(?:create(?:\s+or\s+replace)?|drop)\s+function\s+public\.natori_issue_quote\s*\(/i.test(
    executableIntakeRpcs,
  ) && !/insert\s+into\s+public\.natori_quotes\b/i.test(executableIntakeRpcs),
  "P1-05 intake must not implement formal quote issuance; P1-09 owns that contract",
);
check(
  createIntakeDefinition &&
    /from\s+auth\.users/i.test(createIntakeDefinition) &&
    /insert\s+into\s+public\.natori_projects/i.test(createIntakeDefinition) &&
    /insert\s+into\s+public\.natori_projects\s*\(\s*id,\s*user_id,\s*title,\s*client_name,\s*client_email,\s*amount,\s*type,\s*status,\s*delivery_plan,\s*priority,\s*start_date,\s*due_date,[\s\S]*?\)\s*values\s*\(\s*p_project_id,\s*p_user_id,\s*v_title,\s*p_client_name,\s*p_client_email,\s*null,\s*'undecided',\s*'inquiry',\s*'normal',\s*null,\s*null,\s*null,/i.test(
      createIntakeDefinition,
    ) &&
    /insert\s+into\s+public\.natori_inquiry_reference_files/i.test(
      createIntakeDefinition,
    ) &&
    /insert\s+into\s+public\.natori_project_reference_links/i.test(
      createIntakeDefinition,
    ) &&
    !/insert\s+into\s+public\.natori_project_tasks/i.test(
      createIntakeDefinition,
    ),
  "P1-05 create-v2 must atomically create the project/file/link envelope and zero tasks",
);
check(
  createIntakeDefinition &&
    /on\s+conflict\s*\(\s*id\s*\)\s+do\s+nothing/i.test(
      createIntakeDefinition,
    ) &&
    /submission_conflict/i.test(createIntakeDefinition) &&
    /projects\.request_data\s*=\s*p_request_data/i.test(
      createIntakeDefinition,
    ) &&
    /reference_files\.project_id\s*<>\s*p_project_id/i.test(
      createIntakeDefinition,
    ) &&
    /jsonb_array_length\(p_reference_files\)/i.test(
      createIntakeDefinition,
    ) &&
    /jsonb_array_length\(p_reference_links\)/i.test(createIntakeDefinition),
  "P1-05 create-v2 must accept only an exact idempotent submission retry",
);
check(
  createIntakeDefinition &&
    /jsonb_array_length\(p_reference_files\)\s*>\s*5/i.test(
      createIntakeDefinition,
    ) &&
    /jsonb_array_length\(p_reference_links\)\s*>\s*5/i.test(
      createIntakeDefinition,
    ) &&
    /storage\.objects/i.test(createIntakeDefinition) &&
    /natori-inquiry-refs/i.test(createIntakeDefinition) &&
    /https:\/\//i.test(createIntakeDefinition) &&
    /position\(\s*'@'\s+in\s+substring/i.test(createIntakeDefinition) &&
    /duplicate_reference_link/i.test(createIntakeDefinition),
  "P1-05 create-v2 file/link bounds are incomplete",
);
check(
  createIntakeDefinition &&
    requestDataValidationDefinition &&
    /natori_request_data_is_valid_v1/i.test(createIntakeDefinition) &&
    /65536/i.test(executableIntakeRpcs) &&
    /v_request_type\s+not\s+in\s*\(\s*'undecided',\s*'icon',\s*'sd',\s*'standing',\s*'illustration',\s*'other'\s*\)/i.test(
      requestDataValidationDefinition,
    ) &&
    /v_scope\s+not\s+in\s*\(\s*'undecided',\s*'bust_up',\s*'waist_up',\s*'full_body',\s*'other'\s*\)/i.test(
      requestDataValidationDefinition,
    ) &&
    !/(?:inquiryMode|v_mode)[\s\S]*?quote[\s\S]*?(?:v_request_type|v_scope)\s*=\s*'undecided'/i.test(
      requestDataValidationDefinition,
    ) &&
    /jsonb_array_length\(p_request_data\s*->\s*'options'\)\s*>\s*20/i.test(
      executableIntakeRpcs,
    ) &&
    /jsonb_array_length\(p_request_data\s*->\s*'usageTypes'\)\s*>\s*10/i.test(
      executableIntakeRpcs,
    ) &&
    /make_date/i.test(executableIntakeRpcs),
  "P1-05 RequestData V1 validation must allow undecided quote intake without weakening detailed validation",
);
check(
  confirmTypeDefinition &&
    /for\s+update/i.test(confirmTypeDefinition) &&
    /projects\.user_id\s*=\s*p_user_id/i.test(confirmTypeDefinition) &&
    /projects\.deleted_at\s+is\s+null/i.test(confirmTypeDefinition) &&
    /payment_confirmed_at\s+is\s+not\s+null/i.test(confirmTypeDefinition) &&
    /v_task_count\s*<>\s*0/i.test(confirmTypeDefinition) &&
    /natori_project_task_template_v1/i.test(confirmTypeDefinition) &&
    /template\.done\s+is\s+not\s+distinct\s+from\s+tasks\.done/i.test(
      confirmTypeDefinition,
    ) &&
    !/\bon\s+conflict\b/i.test(confirmTypeDefinition),
  "P1-05 type-confirm concurrency or conflict guard is incomplete",
);
check(
  createIntakeDefinition &&
    confirmTypeDefinition &&
    !/\bdelete\s+from\b/i.test(createIntakeDefinition) &&
    !/\bdelete\s+from\b/i.test(confirmTypeDefinition),
  "P1-05 RPCs must not physically delete rows",
);
check(
  intakeRpcsVerification.includes(
    "unauthorized_intake_rpc_execute_count",
  ) &&
    /acl\.grantee\s*<>\s*p\.proowner/i.test(intakeRpcsVerification) &&
    /coalesce\(pg_get_userbyid\(acl\.grantee\),\s*'PUBLIC'\)\s*<>\s*'service_role'/i.test(
      intakeRpcsVerification,
    ) &&
    !/['"]postgres['"]/i.test(intakeRpcsVerification) &&
    intakeRpcsVerification.includes("function_body_sha256") &&
    intakeRpcsVerification.includes("empty_search_path_exact") &&
    intakeRpcsVerification.includes("supabase_migrations.schema_migrations"),
  "P1-05 verification must check dynamic owners, ACLs, old-RPC hash, and active history",
);
check(
  !intakeRpcs.includes(manifest.sourceProjectRef) &&
    !intakeRpcsVerification.includes(manifest.sourceProjectRef),
  "P1-05 artifacts must not embed the production project ref",
);
const securityVerificationStatements = executableStatements(
  phase1SecurityVerification,
);
const exactProcessedStripePrivileges = securityVerificationStatements.find(
  (statement) =>
    statement.includes("processed_stripe_events_privileges_exact"),
);
check(
  exactProcessedStripePrivileges !== undefined &&
    /\bbool_and\s*\(/i.test(exactProcessedStripePrivileges) &&
    /\bhas_table_privilege\s*\(/i.test(exactProcessedStripePrivileges) &&
    /values\s*\(\s*'service_role'\s*\),\s*\(\s*'anon'\s*\),\s*\(\s*'authenticated'\s*\)/i.test(
      exactProcessedStripePrivileges,
    ) &&
    [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ].every((privilege) =>
      exactProcessedStripePrivileges.includes(`'${privilege}'`),
    ) &&
    /roles\.role_name\s*=\s*'service_role'[\s\S]*privileges\.privilege_name\s+in\s*\(\s*'SELECT'\s*,\s*'INSERT'\s*,\s*'DELETE'\s*\)/i.test(
      exactProcessedStripePrivileges,
    ) &&
    /not\s+exists[\s\S]*acl\.grantee\s*=\s*0/i.test(
      exactProcessedStripePrivileges,
    ) &&
    !/role_table_grants/i.test(exactProcessedStripePrivileges),
  "P1-04 verification must compare all effective processed_stripe_events privileges and reject PUBLIC grants",
);
const unauthorizedDeleteProjectExecute = securityVerificationStatements.find(
  (statement) =>
    statement.includes("unauthorized_delete_project_execute_count"),
);
check(
  unauthorizedDeleteProjectExecute !== undefined &&
    /acl\.grantee\s*<>\s*p\.proowner/i.test(
      unauthorizedDeleteProjectExecute,
    ) &&
    /coalesce\(pg_get_userbyid\(acl\.grantee\),\s*'PUBLIC'\)\s*<>\s*'service_role'/i.test(
      unauthorizedDeleteProjectExecute,
    ) &&
    !/['"]postgres['"]/i.test(unauthorizedDeleteProjectExecute),
  "P1-04 verification must allow the dynamic function owner and service_role only",
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
    manifest.securityHardeningMigration === hardeningName &&
    manifest.remainingPrivilegesMigration === remainingPrivilegesName &&
    manifest.intakeRpcsMigration === intakeRpcsName,
  "manifest migration filenames do not match",
);
check(
  JSON.stringify(manifest.requiredSequence) ===
    JSON.stringify(expectedActiveNames),
  "manifest required sequence is invalid",
);
for (const [name, checksum] of Object.entries(
  frozenPreIntakeMigrationChecksums,
)) {
  check(
    manifest.checksums[`sha256:supabase/migrations/${name}`] === checksum,
    `pre-P1-05 migration checksum must remain frozen: ${name}`,
  );
}
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

const expectedChecksummedPaths = [
  ...expectedActivePaths,
  "supabase/verification/etorie-p1-03-selects.sql",
  "supabase/verification/etorie-p1-04-security-selects.sql",
  "supabase/verification/etorie-p1-05-intake-rpcs-selects.sql",
  "supabase/fixtures/etorie-baseline.sql",
  "supabase/baseline/legacy-migrations.json",
  "artifacts/legacy-migration-archive/before.json",
  "artifacts/legacy-migration-archive/after.json",
  "artifacts/legacy-migration-archive/verification.json",
].sort();
const declaredChecksummedPaths = Object.keys(manifest.checksums)
  .filter((key) => key.startsWith("sha256:"))
  .map((key) => key.slice("sha256:".length))
  .sort();
check(
  JSON.stringify(declaredChecksummedPaths) ===
    JSON.stringify(expectedChecksummedPaths),
  "manifest must checksum every active migration and verification artifact exactly once",
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
  [remainingPrivilegesName, remainingPrivileges],
  [intakeRpcsName, intakeRpcs],
  ["etorie-p1-03-selects.sql", phase1Verification],
  ["etorie-p1-04-security-selects.sql", phase1SecurityVerification],
  ["etorie-p1-05-intake-rpcs-selects.sql", intakeRpcsVerification],
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
  .update(activeSql, "utf8")
  .digest("hex");
console.log(`PASS: ${failures.length} failures`);
console.log(`Active migrations: ${active.length}`);
console.log(`Archived legacy migrations: ${archived.length}`);
console.log(`Frozen baseline pair SHA-256: ${baselinePairDigest}`);
console.log(`Current active lane SHA-256: ${activeLaneDigest}`);

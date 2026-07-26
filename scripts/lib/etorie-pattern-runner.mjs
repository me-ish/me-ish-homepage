import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import { assertSafeTarget } from "./etorie-schema-artifacts.mjs";

export function utcStamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

export async function createRunContext(pattern, args) {
  const projectRef =
    args["project-ref"] || process.env.ETORIE_TARGET_PROJECT_REF;
  const databaseUrlEnv = args["db-url-env"] || "ETORIE_DATABASE_URL";
  const databaseUrl = process.env[databaseUrlEnv];
  const execute = Boolean(args.execute);

  if (!databaseUrl && execute) {
    throw new Error(`Missing database URL environment variable: ${databaseUrlEnv}`);
  }
  assertSafeTarget({ projectRef, databaseUrl, execute });

  const runDir =
    args["output-dir"] ||
    path.join("artifacts", `pattern-${pattern.toLowerCase()}`, utcStamp());
  await mkdir(runDir, { recursive: true });
  const logPath = path.join(runDir, "run.log");

  return {
    pattern,
    projectRef,
    databaseUrlEnv,
    databaseUrl,
    execute,
    runDir,
    logPath,
  };
}

export async function log(context, message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  await appendFile(context.logPath, `${line}\n`, "utf8");
}

function assertLayout(condition, message) {
  if (!condition) throw new Error(`migration_layout_invalid: ${message}`);
}

function migrationVersion(filename) {
  return filename.split("_", 1)[0];
}

export async function inspectMigrationLayout() {
  const manifestPath = path.join("supabase", "baseline", "manifest.json");
  const legacyManifestPath = path.join(
    "supabase",
    "baseline",
    "legacy-migrations.json",
  );
  const [manifestText, legacyManifestText] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(legacyManifestPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const legacyManifest = JSON.parse(legacyManifestText);
  const activeDirectory = manifest.activeMigrationDirectory;
  const legacyDirectory = manifest.legacyMigrationDirectory;

  assertLayout(
    activeDirectory === "supabase/migrations",
    "active migration directory must be supabase/migrations",
  );
  assertLayout(
    legacyDirectory === "supabase/legacy-migrations",
    "legacy migration directory must be supabase/legacy-migrations",
  );

  const [activeEntries, legacyEntries] = await Promise.all([
    readdir(activeDirectory),
    readdir(legacyDirectory),
  ]);
  const activeFiles = activeEntries
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  const legacyFiles = legacyEntries
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
  const activePaths = activeFiles.map((entry) =>
    path.posix.join(activeDirectory, entry),
  );
  const manifestActivePaths = [...(manifest.activeMigrations ?? [])];
  const activeVersions = activeFiles.map(migrationVersion);
  const duplicateVersions = activeVersions.filter(
    (version, index) => activeVersions.indexOf(version) !== index,
  );
  const expectedLegacyFiles = legacyManifest.migrations
    .filter((entry) => entry.filename !== null)
    .map((entry) => entry.filename)
    .sort();

  assertLayout(
    activeFiles.every((entry) => /^\d{14}_[a-z0-9_]+\.sql$/.test(entry)),
    "active migration filename does not use the 14-digit CLI format",
  );
  assertLayout(
    duplicateVersions.length === 0,
    `duplicate active migration versions: ${[...new Set(duplicateVersions)].join(", ")}`,
  );
  assertLayout(
    JSON.stringify(activePaths) === JSON.stringify(manifestActivePaths),
    "active directory does not match manifest activeMigrations",
  );
  assertLayout(
    manifest.activeMigrationCount === activeFiles.length,
    "active migration count does not match manifest",
  );
  assertLayout(
    manifest.legacyMigrationCount === legacyFiles.length,
    "legacy migration count does not match manifest",
  );
  assertLayout(
    JSON.stringify(legacyFiles) === JSON.stringify(expectedLegacyFiles),
    "legacy migration directory does not match legacy manifest",
  );
  assertLayout(
    activeFiles[0] === manifest.baselineMigration,
    "baseline must be the first active migration",
  );
  assertLayout(
    activeFiles[1] === manifest.securityHardeningMigration,
    "security hardening must immediately follow baseline",
  );
  assertLayout(
    JSON.stringify(manifest.requiredSequence) ===
      JSON.stringify([
        manifest.baselineMigration,
        manifest.securityHardeningMigration,
      ]),
    "required migration sequence is invalid",
  );
  assertLayout(
    activeFiles.every((entry) => !expectedLegacyFiles.includes(entry)),
    "legacy migration is present in the active directory",
  );

  const legacyManifestChecksum = createHash("sha256")
    .update(Buffer.from(legacyManifestText))
    .digest("hex");
  assertLayout(
    manifest.checksums[`sha256:${legacyManifestPath.replaceAll("\\", "/")}`] ===
      legacyManifestChecksum,
    "legacy manifest checksum does not match manifest",
  );
  for (const activePath of activePaths) {
    const content = await readFile(activePath);
    const checksum = createHash("sha256").update(content).digest("hex");
    assertLayout(
      manifest.checksums[`sha256:${activePath}`] === checksum,
      `active migration checksum mismatch: ${activePath}`,
    );
  }

  return {
    activeDirectory,
    legacyDirectory,
    activeFiles,
    activePaths,
    activeCount: activeFiles.length,
    legacyCount: legacyFiles.length,
    duplicateVersions: [],
    baseline: manifest.baselineMigration,
    hardening: manifest.securityHardeningMigration,
  };
}

export async function runCommand(
  context,
  label,
  command,
  commandArgs,
  options = {},
) {
  await log(context, `${label}: target=${context.projectRef}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    env: options.env || process.env,
    windowsHide: true,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("");
  if (output) {
    await appendFile(context.logPath, output, "utf8");
  }
  if (result.error) {
    throw new Error(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return result.stdout;
}

export async function applySql(context, label, sqlPath, variables = {}) {
  if (!context.execute) {
    await log(context, `[dry-run] ${label}: ${sqlPath}`);
    return;
  }
  const variableArgs = Object.entries(variables).flatMap(([key, value]) => [
    `--set=${key}=${value}`,
  ]);
  await runCommand(
    context,
    label,
    "psql",
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      ...variableArgs,
      "--file",
      sqlPath,
    ],
    {
      env: { ...process.env, PGDATABASE: context.databaseUrl },
    },
  );
}

export async function applyActiveMigrations(context, migrationLayout) {
  const migrationPaths = migrationLayout.activePaths;
  for (const migrationPath of migrationPaths) {
    assertLayout(
      path.dirname(migrationPath).replaceAll("\\", "/") ===
        migrationLayout.activeDirectory,
      `refusing to copy a migration outside the active directory: ${migrationPath}`,
    );
  }
  const activeRoot = path.join(context.runDir, "active-migration-source");
  const activeSupabase = path.join(activeRoot, "supabase");
  const activeMigrations = path.join(activeSupabase, "migrations");
  await mkdir(activeMigrations, { recursive: true });
  await Promise.all(
    migrationPaths.map((migrationPath) =>
      copyFile(
        migrationPath,
        path.join(activeMigrations, path.basename(migrationPath)),
      ),
    ),
  );
  try {
    await copyFile(
      path.join("supabase", "config.toml"),
      path.join(activeSupabase, "config.toml"),
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (!context.execute) {
    await log(
      context,
      `[dry-run] Supabase CLI db push: ${migrationPaths.map((entry) => path.basename(entry)).join(" -> ")}`,
    );
    return;
  }

  const cli = process.env.SUPABASE_CLI_BIN || "supabase";
  const commonArgs = [
    "db",
    "push",
    "--db-url",
    context.databaseUrl,
    "--include-all",
    "--workdir",
    activeRoot,
    "--yes",
  ];
  await runCommand(
    context,
    "Supabase CLI migration dry-run",
    cli,
    [...commonArgs, "--dry-run"],
  );
  await runCommand(
    context,
    "Supabase CLI apply baseline and hardening",
    cli,
    commonArgs,
  );
}

export async function captureChecksum(context, label) {
  if (!context.execute) {
    await log(context, `[dry-run] ${label}: schema checksum`);
    return null;
  }
  const outputRoot = path.join(context.runDir, "schema-checksum");
  const stdout = await runCommand(
    context,
    label,
    process.execPath,
    [
      "scripts/etorie-schema-checksum.mjs",
      "--db-url-env",
      context.databaseUrlEnv,
      "--project-ref",
      context.projectRef,
      "--output-root",
      outputRoot,
    ],
  );
  const match = stdout.match(/^Schema snapshot:\s+(.+)$/m);
  if (!match) throw new Error("Checksum script did not report its output path.");
  return path.join(match[1].trim(), "normalized.json");
}

export async function compareSnapshots(
  context,
  label,
  left,
  right,
  outputName,
) {
  if (!context.execute) {
    await log(context, `[dry-run] ${label}: ${left || "<left>"} -> ${right || "<right>"}`);
    return;
  }
  await runCommand(
    context,
    label,
    process.execPath,
    [
      "scripts/etorie-schema-diff.mjs",
      "--left",
      left,
      "--right",
      right,
      "--output-dir",
      path.join(context.runDir, outputName),
    ],
  );
}

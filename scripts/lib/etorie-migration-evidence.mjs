import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const ETORIE_EVIDENCE_EXPECTED_COUNT = 55;
export const ETORIE_LEGACY_DIRECTORY = "supabase/legacy-migrations";

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function migrationVersion(filename) {
  return filename.split("_", 1)[0];
}

function toRepositoryPath(...parts) {
  return parts.join("/");
}

export async function collectCanonicalArchiveEntries({
  root = ".",
  legacyDirectory = ETORIE_LEGACY_DIRECTORY,
} = {}) {
  const directory = path.resolve(root, legacyDirectory);
  const filenames = (await readdir(directory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  return Promise.all(
    filenames.map(async (filename) => {
      const archivedPath = toRepositoryPath(legacyDirectory, filename);
      const bytes = await readFile(path.resolve(root, archivedPath));
      return {
        filename,
        oldPath: toRepositoryPath("supabase/migrations", filename),
        archivedPath,
        version: migrationVersion(filename),
        sha256: sha256Bytes(bytes),
        sizeBytes: bytes.byteLength,
      };
    }),
  );
}

function buildEntryMap(entries, label, failures, duplicateEntries) {
  const result = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.filename !== "string" || entry.filename === "") {
      failures.push(`${label}: entry has no filename`);
      continue;
    }
    if (result.has(entry.filename)) {
      failures.push(`${label}: duplicate entry: ${entry.filename}`);
      duplicateEntries.push(`${label}:${entry.filename}`);
      continue;
    }
    result.set(entry.filename, entry);
  }
  return result;
}

function compareField({
  actual,
  expected,
  field,
  label,
  failures,
  matches,
}) {
  if (expected[field] === actual[field]) {
    matches[label][field] += 1;
    return;
  }
  failures.push(
    `${label} ${field} mismatch: ${actual.filename}`,
  );
}

export function verifyMigrationEvidenceEntries({
  actualEntries,
  beforeEntries,
  afterEntries,
  ledgerEntries,
  expectedCount = ETORIE_EVIDENCE_EXPECTED_COUNT,
}) {
  const failures = [];
  const duplicateEntries = [];
  const missingEntries = {
    before: [],
    after: [],
    ledger: [],
  };
  const unexpectedEntries = {
    before: [],
    after: [],
    ledger: [],
  };
  const counts = {
    archive: actualEntries.length,
    before: beforeEntries.length,
    after: afterEntries.length,
    ledger: ledgerEntries.length,
  };
  const fields = [
    "filename",
    "version",
    "sizeBytes",
    "sha256",
  ];
  const matches = Object.fromEntries(
    ["before", "after", "ledger"].map((label) => [
      label,
      Object.fromEntries(
        [...fields, "path"].map((field) => [field, 0]),
      ),
    ]),
  );

  for (const [label, count] of Object.entries(counts)) {
    if (count !== expectedCount) {
      failures.push(
        `${label}: expected ${expectedCount} entries, found ${count}`,
      );
    }
  }

  const actualMap = buildEntryMap(
    actualEntries,
    "archive",
    failures,
    duplicateEntries,
  );
  const sourceMaps = {
    before: buildEntryMap(
      beforeEntries,
      "before",
      failures,
      duplicateEntries,
    ),
    after: buildEntryMap(
      afterEntries,
      "after",
      failures,
      duplicateEntries,
    ),
    ledger: buildEntryMap(
      ledgerEntries,
      "ledger",
      failures,
      duplicateEntries,
    ),
  };

  for (const [label, sourceMap] of Object.entries(sourceMaps)) {
    for (const filename of actualMap.keys()) {
      if (!sourceMap.has(filename)) {
        failures.push(`${label}: missing entry: ${filename}`);
        missingEntries[label].push(filename);
      }
    }
    for (const filename of sourceMap.keys()) {
      if (!actualMap.has(filename)) {
        failures.push(`${label}: unexpected entry: ${filename}`);
        unexpectedEntries[label].push(filename);
      }
    }
  }

  for (const actual of actualEntries) {
    for (const [label, sourceMap] of Object.entries(sourceMaps)) {
      const expected = sourceMap.get(actual.filename);
      if (!expected) continue;
      for (const field of fields) {
        compareField({
          actual,
          expected,
          field,
          label,
          failures,
          matches,
        });
      }

      const pathMatches =
        label === "before"
          ? expected.oldPath === actual.oldPath
          : label === "after"
            ? expected.archivedPath === actual.archivedPath
            : expected.oldPath === actual.oldPath &&
              expected.archivedPath === actual.archivedPath;
      if (pathMatches) {
        matches[label].path += 1;
      } else {
        failures.push(`${label} path mismatch: ${actual.filename}`);
      }
    }
  }

  return {
    failures,
    counts,
    matches,
    duplicateEntries,
    missingEntries,
    unexpectedEntries,
  };
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    return { ok: false, value: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      value: result.stderr.trim() || `git exited ${result.status}`,
    };
  }
  return { ok: true, value: result.stdout.trim() };
}

export function verifyArchiveGitBlobs({
  root = ".",
  actualEntries,
  revision = "HEAD",
}) {
  const failures = [];
  let matchedCount = 0;

  for (const entry of actualEntries) {
    const workingBlob = runGit(root, [
      "hash-object",
      "--no-filters",
      "--",
      entry.archivedPath,
    ]);
    const canonicalBlob = runGit(root, [
      "rev-parse",
      `${revision}:${entry.archivedPath}`,
    ]);

    if (!workingBlob.ok) {
      failures.push(
        `git working blob unavailable: ${entry.filename}: ${workingBlob.value}`,
      );
      continue;
    }
    if (!canonicalBlob.ok) {
      failures.push(
        `git canonical blob unavailable: ${entry.filename}: ${canonicalBlob.value}`,
      );
      continue;
    }
    if (workingBlob.value !== canonicalBlob.value) {
      failures.push(`git blob mismatch: ${entry.filename}`);
      continue;
    }
    matchedCount += 1;
  }

  return {
    failures,
    matchedCount,
    expectedCount: actualEntries.length,
  };
}

export async function readMigrationEvidence({
  root = ".",
  beforePath = "artifacts/legacy-migration-archive/before.json",
  afterPath = "artifacts/legacy-migration-archive/after.json",
  ledgerPath = "supabase/baseline/legacy-migrations.json",
} = {}) {
  const [actualEntries, before, after, ledger] = await Promise.all([
    collectCanonicalArchiveEntries({ root }),
    readFile(path.resolve(root, beforePath), "utf8").then(JSON.parse),
    readFile(path.resolve(root, afterPath), "utf8").then(JSON.parse),
    readFile(path.resolve(root, ledgerPath), "utf8").then(JSON.parse),
  ]);
  const ledgerEntries = ledger.migrations.filter(
    (entry) => entry.filename !== null,
  );
  const verification = verifyMigrationEvidenceEntries({
    actualEntries,
    beforeEntries: before.files,
    afterEntries: after.files,
    ledgerEntries,
  });
  const git = verifyArchiveGitBlobs({ root, actualEntries });

  return {
    actualEntries,
    before,
    after,
    ledger,
    ledgerEntries,
    verification,
    git,
  };
}

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ETORIE_EVIDENCE_EXPECTED_COUNT,
  collectCanonicalArchiveEntries,
  verifyArchiveGitBlobs,
  verifyMigrationEvidenceEntries,
} from "./lib/etorie-migration-evidence.mjs";

const root = process.cwd();
const beforePath = "artifacts/legacy-migration-archive/before.json";
const afterPath = "artifacts/legacy-migration-archive/after.json";
const verificationPath =
  "artifacts/legacy-migration-archive/verification.json";
const ledgerPath = "supabase/baseline/legacy-migrations.json";
const manifestPath = "supabase/baseline/manifest.json";
const activeDirectory = "supabase/migrations";

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function exists(target) {
  try {
    await access(path.resolve(root, target));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function updateManifestChecksum(text, target, checksum) {
  const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `("sha256:${escapedTarget}"\\s*:\\s*")[a-f0-9]{64}(")`,
  );
  if (!pattern.test(text)) {
    throw new Error(`Manifest checksum key is missing: ${target}`);
  }
  return text.replace(pattern, `$1${checksum}$2`);
}

const [actualEntries, ledger, activeNames] = await Promise.all([
  collectCanonicalArchiveEntries({ root }),
  readFile(path.resolve(root, ledgerPath), "utf8").then(JSON.parse),
  readdir(path.resolve(root, activeDirectory)).then((entries) =>
    entries.filter((entry) => entry.endsWith(".sql")).sort(),
  ),
]);
const ledgerEntries = ledger.migrations.filter(
  (entry) => entry.filename !== null,
);
const git = verifyArchiveGitBlobs({ root, actualEntries });
if (
  actualEntries.length !== ETORIE_EVIDENCE_EXPECTED_COUNT ||
  git.failures.length > 0 ||
  git.matchedCount !== ETORIE_EVIDENCE_EXPECTED_COUNT
) {
  throw new Error(
    [
      `Canonical archive/Git verification failed: ${git.matchedCount}/${ETORIE_EVIDENCE_EXPECTED_COUNT}`,
      ...git.failures,
    ].join("\n"),
  );
}

const before = {
  checksumMethod:
    "SHA-256 of canonical Git blob bytes; no newline or encoding conversion",
  expectedCount: ETORIE_EVIDENCE_EXPECTED_COUNT,
  actualCount: actualEntries.length,
  files: actualEntries.map(
    ({ filename, oldPath, version, sha256: checksum, sizeBytes }) => ({
      filename,
      oldPath,
      version,
      sha256: checksum,
      sizeBytes,
    }),
  ),
  classification: {
    active_baseline: activeNames.slice(0, 1),
    active_security_hardening: activeNames.slice(1, 2),
    legacy_local_migration: actualEntries.map((entry) => entry.filename),
    baseline_after_migration: [],
    unknown: [],
  },
};
const after = {
  checksumMethod:
    "SHA-256 of canonical Git blob bytes; no newline or encoding conversion",
  expectedCount: ETORIE_EVIDENCE_EXPECTED_COUNT,
  actualCount: actualEntries.length,
  files: actualEntries.map(
    ({ filename, archivedPath, version, sha256: checksum, sizeBytes }) => ({
      filename,
      archivedPath,
      version,
      sha256: checksum,
      sizeBytes,
    }),
  ),
};
const direct = verifyMigrationEvidenceEntries({
  actualEntries,
  beforeEntries: before.files,
  afterEntries: after.files,
  ledgerEntries,
});
if (direct.failures.length > 0) {
  throw new Error(
    `Generated evidence failed direct comparison:\n${direct.failures.join("\n")}`,
  );
}

const activeLegacyFiles = [];
for (const entry of actualEntries) {
  if (await exists(entry.oldPath)) activeLegacyFiles.push(entry.oldPath);
}
const verification = {
  expectedCount: ETORIE_EVIDENCE_EXPECTED_COUNT,
  actualCount: actualEntries.length,
  beforeCount: direct.counts.before,
  afterCount: direct.counts.after,
  ledgerCount: direct.counts.ledger,
  gitBlobCount: git.matchedCount,
  allChecksumsMatch:
    direct.matches.before.sha256 === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.after.sha256 === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.ledger.sha256 === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    git.matchedCount === ETORIE_EVIDENCE_EXPECTED_COUNT,
  allSizesMatch:
    direct.matches.before.sizeBytes === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.after.sizeBytes === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.ledger.sizeBytes === ETORIE_EVIDENCE_EXPECTED_COUNT,
  allPathsMatch:
    direct.matches.before.path === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.after.path === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.ledger.path === ETORIE_EVIDENCE_EXPECTED_COUNT,
  allVersionsMatch:
    direct.matches.before.version === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.after.version === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.ledger.version === ETORIE_EVIDENCE_EXPECTED_COUNT,
  allFilenamesMatch:
    direct.matches.before.filename === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.after.filename === ETORIE_EVIDENCE_EXPECTED_COUNT &&
    direct.matches.ledger.filename === ETORIE_EVIDENCE_EXPECTED_COUNT,
  gitBlobsMatch: git.matchedCount === ETORIE_EVIDENCE_EXPECTED_COUNT,
  activeLegacyFiles,
  missingFiles: Object.values(direct.missingEntries).flat(),
  unexpectedFiles: Object.values(direct.unexpectedEntries).flat(),
  duplicateEntries: direct.duplicateEntries,
  contentChanges: direct.failures,
};

await Promise.all([
  writeFile(path.resolve(root, beforePath), stableJson(before), "utf8"),
  writeFile(path.resolve(root, afterPath), stableJson(after), "utf8"),
  writeFile(
    path.resolve(root, verificationPath),
    stableJson(verification),
    "utf8",
  ),
]);

let manifestText = await readFile(
  path.resolve(root, manifestPath),
  "utf8",
);
for (const target of [
  beforePath,
  afterPath,
  verificationPath,
  ledgerPath,
]) {
  const bytes = await readFile(path.resolve(root, target));
  manifestText = updateManifestChecksum(
    manifestText,
    target,
    sha256(bytes),
  );
}
await writeFile(path.resolve(root, manifestPath), manifestText, "utf8");

console.log(`Canonical archive entries: ${actualEntries.length}`);
console.log(`Before matches: ${direct.matches.before.sha256}`);
console.log(`After matches: ${direct.matches.after.sha256}`);
console.log(`Ledger matches: ${direct.matches.ledger.sha256}`);
console.log(`Git blob matches: ${git.matchedCount}`);

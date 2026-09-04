#!/usr/bin/env node

import { access } from "node:fs/promises";
import {
  applySql,
  captureChecksum,
  compareSnapshots,
  createRunContext,
  inspectMigrationLayout,
  log,
  runCommand,
} from "./lib/etorie-pattern-runner.mjs";
import { parseArgs } from "./lib/etorie-schema-artifacts.mjs";

const args = parseArgs(process.argv.slice(2));
const context = await createRunContext("C", args);
const migrationLayout = await inspectMigrationLayout();
const hardening = migrationLayout.activePaths.find(
  (entry) => entry.endsWith(`/${migrationLayout.hardening}`),
);
const historySql = args["history-rehearsal-sql"];
const rollbackSql = args["history-rollback-sql"];

if (!hardening) {
  throw new Error("migration_layout_invalid: hardening migration is missing");
}
await access(hardening);
if (!historySql || !rollbackSql) {
  throw new Error("blocked_missing_reviewed_history_transition_sql");
}
for (const file of [historySql, rollbackSql]) {
  await access(file);
}

await log(
  context,
  `${context.execute ? "execute" : "dry-run"} Pattern C started; target=${context.projectRef}`,
);
await log(
  context,
  `migration layout verified: active=${migrationLayout.activeCount}, legacy=${migrationLayout.legacyCount}, duplicateActiveVersions=${migrationLayout.duplicateVersions.length}`,
);
const before = await captureChecksum(context, "capture pre-rehearsal checksum");
await applySql(
  context,
  "rehearse active history switch",
  historySql,
);
const afterHistory = await captureChecksum(
  context,
  "capture post-history checksum",
);
if (context.execute) {
  await compareSnapshots(
    context,
    "assert history switch changed no schema objects",
    before,
    afterHistory,
    "history-only-diff",
  );
}

await applySql(context, "apply security hardening", hardening);
const afterHardening = await captureChecksum(
  context,
  "capture post-hardening checksum",
);
if (context.execute) {
  await compareSnapshots(
    context,
    "classify hardening differences",
    afterHistory,
    afterHardening,
    "hardening-diff",
  );
  await runCommand(
    context,
    "run baseline static checks",
    process.execPath,
    ["scripts/etorie-baseline-static-check.mjs"],
  );
}

await applySql(
  context,
  "rehearse rollback",
  rollbackSql,
);
const afterRollback = await captureChecksum(
  context,
  "capture post-rollback checksum",
);
if (context.execute) {
  await compareSnapshots(
    context,
    "assert rollback restored pre-rehearsal schema",
    before,
    afterRollback,
    "rollback-diff",
  );
}
await log(
  context,
  "Pattern C helper complete. Row counts, Storage object counts, app rollback, and owner approval remain operator gates.",
);

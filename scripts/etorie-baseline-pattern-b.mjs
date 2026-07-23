#!/usr/bin/env node

import { access } from "node:fs/promises";
import {
  applyActiveMigrations,
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
const context = await createRunContext("B", args);
const migrationLayout = await inspectMigrationLayout();
const fixture = "supabase/fixtures/etorie-baseline.sql";
const referenceSnapshot = args["reference-snapshot"];

await access(fixture);
if (context.execute && !referenceSnapshot) {
  throw new Error("--reference-snapshot is required in execute mode.");
}

await log(
  context,
  `${context.execute ? "execute" : "dry-run"} Pattern B started; target=${context.projectRef}`,
);
await log(
  context,
  `migration layout verified: active=${migrationLayout.activeCount}, legacy=${migrationLayout.legacyCount}, duplicateActiveVersions=${migrationLayout.duplicateVersions.length}`,
);
await applyActiveMigrations(context, migrationLayout);
await applySql(context, "apply verification fixture", fixture, {
  etorie_fixture_confirm: "YES",
  etorie_target_project_ref: context.projectRef,
});
const snapshot = await captureChecksum(context, "capture post-baseline checksum");
if (context.execute) {
  await compareSnapshots(
    context,
    "compare reference to Pattern B",
    referenceSnapshot,
    snapshot,
    "schema-diff",
  );
  await runCommand(
    context,
    "run baseline static checks",
    process.execPath,
    ["scripts/etorie-baseline-static-check.mjs"],
  );
}
await log(
  context,
  "Pattern B helper complete. Application smoke/E2E and Storage object tests remain operator steps.",
);

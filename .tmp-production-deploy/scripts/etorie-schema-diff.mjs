#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  classifyDifferences,
  flattenDiff,
  parseArgs,
  readJson,
  stableJson,
} from "./lib/etorie-schema-artifacts.mjs";

const args = parseArgs(process.argv.slice(2));
const leftPath = args.left;
const rightPath = args.right;
const outputDir = args["output-dir"] || path.join("artifacts", "schema-diff");
const expectedPatterns = [args["expected-pattern"] ?? []].flat().filter(Boolean);

if (!leftPath || !rightPath) {
  console.error(
    "Usage: node scripts/etorie-schema-diff.mjs --left <normalized.json> --right <normalized.json> [--output-dir <dir>]",
  );
  process.exit(1);
}

const [left, right] = await Promise.all([
  readJson(leftPath),
  readJson(rightPath),
]);
const differences = classifyDifferences(
  flattenDiff(left, right),
  expectedPatterns,
);
const counts = Object.fromEntries(
  [
    "expected_difference",
    "security_hardening_difference",
    "unexpected_difference",
    "environment_specific_difference",
  ].map((classification) => [
    classification,
    differences.filter((entry) => entry.classification === classification)
      .length,
  ]),
);
const report = {
  schemaVersion: 1,
  left: leftPath,
  right: rightPath,
  counts,
  differences,
};

const markdown = [
  "# Etorie schema diff",
  "",
  `- left: \`${leftPath}\``,
  `- right: \`${rightPath}\``,
  `- total differences: ${differences.length}`,
  ...Object.entries(counts).map(([key, count]) => `- ${key}: ${count}`),
  "",
  "| classification | path | left | right |",
  "| --- | --- | --- | --- |",
  ...differences.map(
    (entry) =>
      `| ${entry.classification} | \`${entry.path.replaceAll("|", "\\|")}\` | \`${JSON.stringify(entry.left).replaceAll("|", "\\|")}\` | \`${JSON.stringify(entry.right).replaceAll("|", "\\|")}\` |`,
  ),
  "",
].join("\n");

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, "diff.json"), stableJson(report), "utf8"),
  writeFile(path.join(outputDir, "diff.md"), markdown, "utf8"),
]);

console.log(`Schema diff: ${outputDir}`);
console.log(JSON.stringify(counts));
if (counts.unexpected_difference > 0 && !args["allow-unexpected"]) {
  process.exitCode = 2;
}

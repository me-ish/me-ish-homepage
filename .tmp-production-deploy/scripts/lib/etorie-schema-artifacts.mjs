import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const PRODUCTION_PROJECT_REF = "lvnfspyainrxtztjytbo";

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function keyed(rows, keyOf) {
  return Object.fromEntries(
    [...(rows ?? [])]
      .sort((left, right) => keyOf(left).localeCompare(keyOf(right)))
      .map((row) => [keyOf(row), stableValue(row)]),
  );
}

export function normalizeCatalog(rawCatalog) {
  return {
    tables: keyed(
      rawCatalog.tables,
      (row) => `${row.schema}.${row.table}`,
    ),
    columns: keyed(
      rawCatalog.columns,
      (row) =>
        `${row.schema}.${row.table}.${String(row.ordinal).padStart(4, "0")}.${row.column}`,
    ),
    constraints: keyed(
      rawCatalog.constraints,
      (row) => `${row.schema}.${row.table}.${row.name}`,
    ),
    indexes: keyed(
      rawCatalog.indexes,
      (row) => `${row.schema}.${row.table}.${row.name}`,
    ),
    triggers: keyed(
      rawCatalog.triggers,
      (row) => `${row.schema}.${row.table}.${row.name}`,
    ),
    functions: keyed(
      (rawCatalog.functions ?? []).map((row) => ({
        ...row,
        bodySha256: sha256(row.body ?? ""),
      })),
      (row) => `${row.schema}.${row.name}(${row.identityArguments})`,
    ),
    functionAcl: keyed(
      rawCatalog.functionAcl,
      (row) =>
        `${row.schema}.${row.name}(${row.identityArguments}).${row.grantee}.${row.privilege}`,
    ),
    policies: keyed(
      rawCatalog.policies,
      (row) => `${row.schema}.${row.table}.${row.name}`,
    ),
    tableGrants: keyed(
      rawCatalog.tableGrants,
      (row) =>
        `${row.schema}.${row.table}.${row.grantee}.${row.privilege}`,
    ),
    buckets: keyed(rawCatalog.buckets, (row) => row.id),
    storagePolicies: keyed(
      rawCatalog.storagePolicies,
      (row) => `${row.schema}.${row.table}.${row.name}`,
    ),
  };
}

export function flattenDiff(left, right, path = "$", output = []) {
  if (Object.is(left, right)) return output;

  const leftObject = left && typeof left === "object" && !Array.isArray(left);
  const rightObject = right && typeof right === "object" && !Array.isArray(right);

  if (leftObject && rightObject) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      flattenDiff(left[key], right[key], `${path}.${key}`, output);
    }
    return output;
  }

  output.push({
    path,
    left: left === undefined ? null : left,
    right: right === undefined ? null : right,
  });
  return output;
}

export function classifyDifference(difference, expectedPatterns = []) {
  const haystack = JSON.stringify(difference).toLowerCase();

  if (
    expectedPatterns.some((pattern) =>
      new RegExp(pattern, "i").test(difference.path),
    )
  ) {
    return "expected_difference";
  }

  const hardeningObject =
    haystack.includes("allow insert 1exduyn_0") ||
    haystack.includes("processed_stripe_events") ||
    haystack.includes("natori_delete_project") ||
    haystack.includes("card_requests") ||
    haystack.includes("aura_projects");
  const hardeningCategory =
    difference.path.includes(".policies.") ||
    difference.path.includes(".storagePolicies.") ||
    difference.path.includes(".tableGrants.") ||
    difference.path.includes(".functionAcl.") ||
    difference.path.includes(".functions.") ||
    difference.path.includes(".tables.");

  if (hardeningObject && hardeningCategory) {
    return "security_hardening_difference";
  }

  if (
    difference.path.includes(".serverVersion") ||
    difference.path.includes(".extensionVersion") ||
    difference.path.includes(".environmentMetadata")
  ) {
    return "environment_specific_difference";
  }

  return "unexpected_difference";
}

export function classifyDifferences(differences, expectedPatterns = []) {
  return differences.map((difference) => ({
    ...difference,
    classification: classifyDifference(difference, expectedPatterns),
  }));
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else if (result[key] === undefined) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = [result[key], next].flat();
      index += 1;
    }
  }
  return result;
}

export function assertSafeTarget({ projectRef, databaseUrl, execute }) {
  if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("A 20-character ETORIE_TARGET_PROJECT_REF is required.");
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Production project ref is blocked.");
  }
  if (
    databaseUrl &&
    databaseUrl.toLowerCase().includes(PRODUCTION_PROJECT_REF.toLowerCase())
  ) {
    throw new Error("A database URL containing the production ref is blocked.");
  }
  if (execute && process.env.CONFIRM_NON_PRODUCTION !== "YES") {
    throw new Error("CONFIRM_NON_PRODUCTION=YES is required for execute mode.");
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

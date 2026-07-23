import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_PROJECT_REF,
  assertSafeTarget,
  classifyDifferences,
  flattenDiff,
  normalizeCatalog,
  stableJson,
} from "../../../scripts/lib/etorie-schema-artifacts.mjs";

type LegacyMigrationEntry = {
  oldPath: string | null;
  archivedPath: string | null;
  filename: string | null;
  version: string;
  sha256: string;
  sizeBytes: number | null;
  status: string;
  replay: "evidence-only" | "unsupported";
};

function readJson<T>(target: string): T {
  return JSON.parse(readFileSync(target, "utf8")) as T;
}

function fileSha256(target: string): string {
  return createHash("sha256").update(readFileSync(target)).digest("hex");
}

describe("Etorie schema artifacts", () => {
  it("serializes object keys deterministically", () => {
    expect(stableJson({ z: 1, a: { d: 2, b: 3 } })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "d": 2\n  },\n  "z": 1\n}\n',
    );
  });

  it("keys catalog objects by stable identities and hashes function bodies", () => {
    const normalized = normalizeCatalog({
      tables: [{ schema: "public", table: "natori_projects" }],
      functions: [
        {
          schema: "public",
          name: "natori_delete_project",
          identityArguments: "p_user_id uuid, p_project_id uuid",
          body: "begin return true; end",
        },
      ],
    });

    expect(normalized.tables["public.natori_projects"]).toBeDefined();
    expect(
      normalized.functions[
        "public.natori_delete_project(p_user_id uuid, p_project_id uuid)"
      ].bodySha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("classifies target ACL and function changes as security hardening", () => {
    const differences = flattenDiff(
      {
        catalog: {
          tableGrants: {
            "public.processed_stripe_events.anon.SELECT": { privilege: "SELECT" },
          },
        },
      },
      { catalog: { tableGrants: {} } },
    );
    expect(classifyDifferences(differences)[0].classification).toBe(
      "security_hardening_difference",
    );
  });

  it("leaves unrelated definition changes unexpected", () => {
    const differences = flattenDiff(
      { catalog: { columns: { a: { nullable: true } } } },
      { catalog: { columns: { a: { nullable: false } } } },
    );
    expect(classifyDifferences(differences)[0].classification).toBe(
      "unexpected_difference",
    );
  });

  it("blocks the production project ref", () => {
    expect(() =>
      assertSafeTarget({
        projectRef: PRODUCTION_PROJECT_REF,
        databaseUrl: undefined,
        execute: false,
      }),
    ).toThrow(/Production project ref is blocked/);
  });

  it("blocks a database URL containing the production project ref", () => {
    expect(() =>
      assertSafeTarget({
        projectRef: "aaaaaaaaaaaaaaaaaaaa",
        databaseUrl: `postgresql://${PRODUCTION_PROJECT_REF}.invalid/postgres`,
        execute: false,
      }),
    ).toThrow(/database URL containing the production ref is blocked/);
  });

  it("requires explicit non-production confirmation in execute mode", () => {
    const previous = process.env.CONFIRM_NON_PRODUCTION;
    process.env.CONFIRM_NON_PRODUCTION = "NO";
    try {
      expect(() =>
        assertSafeTarget({
          projectRef: "aaaaaaaaaaaaaaaaaaaa",
          databaseUrl: "postgresql://localhost/postgres",
          execute: true,
        }),
      ).toThrow(/CONFIRM_NON_PRODUCTION=YES is required/);
    } finally {
      if (previous === undefined) delete process.env.CONFIRM_NON_PRODUCTION;
      else process.env.CONFIRM_NON_PRODUCTION = previous;
    }
  });
});

describe("Etorie migration archive", () => {
  const activeDirectory = path.join("supabase", "migrations");
  const legacyDirectory = path.join("supabase", "legacy-migrations");
  const baselineName = "20260723111730_etorie_baseline.sql";
  const hardeningName =
    "20260723111741_baseline_security_hardening.sql";
  const manifest = readJson<{
    activeMigrations: string[];
    activeMigrationCount: number;
    legacyMigrationCount: number;
    requiredSequence: string[];
    archiveVerification: { allChecksumsMatch: boolean };
  }>(path.join("supabase", "baseline", "manifest.json"));
  const legacyManifest = readJson<{
    localLegacyFileCount: number;
    remoteOnlyCount: number;
    migrations: LegacyMigrationEntry[];
  }>(path.join("supabase", "baseline", "legacy-migrations.json"));
  const before = readJson<{
    files: Array<{
      filename: string;
      oldPath: string;
      sha256: string;
      sizeBytes: number;
    }>;
  }>(path.join("artifacts", "legacy-migration-archive", "before.json"));

  it("keeps only the ordered baseline lane active with unique CLI versions", () => {
    const active = readdirSync(activeDirectory)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();
    const versions = active.map((entry) => entry.split("_", 1)[0]);

    expect(active).toEqual([baselineName, hardeningName]);
    expect(new Set(versions).size).toBe(versions.length);
    expect(active.every((entry) => /^\d{14}_[a-z0-9_]+\.sql$/.test(entry))).toBe(
      true,
    );
    expect(manifest.activeMigrations).toEqual(
      active.map((entry) => `supabase/migrations/${entry}`),
    );
    expect(manifest.requiredSequence).toEqual([baselineName, hardeningName]);
    expect(manifest.activeMigrationCount).toBe(2);
  });

  it("archives exactly 55 manifest-listed migrations outside the active lane", () => {
    const archived = readdirSync(legacyDirectory)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();
    const localEntries = legacyManifest.migrations.filter(
      (
        entry,
      ): entry is LegacyMigrationEntry & {
        filename: string;
        oldPath: string;
        archivedPath: string;
        sizeBytes: number;
      } => entry.filename !== null,
    );

    expect(archived).toEqual(
      localEntries.map((entry) => entry.filename).sort(),
    );
    expect(archived).toHaveLength(55);
    expect(legacyManifest.localLegacyFileCount).toBe(55);
    expect(manifest.legacyMigrationCount).toBe(55);
    for (const entry of localEntries) {
      expect(entry.oldPath).toBe(`supabase/migrations/${entry.filename}`);
      expect(entry.archivedPath).toBe(
        `supabase/legacy-migrations/${entry.filename}`,
      );
      expect(existsSync(entry.oldPath)).toBe(false);
      expect(fileSha256(entry.archivedPath)).toBe(entry.sha256);
      expect(readFileSync(entry.archivedPath).byteLength).toBe(entry.sizeBytes);
    }
  });

  it("proves archived SQL matches the pre-move byte ledger", () => {
    for (const entry of before.files) {
      const archivedPath = path.join(legacyDirectory, entry.filename);
      expect(fileSha256(archivedPath)).toBe(entry.sha256);
      expect(readFileSync(archivedPath).byteLength).toBe(entry.sizeBytes);
    }
    expect(manifest.archiveVerification.allChecksumsMatch).toBe(true);
  });

  it("does not synthesize remote-only history or portfolio_profiles", () => {
    const active = readdirSync(activeDirectory)
      .filter((entry) => entry.endsWith(".sql"));
    const remoteOnly = legacyManifest.migrations.filter(
      (entry) => entry.status === "remote-only",
    );
    const baseline = readFileSync(
      path.join(activeDirectory, baselineName),
      "utf8",
    );

    expect(remoteOnly).toHaveLength(3);
    expect(legacyManifest.remoteOnlyCount).toBe(3);
    expect(
      remoteOnly.every(
        (entry) =>
          entry.filename === null &&
          entry.oldPath === null &&
          entry.archivedPath === null &&
          !active.some((name) => name.startsWith(`${entry.version}_`)),
      ),
    ).toBe(true);
    expect(baseline).not.toContain("portfolio_profiles");
  });
});

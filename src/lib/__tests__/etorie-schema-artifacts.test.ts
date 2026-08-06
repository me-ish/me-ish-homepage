import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectCanonicalArchiveEntries,
  verifyMigrationEvidenceEntries,
} from "../../../scripts/lib/etorie-migration-evidence.mjs";
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
  const phase1ExpandName =
    "20260729115313_etorie_phase1_expand.sql";
  const phase1ConstraintsName =
    "20260729115323_etorie_phase1_project_constraints.sql";
  const remainingPrivilegesName =
    "20260731111025_harden_natori_remaining_privileges.sql";
  const intakeRpcsName =
    "20260731115652_etorie_intake_rpcs.sql";
  const manifest = readJson<{
    activeMigrations: string[];
    activeMigrationCount: number;
    legacyMigrationCount: number;
    requiredSequence: string[];
    archiveVerification: {
      allChecksumsMatch: boolean;
      verificationArtifact: string;
    };
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
      version: string;
      sha256: string;
      sizeBytes: number;
    }>;
  }>(path.join("artifacts", "legacy-migration-archive", "before.json"));
  const after = readJson<{
    files: Array<{
      filename: string;
      archivedPath: string;
      version: string;
      sha256: string;
      sizeBytes: number;
    }>;
  }>(path.join("artifacts", "legacy-migration-archive", "after.json"));
  const verification = readJson<{
    beforeCount: number;
    afterCount: number;
    ledgerCount: number;
    gitBlobCount: number;
    allChecksumsMatch: boolean;
    gitBlobsMatch: boolean;
    duplicateEntries: string[];
    contentChanges: string[];
  }>(manifest.archiveVerification.verificationArtifact);

  it("keeps the frozen baseline pair followed by the ordered Phase 1 lane", () => {
    const active = readdirSync(activeDirectory)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();
    const versions = active.map((entry) => entry.split("_", 1)[0]);

    const frozenPhase1Lane = [
      baselineName,
      hardeningName,
      phase1ExpandName,
      phase1ConstraintsName,
      remainingPrivilegesName,
      intakeRpcsName,
    ];
    expect(active.slice(0, frozenPhase1Lane.length)).toEqual(frozenPhase1Lane);
    expect(new Set(versions).size).toBe(versions.length);
    expect(active.every((entry) => /^\d{14}_[a-z0-9_]+\.sql$/.test(entry))).toBe(
      true,
    );
    expect(manifest.activeMigrations).toEqual(
      frozenPhase1Lane.map(
        (entry) => `supabase/migrations/${entry}`,
      ),
    );
    expect(manifest.requiredSequence).toEqual(frozenPhase1Lane);
    expect(manifest.activeMigrationCount).toBe(frozenPhase1Lane.length);
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

  it("proves archive, before, after, and ledger match canonical bytes 55/55", async () => {
    const actualEntries = await collectCanonicalArchiveEntries();
    const ledgerEntries = legacyManifest.migrations.filter(
      (
        entry,
      ): entry is LegacyMigrationEntry & {
        filename: string;
        oldPath: string;
        archivedPath: string;
        sizeBytes: number;
      } => entry.filename !== null,
    );
    const direct = verifyMigrationEvidenceEntries({
      actualEntries,
      beforeEntries: before.files,
      afterEntries: after.files,
      ledgerEntries,
    });

    expect(direct.failures).toEqual([]);
    expect(direct.counts).toEqual({
      archive: 55,
      before: 55,
      after: 55,
      ledger: 55,
    });
    for (const label of ["before", "after", "ledger"] as const) {
      expect(direct.matches[label].filename).toBe(55);
      expect(direct.matches[label].path).toBe(55);
      expect(direct.matches[label].version).toBe(55);
      expect(direct.matches[label].sizeBytes).toBe(55);
      expect(direct.matches[label].sha256).toBe(55);
    }
    for (const entry of actualEntries) {
      expect(readFileSync(entry.archivedPath).includes(13)).toBe(false);
    }
    expect(verification.beforeCount).toBe(55);
    expect(verification.afterCount).toBe(55);
    expect(verification.ledgerCount).toBe(55);
    expect(verification.gitBlobCount).toBe(55);
    expect(verification.allChecksumsMatch).toBe(true);
    expect(verification.gitBlobsMatch).toBe(true);
    expect(verification.duplicateEntries).toEqual([]);
    expect(verification.contentChanges).toEqual([]);
    expect(manifest.archiveVerification.allChecksumsMatch).toBe(true);
  });

  it("rejects a corrupted checksum in a temporary evidence fixture", async () => {
    const fixtureRoot = mkdtempSync(
      path.join(tmpdir(), "etorie-migration-evidence-"),
    );
    try {
      const fixtureDirectory = path.join(
        fixtureRoot,
        "supabase",
        "legacy-migrations",
      );
      mkdirSync(fixtureDirectory, { recursive: true });
      writeFileSync(
        path.join(fixtureDirectory, "20260101000000_first.sql"),
        "select 1;\n",
      );
      writeFileSync(
        path.join(fixtureDirectory, "20260101000001_second.sql"),
        "select 2;\n",
      );
      const actualEntries = await collectCanonicalArchiveEntries({
        root: fixtureRoot,
      });
      const beforeEntries = actualEntries.map(
        ({ archivedPath: _archivedPath, ...entry }) => entry,
      );
      const afterEntries = actualEntries.map(
        ({ oldPath: _oldPath, ...entry }) => entry,
      );
      const ledgerEntries = actualEntries.map((entry) => ({ ...entry }));
      afterEntries[0] = {
        ...afterEntries[0],
        sha256: "0".repeat(64),
      };

      const direct = verifyMigrationEvidenceEntries({
        actualEntries,
        beforeEntries,
        afterEntries,
        ledgerEntries,
        expectedCount: 2,
      });
      expect(direct.failures).toContain(
        "after sha256 mismatch: 20260101000000_first.sql",
      );
      expect(direct.matches.after.sha256).toBe(1);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
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

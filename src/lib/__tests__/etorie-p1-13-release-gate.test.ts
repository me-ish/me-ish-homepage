import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Etorie P1-13 release gate assets", () => {
  it("keeps the public structured writer default-off", () => {
    const source = read("src/features/natori/server/publicIntakeRollout.ts");
    expect(source).toContain('const ENABLED_VALUE = "1"');
    expect(source).toContain("process.env.NATORI_PUBLIC_INTAKE_V2?.trim() === ENABLED_VALUE");
  });

  it("has safe browser coverage for legacy, consultation, and quote", () => {
    const source = read("e2e/natori-intake.spec.ts");
    expect(source).toContain("keeps the legacy form as the default");
    expect(source).toContain("structured consultation flow");
    expect(source).toContain("structured quote flow");
    expect(source).toContain("/etorie/demo/app/portfolio");
  });

  it("keeps the release SQL read-only", () => {
    const sql = read("supabase/verification/etorie-p1-13-release-selects.sql");
    const statements = sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements.length).toBeGreaterThan(0);
    expect(statements.every((statement) => statement.toLowerCase().startsWith("select"))).toBe(
      true
    );
    expect(sql).toContain("recent_initial_state_anomaly_count");
    expect(sql).toContain("client_role_rpc_execute_anomaly_count");
  });

  it("requires named owners, observation period, sandbox, and rollback rehearsal", () => {
    const runbook = read("docs/etorie-p1-13-rollout-runbook.md");
    expect(runbook).toContain("monitor owner");
    expect(runbook).toContain("observation period");
    expect(runbook).toContain("operator_confirmation_required");
    expect(runbook).toContain("Stripe test mode");
    expect(runbook).toContain("flag OFF");
    expect(runbook).toContain("dual reader");
    expect(runbook).toContain("DBをdown migrationしない");
  });

  it("does not hide lint, unit, or browser failures in CI", () => {
    const workflow = read(".github/workflows/ci.yml");
    const blockingJobs = ["lint", "test", "e2e"];

    for (const job of blockingJobs) {
      const start = workflow.indexOf(`  ${job}:`);
      expect(start).toBeGreaterThanOrEqual(0);
      const rest = workflow.slice(start + 2);
      const nextJob = rest.search(/^  [a-z][a-z0-9_-]*:/m);
      const block = nextJob >= 0 ? rest.slice(0, nextJob) : rest;
      expect(block).not.toContain("continue-on-error: true");
      expect(block).not.toContain("|| true");
    }
  });
});

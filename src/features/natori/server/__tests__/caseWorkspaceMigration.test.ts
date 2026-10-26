import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CASE_MANAGEMENT_SQL } from "../caseManagementQuery";
import {CURRENT_LINK_READ_PROJECTION} from "../caseSnapshotFinancial";
import {
  CASE_WORKSPACE_MIGRATION_FILE,
  renderCaseWorkspaceMigration,
} from "../../../../../scripts/natori-case-preview/readContract";

describe("formal case workspace forward migration", () => {
  it("matches the canonical owner-scoped read contract byte for byte", () => {
    expect(CASE_WORKSPACE_MIGRATION_FILE).toMatch(/^\d{14}_natori_case_workspace_read\.sql$/);
    const migration = readFileSync(resolve("supabase/migrations", CASE_WORKSPACE_MIGRATION_FILE), "utf8");
    expect(migration).toBe(renderCaseWorkspaceMigration());
    expect(migration).toContain(CASE_MANAGEMENT_SQL.replace(CURRENT_LINK_READ_PROJECTION,"a.id::text AS attempt_id").replace("p.payment_link_status, p.payment_quote_id,", "p.payment_link_status,"));
    expect(readFileSync(resolve("scripts/natori-case-production-upgrade/current-flow.sql"),"utf8")).toContain(CURRENT_LINK_READ_PROJECTION);
    expect(migration.match(/CREATE OR REPLACE FUNCTION public\./g)).toHaveLength(2);
    expect(migration).not.toMatch(/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|ALTER TABLE|CREATE TABLE|ALTER DEFAULT PRIVILEGES|SECURITY DEFINER)\b/i);
  });
});

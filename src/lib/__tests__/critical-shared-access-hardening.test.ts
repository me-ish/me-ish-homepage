import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260911132256_critical_shared_access_hardening.sql",
  ),
  "utf8",
);
const verification = readFileSync(
  path.join(
    "supabase",
    "verification",
    "critical-shared-access-hardening-selects.sql",
  ),
  "utf8",
);

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

function statements(sql: string): string[] {
  return stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("critical shared Supabase access hardening", () => {
  it("makes Card and AURA base tables service-role only behind RLS", () => {
    for (const table of ["card_requests", "aura_projects"]) {
      expect(migration).toContain(`to_regclass('public.${table}')`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table} from public, anon, authenticated`,
      );
      expect(migration).toContain(
        `grant all privileges on table public.${table} to service_role`,
      );
    }
  });

  it("removes anonymous execution from privileged legacy RPCs", () => {
    const signatures = [
      "admin_mark_sales_paid(uuid, uuid)",
      "finalize_sale(bigint, integer, text)",
      "finalize_sale(bigint, integer, text, integer)",
      "get_auth_user_id_by_email(text)",
    ];

    for (const signature of signatures) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated`,
      );
      expect(migration).toContain(
        `grant execute on function public.${signature} to service_role`,
      );
    }
  });

  it("keeps the verification artifact read-only", () => {
    const queries = statements(verification);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((statement) => /^select\b/i.test(statement))).toBe(true);
    expect(verification).toContain("has_table_privilege('anon'");
    expect(verification).toContain("has_function_privilege('anon'");
  });
});

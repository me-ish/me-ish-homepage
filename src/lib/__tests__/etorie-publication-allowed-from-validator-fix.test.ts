import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  "supabase",
  "migrations",
  "20260908123441_etorie_publication_allowed_from_validator_fix.sql"
);
const migration = readFileSync(migrationPath, "utf8");

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--.*$/gmu, "");
}

describe("Etorie publicationAllowedFrom validator fix", () => {
  it("keeps the existing validator as the compatibility source of truth", () => {
    expect(migration).toMatch(
      /alter\s+function\s+public\.natori_request_data_is_valid_v1\s*\(\s*jsonb\s*\)\s+rename\s+to\s+natori_request_data_is_valid_v1_legacy_20260908/iu
    );
    expect(migration).toMatch(
      /if\s+not\s*\(p_request_data\s*\?\s*'publicationAllowedFrom'\)\s+then\s+return\s+public\.natori_request_data_is_valid_v1_legacy_20260908\(p_request_data\)/iu
    );
    expect(migration).toMatch(
      /natori_request_data_is_valid_v1_legacy_20260908\s*\(\s*p_request_data\s*-\s*'publicationAllowedFrom'\s*\)/iu
    );
  });

  it("requires a real date only for delayed publication", () => {
    expect(migration).toMatch(
      /publicationAllowedFrom'\s*=\s*'null'::jsonb[\s\S]*?v_policy\s*=\s*'delayed'[\s\S]*?return\s+false/iu
    );
    expect(migration).toMatch(
      /jsonb_typeof\(p_request_data\s*->\s*'publicationAllowedFrom'\)\s*<>\s*'string'[\s\S]*?v_policy\s*<>\s*'delayed'/iu
    );
    expect(migration).toContain("pg_catalog.make_date");
    expect(migration).toContain("pg_catalog.to_char");
  });

  it("keeps the wrapper private and avoids row or table mutation", () => {
    expect(migration).toMatch(/\bsecurity\s+invoker\b/iu);
    expect(migration).toMatch(/\bset\s+search_path\s*=\s*''/iu);
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_request_data_is_valid_v1_legacy_20260908\s*\(\s*jsonb\s*\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role/iu
    );
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_request_data_is_valid_v1\s*\(\s*jsonb\s*\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role/iu
    );

    const executable = stripSqlComments(migration).replace(
      /as\s+\$function\$[\s\S]*?\$function\$/giu,
      "as $function$body omitted$function$"
    );
    expect(executable).not.toMatch(/\b(?:insert\s+into|update|delete\s+from|truncate)\b/iu);
    expect(executable).not.toMatch(/\balter\s+table\b/iu);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const expandPath = path.join(
  "supabase",
  "migrations",
  "20260729115313_etorie_phase1_expand.sql",
);
const constraintsPath = path.join(
  "supabase",
  "migrations",
  "20260729115323_etorie_phase1_project_constraints.sql",
);
const verificationPath = path.join(
  "supabase",
  "verification",
  "etorie-p1-03-selects.sql",
);

const expandSql = readFileSync(expandPath, "utf8");
const constraintsSql = readFileSync(constraintsPath, "utf8");
const verificationSql = readFileSync(verificationPath, "utf8");
const phase1Sql = `${expandSql}\n${constraintsSql}`;

function withoutLineComments(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function executableStatements(sql: string): string[] {
  return withoutLineComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("Etorie P1-03 schema migrations", () => {
  it("keeps both migrations transactional and free of existing-row DML", () => {
    for (const sql of [expandSql, constraintsSql]) {
      expect(sql).toMatch(/^\s*--[\s\S]*?\bbegin;\s/i);
      expect(sql).toMatch(/\bcommit;\s*$/i);
    }

    const executableSql = withoutLineComments(phase1Sql);
    expect(executableSql).not.toMatch(
      /\b(?:insert\s+into|update\s+public\.|delete\s+from)\b/i,
    );
  });

  it("adds nullable request and quote snapshots without defaults", () => {
    expect(expandSql).toMatch(
      /alter\s+table\s+public\.natori_projects[\s\S]*add\s+column\s+request_data\s+jsonb\b/i,
    );
    expect(expandSql).toMatch(
      /alter\s+column\s+amount\s+drop\s+not\s+null[\s\S]*alter\s+column\s+amount\s+drop\s+default/i,
    );
    expect(expandSql).toMatch(
      /alter\s+column\s+due_date\s+drop\s+not\s+null[\s\S]*alter\s+column\s+due_date\s+drop\s+default/i,
    );
    expect(expandSql).toMatch(
      /alter\s+table\s+public\.natori_quotes[\s\S]*add\s+column\s+request_snapshot\s+jsonb[\s\S]*add\s+column\s+pricing_snapshot\s+jsonb/i,
    );
    expect(expandSql).not.toMatch(
      /(?:request_data|request_snapshot|pricing_snapshot)\s+jsonb\s+default/i,
    );
  });

  it("creates the formally designed project reference link table", () => {
    const table = expandSql.match(
      /create\s+table\s+public\.natori_project_reference_links\s*\(([\s\S]*?)\n\);/i,
    )?.[1];

    expect(table).toBeDefined();
    expect(table).toMatch(/\bid\s+uuid\s+primary\s+key\b/i);
    expect(table).toMatch(/\bproject_id\s+uuid\s+not\s+null\b/i);
    expect(table).toMatch(/\burl\s+text\s+not\s+null\b/i);
    expect(table).toMatch(/\bnormalized_url\s+text\s+not\s+null\b/i);
    expect(table).toMatch(/\blabel\s+text\b/i);
    expect(table).toMatch(/\bprovider\s+text\b/i);
    expect(table).toMatch(/\bsort_order\s+integer\s+not\s+null\s+default\s+0\b/i);
    expect(table).toMatch(/\bcreated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
    expect(table).toMatch(/\bupdated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
    expect(table).toMatch(
      /constraint\s+natori_project_reference_links_project_id_fkey[\s\S]*references\s+public\.natori_projects\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i,
    );
    expect(table).not.toMatch(/\buser_id\b/i);
  });

  it("keeps project reference links server-only with RLS and narrow grants", () => {
    expect(expandSql).toMatch(
      /alter\s+table\s+public\.natori_project_reference_links\s+enable\s+row\s+level\s+security/i,
    );
    expect(expandSql).toMatch(
      /create\s+policy\s+natori_service_only[\s\S]*to\s+anon,\s*authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i,
    );
    expect(expandSql).toMatch(
      /revoke\s+all\s+privileges\s+on\s+table\s+public\.natori_project_reference_links\s+from\s+public,\s*anon,\s*authenticated,\s*service_role\s*;/i,
    );
    expect(expandSql).toMatch(
      /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.natori_project_reference_links\s+to\s+service_role\s*;/i,
    );
    const serviceRoleGrants = [
      ...expandSql.matchAll(
        /grant\s+([\s\S]*?)\s+on\s+table\s+public\.natori_project_reference_links\s+to\s+service_role\s*;/gi,
      ),
    ];
    expect(serviceRoleGrants).toHaveLength(1);
    expect(
      serviceRoleGrants[0][1]
        .split(",")
        .map((privilege) => privilege.trim().toUpperCase()),
    ).toEqual(["SELECT", "INSERT", "UPDATE", "DELETE"]);
    expect(serviceRoleGrants[0][1]).not.toMatch(
      /\b(?:ALL|REFERENCES|TRIGGER|TRUNCATE)\b/i,
    );
    expect(expandSql).not.toMatch(
      /create\s+policy[\s\S]*?(?:using|with\s+check)\s*\(\s*true\s*\)/i,
    );
  });

  it("adds a dedicated updated_at trigger and durable schema comments", () => {
    expect(expandSql).toMatch(
      /create\s+function\s+public\.touch_natori_project_reference_links_updated_at\(\)[\s\S]*security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i,
    );
    expect(expandSql).toMatch(
      /create\s+trigger\s+trg_natori_project_reference_links_touch[\s\S]*before\s+update\s+on\s+public\.natori_project_reference_links/i,
    );
    for (const target of [
      "public.natori_projects.request_data",
      "public.natori_projects.amount",
      "public.natori_projects.due_date",
      "public.natori_projects.type",
      "public.natori_quotes.request_snapshot",
      "public.natori_quotes.pricing_snapshot",
    ]) {
      expect(expandSql).toContain(`comment on column ${target}`);
    }
    expect(expandSql).toContain(
      "comment on table public.natori_project_reference_links",
    );
  });

  it("replaces the known project checks without guessing constraint names", () => {
    expect(constraintsSql).toMatch(
      /drop\s+constraint\s+natori_projects_amount_check\s*;/i,
    );
    expect(constraintsSql).toMatch(
      /add\s+constraint\s+natori_projects_amount_check[\s\S]*check\s*\(\s*amount\s+is\s+null\s+or\s+amount\s*>=\s*0\s*\)[\s\S]*not\s+valid/i,
    );
    expect(constraintsSql).toMatch(
      /validate\s+constraint\s+natori_projects_amount_check/i,
    );
    expect(constraintsSql).toMatch(
      /drop\s+constraint\s+natori_projects_type_check\s*;/i,
    );
    expect(constraintsSql).toMatch(
      /alter\s+column\s+type\s+set\s+default\s+'undecided'/i,
    );
    for (const type of [
      "undecided",
      "icon",
      "sd",
      "standing",
      "illustration",
    ]) {
      expect(constraintsSql).toContain(`'${type}'`);
    }
    expect(constraintsSql).not.toMatch(
      /drop\s+constraint\s+if\s+exists\s+natori_projects_(?:amount|type)_check/i,
    );
  });

  it("enforces only the RequestData envelope with an actual UTF-8 byte limit", () => {
    expect(constraintsSql).toMatch(
      /add\s+constraint\s+natori_projects_request_data_envelope_check/i,
    );
    expect(constraintsSql).toMatch(
      /jsonb_typeof\s*\(\s*request_data\s*\)\s*=\s*'object'/i,
    );
    expect(constraintsSql).toMatch(
      /request_data\s*\?\s*'schemaVersion'/i,
    );
    expect(constraintsSql).toMatch(
      /jsonb_typeof\s*\(\s*request_data\s*->\s*'schemaVersion'\s*\)\s*=\s*'number'/i,
    );
    expect(constraintsSql).toMatch(
      /\(\s*request_data\s*->>\s*'schemaVersion'\s*\)::numeric\s*=\s*1/i,
    );
    expect(constraintsSql).toMatch(
      /octet_length\s*\(\s*convert_to\s*\(\s*request_data::text,\s*'UTF8'\s*\)\s*\)\s*<=\s*65536/i,
    );
    expect(constraintsSql).not.toMatch(
      /char_length\s*\(\s*request_data::text\s*\)/i,
    );
  });

  it("accepts nullable snapshots but rejects non-object snapshot values", () => {
    expect(constraintsSql).toMatch(
      /natori_quotes_request_snapshot_object_check[\s\S]*request_snapshot\s+is\s+null[\s\S]*jsonb_typeof\s*\(\s*request_snapshot\s*\)\s*=\s*'object'/i,
    );
    expect(constraintsSql).toMatch(
      /natori_quotes_pricing_snapshot_object_check[\s\S]*pricing_snapshot\s+is\s+null[\s\S]*jsonb_typeof\s*\(\s*pricing_snapshot\s*\)\s*=\s*'object'/i,
    );
  });

  it("enforces reference link length, ordering, duplicate, FK, and index rules", () => {
    expect(constraintsSql).toMatch(
      /natori_project_reference_links_url_check[\s\S]*btrim\s*\(\s*url\s*\)\s*<>\s*''[\s\S]*char_length\s*\(\s*url\s*\)\s*<=\s*2048/i,
    );
    expect(constraintsSql).toMatch(
      /natori_project_reference_links_normalized_url_check[\s\S]*btrim\s*\(\s*normalized_url\s*\)\s*<>\s*''[\s\S]*char_length\s*\(\s*normalized_url\s*\)\s*<=\s*2048/i,
    );
    expect(constraintsSql).toMatch(
      /natori_project_reference_links_label_check[\s\S]*char_length\s*\(\s*label\s*\)\s*<=\s*100/i,
    );
    expect(constraintsSql).toMatch(
      /natori_project_reference_links_sort_order_check[\s\S]*sort_order\s*>=\s*0/i,
    );
    expect(constraintsSql).toMatch(
      /natori_project_reference_links_project_id_normalized_url_key[\s\S]*unique\s*\(\s*project_id,\s*normalized_url\s*\)/i,
    );
    expect(constraintsSql).toMatch(
      /create\s+index\s+natori_project_reference_links_project_sort_idx[\s\S]*project_id,\s*sort_order,\s*created_at/i,
    );
  });

  it("replaces both legacy due-date indexes with one active non-null partial index", () => {
    expect(constraintsSql).toContain(
      "drop index public.natori_projects_user_due_idx;",
    );
    expect(constraintsSql).toContain(
      "drop index public.natori_projects_active_owner_due_idx;",
    );
    expect(constraintsSql).toMatch(
      /create\s+index\s+natori_projects_active_owner_due_idx[\s\S]*on\s+public\.natori_projects\s*\(\s*user_id,\s*due_date\s*\)[\s\S]*where\s+deleted_at\s+is\s+null[\s\S]*due_date\s+is\s+not\s+null/i,
    );
  });

  it("defers activity and pricing default uniqueness outside P1-03", () => {
    expect(phase1Sql).not.toContain("natori_project_activity");
    expect(phase1Sql).not.toMatch(
      /(?:create\s+unique\s+index|add\s+constraint)[\s\S]*natori_pricing_configs[\s\S]*is_default/i,
    );
  });

  it("keeps the verification artifact strictly SELECT-only and complete", () => {
    const statements = executableStatements(verificationSql);

    expect(statements.length).toBeGreaterThanOrEqual(12);
    expect(statements.every((statement) => /^select\b/i.test(statement))).toBe(
      true,
    );
    expect(verificationSql).toContain("information_schema.columns");
    expect(verificationSql).toContain("pg_catalog.pg_constraint");
    expect(verificationSql).toContain("pg_catalog.pg_indexes");
    expect(verificationSql).toContain("pg_catalog.pg_policies");
    expect(verificationSql).toContain("information_schema.role_table_grants");
    expect(verificationSql).toMatch(
      /array\[\s*'DELETE',\s*'INSERT',\s*'SELECT',\s*'UPDATE'\s*\]::text\[\][\s\S]*as\s+service_role_has_crud_only[\s\S]*table_name\s*=\s*'natori_project_reference_links'[\s\S]*grantee\s*=\s*'service_role'/i,
    );
    expect(verificationSql).toContain(
      "duplicate_project_normalized_url_groups",
    );
    expect(verificationSql).toContain(
      "projects_over_five_reference_links",
    );
    expect(verificationSql).toContain("invalid_project_rows");
    expect(verificationSql).toContain("request_data_null_rows");
    expect(verificationSql).toContain("request_snapshot_null_rows");
    expect(verificationSql).toContain(
      "pricing_owner_groups_with_multiple_defaults",
    );
  });
});

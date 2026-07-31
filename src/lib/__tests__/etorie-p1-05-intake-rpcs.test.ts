import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTasksForType } from "@/features/natori/lib/projects";
import type { NatoriConcreteProjectType } from "@/features/natori/types/projects";

const migrationPath = path.join(
  "supabase",
  "migrations",
  "20260731115652_etorie_intake_rpcs.sql"
);
const verificationPath = path.join(
  "supabase",
  "verification",
  "etorie-p1-05-intake-rpcs-selects.sql"
);
const migration = readFileSync(migrationPath, "utf8");
const verification = readFileSync(verificationPath, "utf8");

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/--.*$/gmu, "");
}

function executableStatements(sql: string): string[] {
  return stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function withoutFunctionBodies(sql: string): string {
  return sql.replace(
    /as\s+\$function\$[\s\S]*?\$function\$/giu,
    "as $function$body omitted$function$"
  );
}

function functionDefinition(name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = migration.match(
    new RegExp(
      `create\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\$function\\$;`,
      "iu"
    )
  );
  expect(match, `${name} definition`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("Etorie P1-05 intake RPC migration", () => {
  it("uses supported JSONB key enumeration for exact object keys", () => {
    const exactKeys = functionDefinition("natori_jsonb_has_exact_keys_v1");

    expect(migration).not.toMatch(/\bjsonb_object_length\s*\(/iu);
    expect(exactKeys).toMatch(/\blanguage\s+plpgsql\b/iu);
    expect(exactKeys).toMatch(/\bimmutable\b/iu);
    expect(exactKeys).toMatch(/\bsecurity\s+invoker\b/iu);
    expect(exactKeys).toMatch(/\bset\s+search_path\s*=\s*''/iu);
    expect(exactKeys).toMatch(
      /if\s+p_value\s+is\s+null\s+or\s+p_keys\s+is\s+null\s+then\s+return\s+false;\s+end\s+if;[\s\S]*?if\s+pg_catalog\.jsonb_typeof\(p_value\)\s*<>\s*'object'\s+then\s+return\s+false;\s+end\s+if;[\s\S]*?select\s+count\(\*\)[\s\S]*?from\s+pg_catalog\.jsonb_object_keys\(p_value\)/iu
    );
    expect(exactKeys).toMatch(
      /v_key_count\s*=\s*pg_catalog\.cardinality\(p_keys\)[\s\S]*?p_value\s*\?&\s*p_keys/iu
    );
  });

  it("is one explicit transaction with no migration-time row mutation", () => {
    expect(migration).toMatch(/^\s*--[\s\S]*?\bbegin;\s/iu);
    expect(migration).toMatch(/\bcommit;\s*$/iu);

    const topLevel = withoutFunctionBodies(stripSqlComments(migration));
    expect(topLevel).not.toMatch(/\b(?:insert\s+into|update|delete\s+from)\b/iu);
    expect(topLevel).not.toMatch(/\b(?:alter|drop|truncate)\s+table\b/iu);
  });

  it("declares the exact public signatures and keeps the rollback RPC untouched", () => {
    expect(migration).toMatch(
      /create\s+function\s+public\.natori_create_project_with_tasks_v2\s*\(\s*p_user_id\s+uuid,\s*p_project_id\s+uuid,\s*p_client_name\s+text,\s*p_client_email\s+text,\s*p_request_data\s+jsonb,\s*p_reference_files\s+jsonb,\s*p_reference_links\s+jsonb\s*\)/iu
    );
    expect(migration).toMatch(
      /create\s+function\s+public\.natori_confirm_project_type_v1\s*\(\s*p_user_id\s+uuid,\s*p_project_id\s+uuid,\s*p_type\s+text\s*\)/iu
    );
    expect(migration).not.toMatch(
      /(?:create(?:\s+or\s+replace)?|drop)\s+function\s+public\.natori_create_project_with_tasks\s*\(/iu
    );
    expect(migration).not.toMatch(
      /(?:create(?:\s+or\s+replace)?|drop)\s+function\s+public\.natori_issue_quote\s*\(/iu
    );
    expect(migration).not.toMatch(/insert\s+into\s+public\.natori_quotes\b/iu);
  });

  it("keeps both RPCs definer-secured with empty paths and service-role-only execute", () => {
    for (const name of [
      "natori_create_project_with_tasks_v2",
      "natori_confirm_project_type_v1",
    ]) {
      const definition = functionDefinition(name);
      expect(definition).toMatch(/\bsecurity\s+definer\b/iu);
      expect(definition).toMatch(/\bset\s+search_path\s*=\s*''/iu);
    }

    expect(migration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_create_project_with_tasks_v2\s*\(\s*uuid,\s*uuid,\s*text,\s*text,\s*jsonb,\s*jsonb,\s*jsonb\s*\)\s*from\s+public,\s*anon,\s*authenticated,\s*service_role/iu
    );
    expect(migration).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.natori_create_project_with_tasks_v2[\s\S]*?to\s+service_role/iu
    );
    expect(migration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_confirm_project_type_v1\s*\(\s*uuid,\s*uuid,\s*text\s*\)\s*from\s+public,\s*anon,\s*authenticated,\s*service_role/iu
    );
    expect(migration).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.natori_confirm_project_type_v1[\s\S]*?to\s+service_role/iu
    );
  });

  it("validates the strict RequestData V1 contract and requester envelope", () => {
    const create = functionDefinition("natori_create_project_with_tasks_v2");
    const validate = functionDefinition("natori_request_data_is_valid_v1");

    expect(create).toContain("from auth.users");
    expect(create).toContain("invalid_client_name");
    expect(create).toContain("invalid_client_email");
    expect(create).toContain("public.natori_request_data_is_valid_v1");
    expect(validate).toContain("public.natori_jsonb_has_exact_keys_v1");
    expect(migration).toContain("pg_catalog.jsonb_object_keys(p_value)");
    expect(validate).toContain("schemaVersion");
    expect(validate).toContain("etorie-request-v1");
    expect(validate).toContain("natori-portfolio-v1");
    expect(validate).toContain("consultation");
    expect(validate).toContain("quote");
    expect(validate).toMatch(
      /v_request_type\s+not\s+in\s*\(\s*'undecided',\s*'icon',\s*'sd',\s*'standing',\s*'illustration',\s*'other'\s*\)/iu
    );
    expect(validate).toMatch(
      /v_scope\s+not\s+in\s*\(\s*'undecided',\s*'bust_up',\s*'waist_up',\s*'full_body',\s*'other'\s*\)/iu
    );
    expect(validate).not.toMatch(
      /(?:inquiryMode|v_mode)[\s\S]*?quote[\s\S]*?(?:v_request_type|v_scope)\s*=\s*'undecided'/iu
    );
    expect(validate).toContain("jsonb_array_length(p_request_data -> 'options') > 20");
    expect(validate).toContain("jsonb_array_length(p_request_data -> 'usageTypes') > 10");
    expect(validate).toContain("not between 1 and 10");
    expect(validate).toContain("9007199254740991");
    expect(validate).toContain("make_date");
    expect(validate).toContain("65536");
    expect(validate).toContain("referenceUrlsText");
  });

  it("keeps quote and consultation intake undecided, unquoted, undated, and task-free", () => {
    const create = functionDefinition("natori_create_project_with_tasks_v2");
    const projectInsert = create.match(
      /insert\s+into\s+public\.natori_projects\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)\s*on\s+conflict\s*\(\s*id\s*\)/iu
    );
    expect(projectInsert).not.toBeNull();
    const columns = (projectInsert?.[1] ?? "").split(",").map((value) => value.trim());
    const values = (projectInsert?.[2] ?? "").split(",").map((value) => value.trim());
    expect(values).toHaveLength(columns.length);
    const inserted = Object.fromEntries(columns.map((column, index) => [column, values[index]]));

    expect(inserted).toMatchObject({
      amount: "null",
      type: "'undecided'",
      status: "'inquiry'",
      due_date: "null",
    });
    expect(create).toContain("p_project_id");
    expect(create).toContain("'相談内容を確認'");
    expect(create).toContain("'内容確認・案件種別を確定'");
    expect(create).toMatch(
      /insert\s+into\s+public\.natori_inquiry_reference_files/iu
    );
    expect(create).toMatch(
      /insert\s+into\s+public\.natori_project_reference_links/iu
    );
    expect(create).not.toMatch(
      /insert\s+into\s+public\.natori_project_tasks/iu
    );
    expect(create).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("accepts only an exact same-submission retry after an id collision", () => {
    const create = functionDefinition("natori_create_project_with_tasks_v2");
    expect(create).toMatch(/on\s+conflict\s*\(\s*id\s*\)\s+do\s+nothing/iu);
    expect(create).toContain("submission_conflict");
    expect(create).toContain("projects.request_data = p_request_data");
    expect(create).toContain("jsonb_array_length(p_reference_files)");
    expect(create).toContain("jsonb_array_length(p_reference_links)");
    expect(create).toContain("reference_files.project_id <> p_project_id");
  });

  it("enforces scoped uploaded files and normalized HTTPS links at five each", () => {
    const create = functionDefinition("natori_create_project_with_tasks_v2");
    expect(create).toContain("jsonb_array_length(p_reference_files) > 5");
    expect(create).toContain("jsonb_array_length(p_reference_links) > 5");
    expect(create).toContain("natori-inquiry-refs");
    expect(create).toContain("from storage.objects");
    expect(create).toContain("p_project_id::text");
    expect(create).toContain("reference_file_already_linked");
    expect(create).toContain("duplicate_reference_link");
    expect(create).toContain("normalized_url");
    expect(create).toContain("https://");
    expect(create).toContain("position('#'");
    expect(create).toMatch(/position\(\s*'@'\s+in\s+substring/iu);
  });

  it("locks confirmation, rejects production state, and prevents duplicate tasks", () => {
    const confirm = functionDefinition("natori_confirm_project_type_v1");
    expect(confirm).toMatch(/for\s+update/iu);
    expect(confirm).toContain("projects.user_id = p_user_id");
    expect(confirm).toContain("projects.deleted_at is null");
    expect(confirm).toContain("payment_confirmed_at is not null");
    expect(confirm).toContain("'invalid_type'");
    expect(confirm).toContain("'confirmed'");
    expect(confirm).toContain("'already_confirmed'");
    expect(confirm).toContain("'not_found'");
    expect(confirm).toContain("'conflict'");
    expect(confirm).toContain("v_project.type <> 'undecided'");
    expect(confirm).toContain("v_task_count <> 0");
    expect(confirm).toContain("template.done is not distinct from tasks.done");
    expect(confirm).not.toMatch(/\bon\s+conflict\b/iu);
    expect(confirm).not.toMatch(/\bdelete\s+from\b/iu);
  });

  it("keeps the SQL task source identical to the existing application templates", () => {
    const rowPattern =
      /\('(icon|sd|standing|illustration)',\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([\d.]+)::numeric\)/gu;
    const sqlRows = [...migration.matchAll(rowPattern)].map((match) => ({
      type: match[1] as NatoriConcreteProjectType,
      sortOrder: Number(match[2]),
      taskKey: match[3],
      label: match[4],
      stage: match[5],
      estimatedHours: Number(match[6]),
    }));
    expect(sqlRows).toHaveLength(24);

    const appRows = (
      ["icon", "sd", "standing", "illustration"] as const
    ).flatMap((type) =>
      createTasksForType(type).map((task, sortOrder) => ({
        type,
        sortOrder,
        taskKey: task.id,
        label: task.label,
        stage: task.stage,
        estimatedHours: task.estimatedHours ?? null,
      }))
    );
    expect(sqlRows).toEqual(appRows);
  });
});

describe("Etorie P1-05 SELECT-only verification", () => {
  it("contains SELECT statements only and derives function owners dynamically", () => {
    expect(executableStatements(verification).every((sql) => /^select\b/iu.test(sql))).toBe(
      true
    );
    expect(verification).toContain("acl.grantee <> p.proowner");
    expect(verification).not.toMatch(/['"]postgres['"]/iu);
    expect(verification).toContain("unauthorized_intake_rpc_execute_count");
    expect(verification).toContain("service_role");
    expect(verification).toContain("empty_search_path_exact");
    expect(verification).toContain("function_body_sha256");
    expect(verification).toContain("supabase_migrations.schema_migrations");
    expect(verification).toContain("exact_key_helper_contract_ok");
  });
});

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.join("supabase", "migrations");
const migrationNames = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const activeSql = migrationNames
  .map((name) =>
    readFileSync(path.join(migrationsDirectory, name), "utf8"),
  )
  .join("\n");
const baseline = readFileSync(
  path.join(
    migrationsDirectory,
    "20260723111730_etorie_baseline.sql",
  ),
  "utf8",
);
const hardening = readFileSync(
  path.join(
    migrationsDirectory,
    "20260723111741_baseline_security_hardening.sql",
  ),
  "utf8",
);
const remainingPrivilegesName =
  "20260731111025_harden_natori_remaining_privileges.sql";
const remainingPrivileges = readFileSync(
  path.join(migrationsDirectory, remainingPrivilegesName),
  "utf8",
);
const verification = readFileSync(
  path.join(
    "supabase",
    "verification",
    "etorie-p1-04-security-selects.sql",
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

describe("Etorie P1-04 migration security contract", () => {
  it("keeps the ACL correction fifth before the P1-05 intake RPC migration", () => {
    expect(migrationNames).toEqual([
      "20260723111730_etorie_baseline.sql",
      "20260723111741_baseline_security_hardening.sql",
      "20260729115313_etorie_phase1_expand.sql",
      "20260729115323_etorie_phase1_project_constraints.sql",
      remainingPrivilegesName,
      "20260731115652_etorie_intake_rpcs.sql",
    ]);
  });

  it("does not recreate the legacy policy or any unconditional Storage write policy", () => {
    const storagePolicies = statements(activeSql).filter(
      (statement) =>
        /^create\s+policy\b/i.test(statement) &&
        /\bon\s+storage\.objects\b/i.test(statement),
    );

    expect(
      storagePolicies.some((statement) =>
        /\ballow insert 1exduyn_0\b/i.test(statement),
      ),
    ).toBe(false);
    expect(
      storagePolicies.some((statement) =>
        /\b(?:using|with\s+check)\s*\(\s*true\s*\)/i.test(
          statement,
        ),
      ),
    ).toBe(false);
    expect(
      stripSqlComments(
        "-- with check (true)\nselect 1 /* Allow Insert 1exduyn_0 */;",
      ),
    ).toBe("\nselect 1 ;");
  });

  it("preserves the approved Natori bucket privacy and validation settings", () => {
    const executable = stripSqlComments(baseline);
    expect(executable).toMatch(
      /values\s*\(\s*'natori-inquiry-refs'\s*,\s*'natori-inquiry-refs'\s*,\s*false\s*,\s*10485760\s*,\s*array\s*\[\s*'image\/jpeg'\s*,\s*'image\/png'\s*,\s*'image\/webp'\s*,\s*'image\/gif'\s*\]::text\[\]\s*\)/i,
    );
    expect(executable).toMatch(
      /values\s*\(\s*'natori-deliveries'\s*,\s*'natori-deliveries'\s*,\s*false\s*,\s*null\s*,\s*null\s*\)/i,
    );
    expect(executable).toMatch(
      /values\s*\(\s*'natori-portfolio'\s*,\s*'natori-portfolio'\s*,\s*true\s*,\s*null\s*,\s*null\s*\)/i,
    );
  });

  it("keeps processed_stripe_events client-inaccessible with only required service grants", () => {
    const executable = stripSqlComments(remainingPrivileges);
    expect(executable).toMatch(
      /revoke\s+all\s+privileges\s+on\s+table\s+public\.processed_stripe_events\s+from\s+public,\s*anon,\s*authenticated,\s*service_role\s*;/i,
    );
    const grants = [
      ...executable.matchAll(
        /grant\s+([^;]+?)\s+on\s+table\s+public\.processed_stripe_events\s+to\s+([^;]+);/gi,
      ),
    ];
    expect(grants).toHaveLength(1);
    expect(
      grants[0][1]
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .sort(),
    ).toEqual(["delete", "insert", "select"]);
    expect(grants[0][2].trim().toLowerCase()).toBe("service_role");
    expect(stripSqlComments(hardening)).toMatch(
      /alter\s+table\s+public\.processed_stripe_events\s+enable\s+row\s+level\s+security/i,
    );
    expect(statements(remainingPrivileges)).toHaveLength(4);
    expect(executable).not.toMatch(
      /\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+policy|drop\s+policy)\b/i,
    );
  });

  it("checks the final delete RPC body and ACL instead of trusting its name", () => {
    const executable = stripSqlComments(hardening);
    const definition = executable.match(
      /create\s+or\s+replace\s+function\s+public\.natori_delete_project[\s\S]*?\$\$;/i,
    )?.[0];
    const body = definition?.match(
      /as\s+\$\$([\s\S]*?)\$\$;/i,
    )?.[1];

    expect(definition).toBeDefined();
    expect(definition).toMatch(/\bsecurity\s+definer\b/i);
    expect(definition).toMatch(
      /\bset\s+search_path\s*=\s*pg_catalog\s*,\s*public\b/i,
    );
    expect(body).not.toMatch(/\bdelete\s+from\b/i);
    expect(body).toMatch(
      /deleted_at\s*=\s*coalesce\(deleted_at,\s*now\(\)\)/i,
    );
    expect(body).toMatch(
      /where\s+id\s*=\s*p_project_id\s+and\s+user_id\s*=\s*p_user_id/i,
    );
    expect(executable).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_delete_project\(uuid,\s*uuid\)\s+from\s+public,\s*anon,\s*authenticated/i,
    );
    expect(executable).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.natori_delete_project\(uuid,\s*uuid\)\s+to\s+service_role/i,
    );
  });

  it("keeps the verification artifact strictly SELECT-only", () => {
    const executable = statements(verification);
    expect(executable.length).toBeGreaterThan(0);
    expect(
      executable.every((statement) => /^select\b/i.test(statement)),
    ).toBe(true);
  });

  it("verifies exact table privileges and excludes the dynamic function owner from violations", () => {
    const executable = statements(verification);
    const exactPrivileges = executable.find((statement) =>
      statement.includes("processed_stripe_events_privileges_exact"),
    );
    const unauthorizedExecute = executable.find((statement) =>
      statement.includes("unauthorized_delete_project_execute_count"),
    );

    expect(exactPrivileges).toMatch(/\bbool_and\s*\(/i);
    expect(exactPrivileges).toMatch(/\bhas_table_privilege\s*\(/i);
    expect(exactPrivileges).toMatch(
      /values\s*\(\s*'service_role'\s*\),\s*\(\s*'anon'\s*\),\s*\(\s*'authenticated'\s*\)/i,
    );
    for (const privilege of [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
    ]) {
      expect(exactPrivileges).toContain(`'${privilege}'`);
    }
    expect(exactPrivileges).toMatch(
      /roles\.role_name\s*=\s*'service_role'[\s\S]*privileges\.privilege_name\s+in\s*\(\s*'SELECT'\s*,\s*'INSERT'\s*,\s*'DELETE'\s*\)/i,
    );
    expect(exactPrivileges).toMatch(
      /not\s+exists[\s\S]*acl\.grantee\s*=\s*0/i,
    );
    expect(exactPrivileges).not.toMatch(/role_table_grants/i);
    expect(unauthorizedExecute).toMatch(
      /acl\.grantee\s*<>\s*p\.proowner/i,
    );
    expect(unauthorizedExecute).toMatch(
      /coalesce\(pg_get_userbyid\(acl\.grantee\),\s*'PUBLIC'\)\s*<>\s*'service_role'/i,
    );
    expect(unauthorizedExecute).not.toMatch(/['"]postgres['"]/i);
  });

  it("keeps service credentials out of the browser delivery module", () => {
    const browserSource = readFileSync(
      path.join(
        "src",
        "features",
        "natori",
        "data",
        "supabaseDeliveryFiles.ts",
      ),
      "utf8",
    );
    const projectSource = readFileSync(
      path.join(
        "src",
        "features",
        "natori",
        "server",
        "projectsService.ts",
      ),
      "utf8",
    );

    expect(browserSource).toContain("uploadToSignedUrl");
    expect(browserSource).not.toContain("supabaseAdmin");
    expect(browserSource).not.toMatch(
      /SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY/i,
    );
    expect(projectSource).not.toMatch(
      /\.from\(\s*["']natori_projects["']\s*\)\s*\.delete\s*\(/i,
    );
  });
});

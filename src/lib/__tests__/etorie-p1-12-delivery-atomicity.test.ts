import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260806120330_natori_accept_delivery_rpc.sql",
  ),
  "utf8",
);
const activityMigration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260804112000_natori_project_activity.sql",
  ),
  "utf8",
);
const serviceSource = readFileSync(
  path.join("src", "features", "natori", "server", "deliveryService.ts"),
  "utf8",
);
const canonicalTypes = readFileSync(
  path.join("src", "types", "supabase.ts"),
  "utf8",
);

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

describe("Etorie P1-12 delivery acceptance contract", () => {
  const executable = stripSqlComments(migration);

  it("locks the token-owned project before validating mutable state", () => {
    expect(executable).toMatch(
      /select\s+projects\.\*\s+into\s+v_project[\s\S]*delivery_token_hash\s*=\s*p_token_hash[\s\S]*for\s+update\s*;/i,
    );
    expect(executable).toMatch(/p_token_hash\s*!~\s*'\^\[0-9a-f\]\{64\}\$'/i);

    const lockIndex = executable.indexOf("for update;");
    const clockIndex = executable.indexOf("v_now := clock_timestamp();");
    expect(lockIndex).toBeGreaterThan(-1);
    expect(clockIndex).toBeGreaterThan(lockIndex);
  });

  it("makes an accepted retry idempotent before checking token expiry", () => {
    const retryIndex = executable.indexOf("v_project.delivery_accepted_at is not null");
    const expiryIndex = executable.indexOf("v_project.delivery_token_expires_at is null");

    expect(retryIndex).toBeGreaterThan(-1);
    expect(expiryIndex).toBeGreaterThan(retryIndex);
    expect(executable).toContain("'already-accepted'::text");
  });

  it("revalidates active, paid, unexpired, newly delivered state", () => {
    expect(executable).toMatch(/v_project\.deleted_at\s+is\s+not\s+null/i);
    expect(executable).toMatch(/v_project\.payment_confirmed_at\s+is\s+null/i);
    expect(executable).toMatch(
      /v_project\.delivery_token_expires_at\s+is\s+null[\s\S]*v_project\.delivery_token_expires_at\s*<=\s*v_now/i,
    );
    expect(executable).toMatch(/v_project\.status\s*<>\s*'delivered'/i);
    expect(executable).toMatch(/v_project\.delivered_mail_at\s+is\s+null/i);
    expect(executable).toMatch(/v_project\.completed_at\s+is\s+not\s+null/i);
  });

  it("sets both timestamps and completed state in one project update", () => {
    const projectUpdates = [
      ...executable.matchAll(/update\s+public\.natori_projects[\s\S]*?;/gi),
    ].map((match) => match[0]);

    expect(projectUpdates).toHaveLength(1);
    expect(projectUpdates[0]).toMatch(/delivery_accepted_at\s*=\s*v_now/i);
    expect(projectUpdates[0]).toMatch(/completed_at\s*=\s*v_now/i);
    expect(projectUpdates[0]).toMatch(/status\s*=\s*'completed'/i);
    expect(projectUpdates[0]).toMatch(/next_action\s*=\s*'完了'/i);
    expect(projectUpdates[0]).not.toMatch(/\bnote\s*=/i);
  });

  it("records delivery activity in the same transaction through the P1-10 trigger", () => {
    const activityExecutable = stripSqlComments(activityMigration);
    expect(activityExecutable).toMatch(
      /after\s+update\s+of\s+delivered_mail_at\s*,\s*delivery_accepted_at\s+on\s+public\.natori_projects/i,
    );
    expect(activityExecutable).toMatch(
      /new\.delivery_accepted_at\s+is\s+not\s+null[\s\S]*insert\s+into\s+public\.natori_project_activity/i,
    );
  });

  it("is a service-role-only invoker RPC with an empty search path", () => {
    expect(executable).toMatch(
      /create\s+function\s+public\.natori_accept_delivery_v1\s*\(\s*p_token_hash\s+text\s*\)[\s\S]*security\s+invoker[\s\S]*set\s+search_path\s*=\s*''/i,
    );
    expect(executable).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.natori_accept_delivery_v1\(text\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i,
    );
    expect(executable).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.natori_accept_delivery_v1\(text\)\s+to\s+service_role/i,
    );
  });

  it("uses the RPC instead of a multi-step application update", () => {
    expect(serviceSource).toContain('.rpc("natori_accept_delivery_v1"');
    expect(serviceSource).not.toMatch(
      /acceptNatoriDelivery[\s\S]*\.from\("natori_projects"\)[\s\S]*\.update\(/,
    );
    expect(canonicalTypes).toMatch(
      /natori_accept_delivery_v1:\s*\{[\s\S]*Args:\s*\{\s*p_token_hash:\s*string\s*\}[\s\S]*project_title:\s*string[\s\S]*result:\s*string/i,
    );
  });
});

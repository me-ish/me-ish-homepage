import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260801234935_etorie_quote_snapshots_retry.sql"
  ),
  "utf8"
);

function functionDefinition(name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = migration.match(
    new RegExp(
      `create\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\$\\$;`,
      "iu"
    )
  );
  expect(match, `${name} definition`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("Etorie P1-09 quote snapshot migration", () => {
  it("adds nullable snapshot and idempotency columns without backfill", () => {
    expect(migration).toMatch(/add\s+column\s+if\s+not\s+exists\s+request_snapshot\s+jsonb/iu);
    expect(migration).toMatch(/add\s+column\s+if\s+not\s+exists\s+pricing_snapshot\s+jsonb/iu);
    expect(migration).toMatch(/add\s+column\s+if\s+not\s+exists\s+idempotency_key\s+text/iu);
    expect(migration).toMatch(/add\s+column\s+if\s+not\s+exists\s+issued_at\s+timestamptz/iu);
    expect(migration).not.toMatch(/update\s+public\.natori_quotes\s+set\s+(?:request_snapshot|pricing_snapshot|issued_at)/iu);
  });

  it("uses project-scoped idempotency and preserves the legacy issue RPC", () => {
    expect(migration).toMatch(
      /create\s+unique\s+index[\s\S]*?on\s+public\.natori_quotes\s*\(\s*project_id\s*,\s*idempotency_key\s*\)[\s\S]*?where\s+idempotency_key\s+is\s+not\s+null/iu
    );
    expect(migration).not.toMatch(
      /(?:create(?:\s+or\s+replace)?|drop)\s+function\s+public\.natori_issue_quote\s*\(/iu
    );
  });

  it("makes P1-09 quote contract fields immutable while allowing state timestamps", () => {
    const guard = functionDefinition("guard_natori_quote_snapshot_immutability");
    for (const column of [
      "project_id",
      "user_id",
      "version",
      "title",
      "client_name",
      "to_email",
      "amount",
      "subject",
      "body_snapshot",
      "token_hash",
      "expires_at",
      "request_snapshot",
      "pricing_snapshot",
      "idempotency_key",
      "issued_at",
      "created_at",
    ]) {
      expect(guard).toMatch(new RegExp(`new\\.${column}\\s+is\\s+distinct\\s+from\\s+old\\.${column}`, "iu"));
    }
    expect(guard).not.toMatch(/new\.accepted_at\s+is\s+distinct/iu);
    expect(guard).not.toMatch(/new\.superseded_at\s+is\s+distinct/iu);
  });

  it("locks the project and validates ownership, archive, payment, type, and state", () => {
    const issue = functionDefinition("natori_issue_quote_v1");
    expect(issue).toMatch(/from\s+public\.natori_projects[\s\S]*?where\s+id\s*=\s*p_project_id\s+and\s+user_id\s*=\s*p_user_id[\s\S]*?for\s+update/iu);
    expect(issue).toMatch(/v_project\.deleted_at\s+is\s+not\s+null[\s\S]*?project_archived/iu);
    expect(issue).toMatch(/v_project\.payment_confirmed_at\s+is\s+not\s+null[\s\S]*?project_already_paid/iu);
    expect(issue).toMatch(/v_project\.type\s*=\s*'undecided'[\s\S]*?project_type_undecided/iu);
    expect(issue).toMatch(/v_project\.status\s+not\s+in\s*\(\s*'inquiry',\s*'consulting',\s*'estimating',\s*'quoted'/iu);
  });

  it("guards totals, item arithmetic, request parity, and review resolution", () => {
    const issue = functionDefinition("natori_issue_quote_v1");
    expect(issue).toMatch(/p_pricing_snapshot->>'total'\)::numeric\s*<>\s*p_amount/iu);
    expect(issue).toMatch(/quote_item_total_mismatch/iu);
    expect(issue).toMatch(/invalid_quote_item/iu);
    expect(issue).toMatch(/p_request_snapshot\s+is\s+distinct\s+from\s+v_project\.request_data/iu);
    expect(issue).toMatch(/unresolved_review_item/iu);
    expect(issue).toMatch(/orphan_review_resolution/iu);
  });

  it("returns an existing identical issue request and rejects conflicting reuse", () => {
    const issue = functionDefinition("natori_issue_quote_v1");
    expect(issue).toMatch(/where\s+project_id\s*=\s*p_project_id[\s\S]*?idempotency_key\s*=\s*p_idempotency_key/iu);
    expect(issue).toMatch(/raise\s+exception\s+'idempotency_conflict'/iu);
    expect(issue).toMatch(/return\s+query\s+select\s+v_existing\.id,\s*v_existing\.version,\s*true/iu);
  });

  it("atomically supersedes, versions, inserts, and advances the active quote pointer", () => {
    const issue = functionDefinition("natori_issue_quote_v1");
    expect(issue).toMatch(/update\s+public\.natori_quotes[\s\S]*?set\s+superseded_at/iu);
    expect(issue).toMatch(/coalesce\(max\(q\.version\),\s*0\)\s*\+\s*1/iu);
    expect(issue).toMatch(/insert\s+into\s+public\.natori_quotes/iu);
    expect(issue).toMatch(/update\s+public\.natori_projects[\s\S]*?active_quote_id\s*=\s*v_quote_id/iu);
  });

  it("keeps the RPC service-role only with an empty search path", () => {
    const issue = functionDefinition("natori_issue_quote_v1");
    expect(issue).toMatch(/security\s+definer/iu);
    expect(issue).toMatch(/set\s+search_path\s*=\s*''/iu);
    expect(migration).toMatch(/revoke\s+all\s+on\s+function\s+public\.natori_issue_quote_v1[\s\S]*?from\s+public,\s*anon,\s*authenticated/iu);
    expect(migration).toMatch(/grant\s+execute\s+on\s+function\s+public\.natori_issue_quote_v1[\s\S]*?to\s+service_role/iu);
  });
});

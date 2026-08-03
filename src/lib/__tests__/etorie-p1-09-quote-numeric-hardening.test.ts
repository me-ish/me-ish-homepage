import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260802002947_harden_quote_snapshot_numeric_validation.sql"
  ),
  "utf8"
);

describe("Etorie P1-09 numeric snapshot hardening", () => {
  it("checks JSON numeric types and lexical form before casting total", () => {
    expect(migration).toMatch(
      /jsonb_typeof\(p_pricing_snapshot->'total'\)\s*<>\s*'number'/iu
    );
    expect(migration).toMatch(/v_total_text\s*!~\s*'\^\[0-9\]\+\$'/iu);
    expect(migration).toMatch(/char_length\(v_total_text\)\s*>\s*10/iu);
    expect(migration).toMatch(/v_total_text::numeric\s*>\s*2147483647/iu);
    expect(migration).toMatch(/v_total_text::integer\s*<>\s*p_amount/iu);
  });

  it("performs a cast-free item shape pass before arithmetic", () => {
    const firstPass = migration.match(
      /select\s+count\(\*\)[\s\S]*?into\s+v_invalid_item_count[\s\S]*?from\s+jsonb_array_elements\(p_pricing_snapshot->'items'\)[\s\S]*?;/iu
    )?.[0];
    expect(firstPass).toBeTruthy();
    expect(firstPass).toMatch(/jsonb_typeof\(item->'quantity'\)\s*<>\s*'number'/iu);
    expect(firstPass).toMatch(/jsonb_typeof\(item->'unitAmount'\)\s*<>\s*'number'/iu);
    expect(firstPass).toMatch(/jsonb_typeof\(item->'amount'\)\s*<>\s*'number'/iu);
    expect(firstPass).toMatch(/coalesce\(item->>'quantity',\s*''\)\s*!~/iu);
    expect(firstPass).not.toMatch(/::(?:integer|bigint|numeric)/iu);
  });

  it("rejects malformed items before the cast-based arithmetic pass", () => {
    const guardIndex = migration.indexOf("raise exception 'invalid_quote_item'");
    const arithmeticIndex = migration.indexOf("coalesce(sum((item->>'amount')::bigint)");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(arithmeticIndex).toBeGreaterThan(guardIndex);
    expect(migration).toMatch(/\(item->>'quantity'\)::integer\s+not\s+between\s+1\s+and\s+100/iu);
    expect(migration).toMatch(/quote_item_total_mismatch/iu);
  });

  it("retains service-role-only execution", () => {
    expect(migration).toMatch(/security\s+definer/iu);
    expect(migration).toMatch(/set\s+search_path\s*=\s*''/iu);
    expect(migration).toMatch(/revoke\s+all[\s\S]*?from\s+public,\s*anon,\s*authenticated/iu);
    expect(migration).toMatch(/grant\s+execute[\s\S]*?to\s+service_role/iu);
  });
});

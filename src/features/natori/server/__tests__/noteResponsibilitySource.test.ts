import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(
    "supabase",
    "migrations",
    "20260805192000_stop_natori_note_machine_logs.sql",
  ),
  "utf8",
);

describe("natori project note responsibility", () => {
  it("keeps lifecycle history out of administrator notes", () => {
    expect(migration).toContain("natori_preserve_human_note_v1");
    expect(migration).toContain("natori_projects_preserve_human_note_v1");
    expect(migration).toMatch(/見積もりメール送信/u);
    expect(migration).toMatch(/支払い依頼メール送信/u);
    expect(migration).toMatch(/ラフ提出メール送信/u);
    expect(migration).toMatch(/納品メール送信/u);
    expect(migration).toMatch(/納品受け取り確認/u);
    expect(migration).toContain("new.note := old.note");
  });

  it("does not expose the compatibility trigger function to browser roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.natori_preserve_human_note_v1\(\) from anon;/u,
    );
    expect(migration).toMatch(
      /revoke all on function public\.natori_preserve_human_note_v1\(\) from authenticated;/u,
    );
  });
});

import { describe, expect, it } from "vitest";
import { buildNatoriResultsCsv } from "@/features/natori/lib/results";
import type { NatoriProject } from "@/features/natori/types/projects";

function makeProject(overrides: Partial<NatoriProject>): NatoriProject {
  return {
    id: "p1",
    title: "全身立ち絵",
    clientName: "ゆきうさぎ",
    amount: 24000,
    dueDate: "2026-07-01",
    status: "completed",
    nextAction: "-",
    type: "standing",
    tasks: [],
    ...overrides,
  };
}

describe("buildNatoriResultsCsv", () => {
  it("BOM付き・CRLF区切りで、ヘッダーと行を出力する", () => {
    const csv = buildNatoriResultsCsv([makeProject({})]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("納期,依頼者,件名,種類,金額(円),ステータス");
    expect(lines[1]).toBe("2026-07-01,ゆきうさぎ,全身立ち絵,立ち絵,24000,対応完了");
  });

  it("納期の新しい順に並ぶ", () => {
    const csv = buildNatoriResultsCsv([
      makeProject({ id: "old", title: "古い", dueDate: "2026-05-01" }),
      makeProject({ id: "new", title: "新しい", dueDate: "2026-07-01" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toContain("新しい");
    expect(lines[2]).toContain("古い");
  });

  it("カンマ・引用符・改行を含むセルをエスケープする", () => {
    const csv = buildNatoriResultsCsv([
      makeProject({ title: 'A,B"C', clientName: "行1\n行2" }),
    ]);
    expect(csv).toContain('"A,B""C"');
    expect(csv).toContain('"行1\n行2"');
  });
});

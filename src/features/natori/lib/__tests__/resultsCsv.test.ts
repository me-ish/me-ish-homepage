import { describe, expect, it } from "vitest";
import { buildNatoriResultsCsv } from "@/features/natori/lib/results";
import type { NatoriProject } from "@/features/natori/types/projects";

function makeProject(overrides: Partial<NatoriProject>): NatoriProject {
  const resultAt = `${overrides.dueDate ?? "2026-07-01"}T00:00:00.000Z`;
  return {
    id: "p1",
    title: "全身立ち絵",
    clientName: "ゆきうさぎ",
    amount: 24000,
    dueDate: "2026-07-01",
    paidAt: resultAt,
    paidAmount: 24000,
    completedAt: resultAt,
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
    expect(lines[0]).toBe("完了日,依頼者,件名,種類,入金額(円),ステータス");
    expect(lines[1]).toBe("2026-07-01,ゆきうさぎ,全身立ち絵,立ち絵,24000,対応完了");
  });

  it("完了日の新しい順に並ぶ", () => {
    const csv = buildNatoriResultsCsv([
      makeProject({ id: "old", title: "古い", dueDate: "2026-05-01", paidAt: "2026-05-01T00:00:00.000Z", completedAt: "2026-05-01T00:00:00.000Z" }),
      makeProject({ id: "new", title: "新しい", dueDate: "2026-07-01", paidAt: "2026-07-01T00:00:00.000Z", completedAt: "2026-07-01T00:00:00.000Z" }),
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

  it("金額未定・無料・種別未定を区別して出力する", () => {
    const csv = buildNatoriResultsCsv([
      makeProject({ id: "unknown", amount: null, paidAmount: undefined, type: "undecided" }),
      makeProject({ id: "free", amount: 0, paidAmount: undefined, type: "icon" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines.some((line) => line.includes(",未定,未定,対応完了"))).toBe(true);
    expect(lines.some((line) => line.includes(",アイコン,0,対応完了"))).toBe(true);
    expect(csv).not.toContain(",null,");
  });

  it("アーカイブ済み案件を出力しない", () => {
    const csv = buildNatoriResultsCsv([
      makeProject({ id: "active", title: "表示する" }),
      makeProject({
        id: "archived",
        title: "表示しない",
        deletedAt: "2026-07-01T00:00:00.000Z",
      }),
    ]);
    expect(csv).toContain("表示する");
    expect(csv).not.toContain("表示しない");
  });
});

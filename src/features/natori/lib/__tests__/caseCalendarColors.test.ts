import { describe, expect, it } from "vitest";
import { caseCalendarColors, CASE_CALENDAR_COLORS } from "../caseCalendarColors";
import type { NatoriCalendarBar } from "../../types/projects";

const bar = (projectId: string, title: string, stage: NatoriCalendarBar["stage"], startISO: string, endISO: string) =>
  ({ id: `${projectId}-${stage}`, project: { id: projectId, title }, stage, startISO, endISO }) as unknown as NatoriCalendarBar;

describe("caseCalendarColors", () => {
  it("gives every case its own colour in order of its first bar and keeps one colour across its stages", () => {
    const colors = caseCalendarColors([
      bar("b", "雲のアイコン", "lineart", "2026-11-10", "2026-11-13"),
      bar("a", "森の表紙", "rough", "2026-11-09", "2026-11-11"),
      bar("a", "森の表紙", "lineart", "2026-11-12", "2026-11-14"),
    ]);
    expect([...colors.keys()]).toEqual(["a", "b"]);
    expect(colors.get("a")).toEqual({ color: CASE_CALENDAR_COLORS[0], title: "森の表紙" });
    expect(colors.get("b")?.color).toBe(CASE_CALENDAR_COLORS[1]);
  });
});

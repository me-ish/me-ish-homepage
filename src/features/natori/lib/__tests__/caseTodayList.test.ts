import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { caseTodayDue, deriveCaseTodayList } from "../caseTodayList";
import { matchesCaseEntry } from "../caseWorkspaceEntries";
import { parseCaseWorkspaceLocation } from "../caseWorkspaceNavigation";
import { deriveCaseGuidance } from "../caseWorkspacePresentation";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";

let records: CaseWorkspaceRecord[];
beforeAll(async () => { records = await buildPreviewRecords(); });
const withDue = (record: CaseWorkspaceRecord, registeredDueDate: string | null): CaseWorkspaceRecord => ({ ...record, registeredDueDate });

it("lists exactly the 自分の番 cases, nearest due date first, with each case's own next step", () => {
  const today = "2026-10-20";
  const list = deriveCaseTodayList(records, today);
  const staff = records.filter(r => matchesCaseEntry(r, parseCaseWorkspaceLocation("?entry=cases&filter=staff", today), null, today));
  expect(list.map(item => item.id).sort()).toEqual(staff.map(r => r.id).sort());
  expect(list.map(item => [item.title, item.action, item.due.label])).toEqual([
    ["雨上がりのラフ", "ラフにOKが出たので制作を進める", "今日まで"],
    ["雲のアイコン", "制作を進める", "あと3日"],
    ["森の表紙イラスト", "支払いリンクを送る", "あと23日"],
  ]);
  // 開く画面は、案件を開いた時の「次にやること」と同じ。
  for (const item of list) expect(item.section).toBe(deriveCaseGuidance(records.find(r => r.id === item.id)!).primary.section);
});

it("writes the due date in words, not only colour, and puts cases without a due date last", () => {
  const production = records.find(r => r.title === "雲のアイコン")!;
  expect(caseTodayDue(withDue(production, "2026-10-17"), "2026-10-20")).toMatchObject({ label: "3日超過", tone: "overdue" });
  expect(caseTodayDue(withDue(production, "2026-10-21"), "2026-10-20")).toMatchObject({ label: "明日まで", tone: "soon" });
  expect(caseTodayDue(withDue(production, null), "2026-10-20")).toEqual({ label: "納期なし", date: null, tone: "none" });
  const list = deriveCaseTodayList(records.map(r => r.id === production.id ? withDue(r, null) : r), "2026-10-20");
  expect(list.at(-1)?.title).toBe("雲のアイコン");
});

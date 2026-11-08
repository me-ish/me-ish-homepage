import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { caseTodayDue } from "../caseTodayList";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";

let records: CaseWorkspaceRecord[];
beforeAll(async () => { records = await buildPreviewRecords(); });
const withDue = (record: CaseWorkspaceRecord, registeredDueDate: string | null): CaseWorkspaceRecord => ({ ...record, registeredDueDate });

it("writes the due date in words, not only colour", () => {
  const production = records.find(r => r.title === "雲のアイコン")!;
  expect(caseTodayDue(withDue(production, "2026-10-17"), "2026-10-20")).toMatchObject({ label: "3日超過", tone: "overdue" });
  expect(caseTodayDue(withDue(production, "2026-10-20"), "2026-10-20")).toMatchObject({ label: "今日まで", tone: "soon" });
  expect(caseTodayDue(withDue(production, "2026-10-21"), "2026-10-20")).toMatchObject({ label: "明日まで", tone: "soon" });
  expect(caseTodayDue(withDue(production, "2026-11-12"), "2026-10-20")).toMatchObject({ label: "あと23日", tone: "later" });
  expect(caseTodayDue(withDue(production, null), "2026-10-20")).toEqual({ label: "納期なし", date: null, tone: "none" });
});

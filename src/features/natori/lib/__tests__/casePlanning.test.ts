import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";
import type { CasePlanning } from "../../lib/caseScreenContext";
import {
  casePlanProject,
  casePlannedBars,
  casePriority,
} from "../../lib/casePlanning";
import {
  caseWorkspaceHref,
  parseCaseWorkspaceLocation,
} from "../../lib/caseWorkspaceNavigation";
import { matchesCaseEntry } from "../../lib/caseWorkspaceEntries";
import {sameCaseSourceTime} from "../../lib/caseSourceTime";
let record: CaseWorkspaceRecord, plans: CasePlanning;
beforeAll(async () => {
  const rows = await buildPreviewRecords();
  record = structuredClone(
    rows.find(
      (r) =>
        r.model.facts.payment.state === "ready" &&
        r.model.facts.project.state === "ready" &&
        r.display.tasks.state === "ready",
    )!,
  );
  if (!record) throw Error("paid fixture required");
  record.registeredDueDate = "2026-11-05";
  record.model.eligibility = "active";
  const fact = record.model.facts.project;
  if (fact.state !== "ready" || record.display.tasks.state !== "ready")
    throw Error("fixture");
  fact.value.rawStatus = "rough";
  plans = [
    {
      id: record.id,
      updatedAt: fact.value.recordedAt,
      startDate: "2026-10-20",
      dueDate: record.registeredDueDate,
      deliveryPlan: "normal",
      priority: "high",
      status: "rough",
      type: fact.value.type,
      archivedAt: null,
      tasks: record.display.tasks.value.map((t) => ({
        ...t,
        label: t.stage,
        estimatedHours: null,
      })),
    },
  ];
});
it("uses matching owner-bound project/task evidence and keeps date metadata out of business facts", () => {
  const before = JSON.stringify(record);
  expect(casePlanProject(record, plans)).not.toBeNull();
  expect(casePlannedBars(record, plans, "2026-10-22").length).toBeGreaterThan(
    0,
  );
  expect(JSON.stringify(record)).toBe(before);
});
it("does not manufacture work plans from raw rough, unknown payment, ended state or stale source", () => {
  const unpaid = structuredClone(record);
  unpaid.model.facts.payment = { state: "unavailable", reason: "read_failed" };
  expect(casePlannedBars(unpaid, plans, "2026-10-22")).toEqual([]);
  const ended = structuredClone(record);
  ended.model.eligibility = "completed";
  expect(casePlannedBars(ended, plans, "2026-10-22")).toEqual([]);
  const stale = structuredClone(plans);
  stale[0].updatedAt = "2000-01-01T00:00:00Z";
  expect(casePlanProject(record, stale)).toBeNull();
  const changed = structuredClone(plans);
  changed[0].tasks[0].done = !changed[0].tasks[0].done;
  expect(casePlanProject(record, changed)).toBeNull();
});
it("finds a case on a planned day across the month boundary without calling it due or paid", () => {
  const bars = casePlannedBars(record, plans, "2026-10-22"),
    date = bars[0].startISO;
  const nav = parseCaseWorkspaceLocation(`?entry=schedule&date=${date}`);
  expect(matchesCaseEntry(record, nav, plans, "2026-10-22")).toBe(true);
  expect(date).not.toBe(record.registeredDueDate);
  expect(matchesCaseEntry(record, nav, null, "2026-10-22")).toBe(false);
});
it("uses common guidance rather than legacy waiting labels for priority reasons", () => {
  const priority = casePriority(record, plans, "2026-10-22");
  expect(priority?.reasons.join(" ")).toContain("登録納期まで");
  expect(priority?.reasons.join(" ")).not.toContain("見積もり提示済み");
  expect(casePriority(record, null, "2026-10-22")).toBeNull();
});
it("rejects different PostgreSQL microsecond versions without losing timezone equivalence",()=>{
 expect(sameCaseSourceTime('2026-10-22T00:00:00.123001Z','2026-10-22T00:00:00.123999Z')).toBe(false);
 expect(sameCaseSourceTime('2026-10-22T09:00:00.123001+09:00','2026-10-22T00:00:00.1230010Z')).toBe(true);
 const r=structuredClone(record),p=structuredClone(plans);if(r.model.facts.project.state!=="ready")throw Error('fixture');
 r.model.facts.project.value.recordedAt='2026-10-22T00:00:00.123999Z';p[0].updatedAt='2026-10-22T00:00:00.123001Z';expect(casePlanProject(r,p)).toBeNull();
});
it("preserves legacy ended/attention conditions instead of silently reverting to all cases",()=>{
 const nav=parseCaseWorkspaceLocation('?source=inquiries&filter=ended&view=conversation');expect(nav.intakeFilter).toBe('ended');
 expect(matchesCaseEntry(record,nav)).toBe(false);const ended=structuredClone(record);ended.model.eligibility='archived';expect(matchesCaseEntry(ended,nav)).toBe(true);
 expect(matchesCaseEntry(ended,parseCaseWorkspaceLocation('?source=inquiries'))).toBe(false);
 const href=caseWorkspaceHref(nav);expect(parseCaseWorkspaceLocation(href.split('?')[1]).intakeFilter).toBe('ended');
});
it("restores legacy project/inquiry bookmarks and conversation after browser back",()=>{
 expect(parseCaseWorkspaceLocation(`?project=${record.id}&view=conversation&filter=ended`)).toMatchObject({projectId:record.id,section:'consultation',intakeFilter:'ended'});
 expect(parseCaseWorkspaceLocation(`?inquiry=${record.id}`).projectId).toBe(record.id);
});
it("round trips the fixed source/sort/utility and case return state without arbitrary URLs", () => {
  const nav = parseCaseWorkspaceLocation(
    `?entry=schedule&source=estimate&sort=priority&utility=settings&case=${record.id}&q=森&date=2026-10-31&month=2026-11&page=2&return=https://evil.invalid`,
  );
  const href = caseWorkspaceHref(nav, "/natori/dashboard/cases");
  expect(parseCaseWorkspaceLocation(href.split("?")[1])).toEqual(nav);
  expect(href).not.toContain("evil");
  expect(
    parseCaseWorkspaceLocation(
      "?source=https://evil.invalid&sort=arbitrary&utility=admin",
    ),
  ).toMatchObject({ source: "all", sort: "default", utility: "none" });
});

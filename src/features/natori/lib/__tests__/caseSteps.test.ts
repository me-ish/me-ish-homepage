import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { caseStepForSection, deriveCaseSteps } from "../caseSteps";
import type { CaseWorkspaceRecord } from "../../types/caseWorkspace";

let records: CaseWorkspaceRecord[];
beforeAll(async () => { records = await buildPreviewRecords(); });
const current = (record: CaseWorkspaceRecord) => deriveCaseSteps(record).find(step => step.state === "current")?.key ?? null;
const withProject = (record: CaseWorkspaceRecord, patch: Record<string, unknown>): CaseWorkspaceRecord => {
  const project = record.display.project;
  if (project.state !== "ready") throw Error("project fixture required");
  return { ...record, display: { ...record.display, project: { ...project, value: { ...project.value, ...patch } } } };
};

it("places each fixture at the step its recorded facts reach", () => {
  expect(records.map(record => [record.title, current(record)])).toEqual([
    ["森の表紙イラスト", "payment"], ["星の立ち絵", "receipt"], ["雲のアイコン", "production"], ["小さな庭の挿絵", null],
    ["月のプロフィール画像", "quote"], ["雨上がりのラフ", "production"], ["窓辺のポスター", "payment"], ["光のカードイラスト", null],
  ]);
  expect(deriveCaseSteps(records[3]).every(step => step.state === "done")).toBe(true);
  expect(deriveCaseSteps(records[0]).find(step => step.key === "quote")?.summary).toBe("￥40,000でOK（2回目の見積）");
});

it("has no current step for a closed or archived case and keeps unreached steps upcoming", () => {
  for (const patch of [{ rawStatus: "closed" }, { archivedAt: "2026-10-20T00:00:00Z" }]) {
    const steps = deriveCaseSteps(withProject(records[4], patch));
    expect(steps.some(step => step.state === "current")).toBe(false);
    expect(steps.map(step => step.state)).toEqual(["done", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
  }
});

it("does not treat an unread quote as an earlier consultation stage", () => {
  const original = records[4];
  const record = { ...original, model: { ...original.model, facts: { ...original.model.facts, quote: { state: "unavailable" as const, reason: "read_failed" as const } } } };
  const quote = deriveCaseSteps(record).find(step => step.key === "quote");
  expect(quote).toMatchObject({ state: "current", summary: "読み込めませんでした" });
});

it("opens the current step for a shared area, otherwise the latest finished one", () => {
  const paying = deriveCaseSteps(records[0]), receiving = deriveCaseSteps(records[1]);
  expect(caseStepForSection(paying, "transaction")).toBe("payment");
  expect(caseStepForSection(receiving, "production")).toBe("receipt");
  expect(caseStepForSection(deriveCaseSteps(records[3]), "transaction")).toBe("payment");
  expect(caseStepForSection(paying, "history")).toBeNull();
  expect(caseStepForSection(paying, "overview")).toBeNull();
});

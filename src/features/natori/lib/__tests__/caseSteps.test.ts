import { beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPreviewRecords } from "../../../../../scripts/natori-case-preview/fixtureReader";
import { caseStepForSection, deriveCaseSteps } from "../caseSteps";
import { deriveCaseGuidance } from "../caseWorkspacePresentation";
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

const externalCase = (patch: Record<string, unknown> = {}, extra: (r: CaseWorkspaceRecord) => CaseWorkspaceRecord = r => r): CaseWorkspaceRecord => {
  const base = records[4], project = base.model.facts.project;
  if (project.state !== "ready") throw Error("project fixture required");
  const absent = { state: "absent" as const, snapshotId: base.model.snapshotId, observedAt: base.model.checkedAt, revision: "absent" };
  return extra({ ...base, model: { ...base.model, facts: { ...base.model.facts, quote: absent, link: absent,
    project: { ...project, value: { ...project.value, origin: "external" as const, administrativeAmount: null, ...patch } } } } });
};

it("gives orders taken outside the site their own steps without quote or 受け取り", () => {
  const steps = deriveCaseSteps(externalCase());
  expect(steps.map(step => step.label)).toEqual(["依頼", "金額・入金", "制作", "納品", "完了"]);
  expect(steps.map(step => step.state)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
  expect(steps.find(step => step.key === "quote")?.summary).toBe("金額はまだ");
  const priced = deriveCaseSteps(externalCase({ administrativeAmount: { amount: 8000, currency: "JPY" } }));
  expect(priced.find(step => step.key === "quote")?.summary).toBe("￥8,000・入金はまだ");
  const done = deriveCaseSteps(externalCase({ rawStatus: "completed" }));
  expect(done.every(step => step.state === "done")).toBe(true);
  const delivered = deriveCaseSteps(externalCase({ rawStatus: "delivered" }));
  expect(delivered.find(step => step.state === "current")?.key).toBe("receipt");
});

it("goes back to the site's steps once a hand-registered case has a quote", () => {
  const withQuote = externalCase({}, r => ({ ...r, model: { ...r.model, facts: { ...r.model.facts, quote: records[0].model.facts.quote } } }));
  expect(deriveCaseSteps(withQuote).map(step => step.label)).toEqual(["相談", "見積", "支払い", "制作", "納品", "受取"]);
});

it("keeps the outside-order steps while the quote is only an unsent draft", () => {
  const draft = externalCase({}, r => ({ ...r, model: { ...r.model, facts: { ...r.model.facts,
    quote: { state: "unavailable" as const, reason: "unsupported" as const, snapshotId: r.model.snapshotId, observedAt: r.model.checkedAt } } } }));
  expect(deriveCaseSteps(draft).map(step => step.label)).toEqual(["依頼", "金額・入金", "制作", "納品", "完了"]);
});

it("does not ask to finish a quote draft on a case agreed outside the site", () => {
  const draftQuote = (r: CaseWorkspaceRecord): CaseWorkspaceRecord => ({ ...r, model: { ...r.model, facts: { ...r.model.facts,
    quote: { state: "unavailable" as const, reason: "unsupported" as const } } } });
  const texts = (r: CaseWorkspaceRecord) => deriveCaseGuidance(r).waits.map(wait => wait.text);
  expect(texts(externalCase({}, draftQuote))).not.toContain("見積の下書きを仕上げて送る");
  // A site case with the same draft still gets the reminder.
  expect(texts(externalCase({ origin: "internal" }, draftQuote))).toContain("見積の下書きを仕上げて送る");
});

it("puts each step's 要確認 under the step itself, from the same facts as the records", () => {
  for (const record of records) {
    const steps = deriveCaseSteps(record);
    const delivery = record.model.facts.delivery.state === "ready" ? record.model.facts.delivery.value : null;
    const step = steps.find(item => item.key === "delivery");
    expect(step?.needsCheck ?? null).toBe(delivery && delivery.manifest !== "verified" ? "納品ファイルの記録が足りません" : null);
    // The summary no longer ends with a bare 「要確認」; the badge says it instead.
    expect(steps.every(item => !item.summary?.endsWith("要確認"))).toBe(true);
  }
});

it("advances the tail steps from hand-recorded off-system delivery and receipt", () => {
  const producing = records[2]; // 雲のアイコン: payment recorded, still in production, no delivery fact.
  const delivered = { ...producing, manualProgress: { delivery: "2026-11-09T10:00:00+09:00", receipt: null } };
  const deliverySteps = deriveCaseSteps(delivered);
  expect(deliverySteps.find(step => step.key === "delivery")).toMatchObject({ state: "done", summary: "手入力で完了（11/9 10:00）" });
  expect(current(delivered)).toBe("receipt");
  expect(deriveCaseGuidance(delivered).status).toBe("納品済み・受取待ち");

  const received = { ...delivered, manualProgress: { delivery: "2026-11-09T10:00:00+09:00", receipt: "2026-11-10T15:30:00+09:00" } };
  const receiptSteps = deriveCaseSteps(received);
  expect(receiptSteps.every(step => step.state === "done")).toBe(true);
  expect(receiptSteps.find(step => step.key === "receipt")?.summary).toBe("手入力で完了（11/10 15:30）");
  const guidance = deriveCaseGuidance(received);
  expect(guidance.status).toBe("受取済み");
  expect(guidance.facts.find(fact => fact.label === "受取")?.value).toBe("手入力で完了（11/10 15:30）");
  expect(guidance.waits.map(wait => wait.text)).not.toContain("制作を進める");
});

it("lets a hand-recorded receipt finish a delivered case without replacing the delivery fact", () => {
  const deliveredCase = records[1]; // 星の立ち絵: delivery fact exists, receipt pending.
  const received = { ...deliveredCase, manualProgress: { delivery: null, receipt: "2026-11-10T09:00:00+09:00" } };
  const steps = deriveCaseSteps(received);
  expect(steps.every(step => step.state === "done")).toBe(true);
  expect(steps.find(step => step.key === "delivery")?.summary).toMatch(/^納品済み（/);
  expect(steps.find(step => step.key === "receipt")?.summary).toBe("手入力で完了（11/10 9:00）");
});

it("advances outside orders from hand-recorded delivery and receipt too", () => {
  const delivered = externalCase({}, r => ({ ...r, manualProgress: { delivery: "2026-11-09T12:00:00+09:00", receipt: null } }));
  const steps = deriveCaseSteps(delivered);
  expect(steps.find(step => step.key === "delivery")).toMatchObject({ state: "done", summary: "手入力で完了（11/9 12:00）" });
  expect(steps.find(step => step.key === "receipt")?.state).toBe("current");
  const received = externalCase({}, r => ({ ...r, manualProgress: { delivery: null, receipt: "2026-11-11T12:00:00+09:00" } }));
  const doneSteps = deriveCaseSteps(received);
  expect(doneSteps.every(step => step.state === "done")).toBe(true);
  expect(doneSteps.find(step => step.key === "receipt")?.summary).toBe("手入力で完了（11/11 12:00）");
});

import { expect, it } from "vitest";
import { caseWorkFocus, type CaseWorkView } from "../caseWork";

const id = "11111111-1111-4111-8111-111111111111", now = Date.parse("2026-11-08T00:00:00Z");
const task = (stage: CaseWorkView["project"]["tasks"][number]["stage"], done: boolean) => ({ id: `task-${stage}`, stage, label: stage, done });
const doneTasks = [task("rough", true), task("lineart", true), task("coloring", true), task("finish", true), task("delivery", false)];
function view(patch: Partial<CaseWorkView["project"]> = {}, rest: Partial<CaseWorkView> = {}): CaseWorkView {
  return {
    project: { id, status: "delivery_prep", nextAction: "-", title: "架空案件", clientName: "架空依頼者", clientEmail: "a@example.com", amount: 12000, type: "illustration", deliveryPlan: "normal", priority: null, startDate: null, dueDate: null, createdAt: "2026-10-01T00:00:00Z", note: null, requestData: {}, mutationRevision: 1, tasks: doneTasks, paymentConfirmedAt: null, paidAt: null, paidAmount: null, completedAt: null, deliveryAcceptedAt: null, deliveredMailAt: null, deletedAt: null, ...patch } as CaseWorkView["project"],
    revision: "a".repeat(64), complete: true, records: [], files: [], messages: [], release: null, operation: null, outboundBlocked: false, ...rest,
  };
}
const record = (kind: string, data: Record<string, unknown> = {}) => ({ id: `22222222-2222-4222-8222-${String(Math.random()).slice(2, 14).padEnd(12, "0")}`, kind, data: { note: "メモ", ...data }, operator: { kind: "auth-user", userId: null }, created_at: "2026-10-02T00:00:00Z" }) as unknown as CaseWorkView["records"][number];
const release = (expiresAt: string) => ({ id: "33333333-3333-4333-8333-333333333333", expiresAt, acceptedAt: null, publishedAt: "2026-10-05T00:00:00Z" });

it("asks for no form while production tasks remain or when the case has ended", () => {
  expect(caseWorkFocus(view({ tasks: [task("rough", true), task("lineart", false)] }), now)).toBeNull();
  expect(caseWorkFocus(view({ tasks: [] }), now)).toBeNull();
  expect(caseWorkFocus(view({ status: "completed" }), now)).toBeNull();
  expect(caseWorkFocus(view({ deletedAt: "2026-11-01T00:00:00Z" }), now)).toBeNull();
});

it("puts an open revision request first", () => {
  expect(caseWorkFocus(view({ tasks: [task("rough", false)] }, { records: [record("revision_open")] }), now)).toBe("revision");
});

it("raises delivery for a site case with finished work and no delivery page yet", () => {
  expect(caseWorkFocus(view(), now)).toBe("delivery");
  expect(caseWorkFocus(view({ status: "delivered" }, { release: release("2026-12-01T00:00:00Z") }), now)).toBeNull();
});

it("raises completion when the delivery page expired unaccepted", () => {
  expect(caseWorkFocus(view({ status: "delivered" }, { release: release("2026-11-04T00:00:00Z") }), now)).toBe("complete");
});

it("for an outside order, raises delivery until it is handed over, then completion", () => {
  const outside = { requestData: null };
  const origin = record("origin", { origin: "external" });
  expect(caseWorkFocus(view(outside, { records: [origin] }), now)).toBe("delivery");
  expect(caseWorkFocus(view(outside, { records: [origin, record("manual_delivery")] }), now)).toBe("complete");
  expect(caseWorkFocus(view(outside, { records: [origin, record("manual_receipt")] }), now)).toBe("complete");
  expect(caseWorkFocus(view({ ...outside, status: "delivered" }, { records: [origin] }), now)).toBe("complete");
  expect(caseWorkFocus(view({ ...outside, clientEmail: null }, { records: [origin] }), now)).toBe("complete");
});

import { describe, expect, it } from "vitest";
import { rowToProject, type ProjectRow, type TaskRow } from "../../data/supabaseProjects";
import { applyTaskProjection, taskProjectionSchema, type NatoriTaskProjection } from "../taskProjection";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const stamp = "2026-10-01T12:00:00.000Z";
const later = "2026-10-02T12:00:00.000Z";
const originalAnswers = { schemaVersion: 1, message: "Synthetic original conditions: no AI training" };
const row = (extra: Partial<ProjectRow> = {}): ProjectRow => ({
  id, user_id: owner, title: "Metadata A", client_name: "Client A", client_email: "client@phase6a.invalid",
  amount: 12000, type: "illustration", status: "rough", delivery_plan: "normal", priority: null,
  start_date: null, due_date: null, created_at: stamp, next_action: "FIRST_TASK", note: "Saved note A",
  payment_confirmed_at: stamp, paid_at: null, paid_amount: 12000, completed_at: null,
  delivery_accepted_at: null, delivered_mail_at: null, deleted_at: null,
  request_data: originalAnswers, mutation_revision: 1, ...extra,
});
const taskRows: TaskRow[] = [
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", project_id: id, task_key: "one", label: "FIRST_TASK", stage: "rough", estimated_hours: null, done: false, sort_order: 1 },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", project_id: id, task_key: "two", label: "SECOND_TASK", stage: "lineart", estimated_hours: 2, done: false, sort_order: 2 },
];
function projection(source: ProjectRow, extra: Partial<NatoriTaskProjection> = {}): NatoriTaskProjection {
  return {
    id, title: source.title, clientName: source.client_name, clientEmail: source.client_email ?? null,
    amount: source.amount, type: source.type, deliveryPlan: source.delivery_plan, priority: source.priority,
    startDate: source.start_date, dueDate: source.due_date, createdAt: source.created_at, note: source.note,
    requestData: originalAnswers, status: "lineart", nextAction: "SECOND_TASK", mutationRevision: 2,
    tasks: [
      { id: "one", label: "FIRST_TASK", stage: "rough", done: true, estimatedHours: null },
      { id: "two", label: "SECOND_TASK", stage: "lineart", done: false, estimatedHours: 2 },
    ],
    paymentConfirmedAt: source.payment_confirmed_at ?? null, paidAt: source.paid_at ?? null,
    paidAmount: source.paid_amount ?? null, completedAt: null, deliveryAcceptedAt: null,
    deliveredMailAt: null, deletedAt: null, ...extra,
  };
}

describe("legacy payment dates and complete task revisions", () => {
  it("applies a newer raw-null paidAt task result to the real legacy GET read model", () => {
    const raw = row();
    const current = rowToProject(raw, taskRows, []);
    const incoming = projection(raw);
    expect(current.paidAt).toBe(stamp);
    expect(incoming.paidAt).toBeNull();
    const next = applyTaskProjection(current, incoming);
    expect(next).not.toBe(current);
    expect(next).toMatchObject({ status: "lineart", nextAction: "SECOND_TASK", mutationRevision: 2, paidAt: stamp, paymentConfirmedAt: stamp, paidAmount: 12000 });
    expect(next.tasks.map(task => task.done)).toEqual([true, false]);
    expect(next.completedAt).toBeUndefined();
    expect(next.deliveryAcceptedAt).toBeUndefined();
    expect(raw.paid_at).toBeNull();
    expect(incoming.paidAt).toBeNull();
    expect(current.mutationRevision).toBe(1);
  });

  it.each([
    { name: "missing confirmation", changes: { paymentConfirmedAt: null }, source: {} },
    { name: "changed actual paid date", changes: { paidAt: later }, source: { paid_at: stamp } },
    { name: "changed present zero payment amount", changes: { paidAmount: 12000 }, source: { paid_amount: 0 } },
  ])("retains immutable payment evidence for $name", ({ changes, source }) => {
    const raw = row(source);
    const current = rowToProject(raw, taskRows, []);
    expect(applyTaskProjection(current, projection(raw, changes))).toBe(current);
    expect(current.mutationRevision).toBe(1);
    expect(current.tasks.every(task => !task.done)).toBe(true);
  });

  it.each([0, null])("carries complete row metadata with amount %s using the existing GET normalization", amount => {
    const initial = row({ paid_at: stamp });
    const fresh = row({ title: "Metadata B", client_name: "Client B", client_email: null,
      amount, type: "standing", delivery_plan: "rush_14_days", priority: "high",
      start_date: "2026-10-10", due_date: "2026-11-15", note: null, paid_at: stamp,
      mutation_revision: 3, status: "lineart", next_action: "SECOND_TASK" });
    const expected = rowToProject(fresh, taskRows.map(task => ({ ...task, done: task.task_key === "one" })), []);
    const current = rowToProject(initial, taskRows, []);
    const next = applyTaskProjection(current, projection(fresh, { mutationRevision: 3 }));
    for (const key of ["title", "clientName", "clientEmail", "amount", "type", "deliveryPlan", "priority", "startDate", "dueDate", "createdAt", "note", "requestData"] as const) {
      expect(next[key], key).toEqual(expected[key]);
    }
    expect(next).toMatchObject({ status: "lineart", nextAction: "SECOND_TASK", mutationRevision: 3 });
    expect(next.tasks.map(task => task.done)).toEqual([true, false]);
    expect(current.title).toBe("Metadata A");
    expect(current.amount).toBe(12000);
    expect(initial.request_data).toEqual(originalAnswers);
  });

  it("rejects a mutation revision that omits required row metadata", () => {
    expect(taskProjectionSchema.safeParse({ ...projection(row()), title: undefined }).success).toBe(false);
  });
});

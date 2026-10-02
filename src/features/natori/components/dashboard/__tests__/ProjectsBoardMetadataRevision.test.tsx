// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "@/features/natori/types/projects";
import type { NatoriTaskProjection } from "@/features/natori/lib/taskProjection";
import type { UpdateNatoriProjectDetailsInput } from "@/features/natori/data/supabaseProjects";

const api = vi.hoisted(() => ({ fetch: vi.fn(), toggle: vi.fn(), events: vi.fn(), details: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", async () => {
  const actual = await vi.importActual<typeof import("@/features/natori/data/supabaseProjects")>("@/features/natori/data/supabaseProjects");
  return { ...actual, fetchNatoriProjectCollection: api.fetch, toggleNatoriTaskDone: api.toggle,
    updateNatoriProjectDetails: api.details, confirmNatoriProjectPayment: vi.fn(), deleteNatoriProject: vi.fn(),
    restoreNatoriProject: vi.fn(), updateNatoriProjectStatus: vi.fn() };
});
vi.mock("@/features/natori/data/supabaseEvents", () => ({ fetchNatoriEvents: api.events,
  createNatoriEvent: vi.fn(), deleteNatoriEvent: vi.fn(), updateNatoriEvent: vi.fn() }));
vi.mock("@/features/natori/components/dashboard/ProjectCard", () => ({
  default: ({ project, onToggleTask, onEditDetails }: { project: NatoriProject;
    onToggleTask: (id: string, task: string) => void;
    onEditDetails: (project: NatoriProject, patch: UpdateNatoriProjectDetailsInput) => Promise<void> }) => (
    <article>
      <output data-testid="canonical">{project.status}/{project.nextAction}/{project.mutationRevision}</output>
      <output data-testid="metadata">{JSON.stringify({ title: project.title, clientName: project.clientName,
        amount: project.amount, deliveryPlan: project.deliveryPlan, startDate: project.startDate, dueDate: project.dueDate,
        note: project.note, requestData: project.requestData })}</output>
      <output data-testid="paid-at">{project.paidAt ?? "none"}</output>
      {project.tasks.map(task => <button key={task.id} aria-label={task.id} aria-pressed={task.done}
        onClick={() => onToggleTask(project.id, task.id)}>{task.id}</button>)}
      <button onClick={() => void onEditDetails(project, { title: "Metadata B", clientName: "Client B", amount: 13000,
        deliveryPlan: "rush_14_days", startDate: "2026-10-10", dueDate: null, note: "Saved note B" })}>Apply metadata B</button>
    </article>
  ),
}));
vi.mock("@/features/natori/components/dashboard/ProjectMonthCalendar", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectDayDetail", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectPriorityList", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ClosedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ArchivedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel", () => ({ default: () => null }));
import ProjectsBoard from "../ProjectsBoard";
import { rowToProject, type ProjectRow, type TaskRow } from "@/features/natori/data/supabaseProjects";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const stamp = "2026-10-01T12:00:00.000Z";
const originalAnswers = { schemaVersion: 1, message: "Synthetic original: no AI training" };
const rawRow = (extra: Partial<ProjectRow> = {}): ProjectRow => ({
  id, user_id: owner, title: "Metadata A", client_name: "Client A", client_email: "client@phase6a.invalid",
  amount: 12000, type: "illustration", status: "rough", delivery_plan: "normal", priority: null,
  start_date: null, due_date: null, created_at: stamp, next_action: "FIRST_TASK", note: "Saved note A",
  payment_confirmed_at: stamp, paid_at: stamp, paid_amount: 12000, completed_at: null,
  delivery_accepted_at: null, delivered_mail_at: null, deleted_at: null, request_data: originalAnswers,
  mutation_revision: 1, ...extra,
});
const tasks: TaskRow[] = [
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", project_id: id, task_key: "one", label: "FIRST_TASK", stage: "rough", estimated_hours: null, done: false, sort_order: 1 },
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", project_id: id, task_key: "two", label: "SECOND_TASK", stage: "lineart", estimated_hours: null, done: false, sort_order: 2 },
];
function rawProjection(raw: ProjectRow, revision: number): NatoriTaskProjection {
  return { id, title: raw.title, clientName: raw.client_name, clientEmail: raw.client_email ?? null, amount: raw.amount,
    type: raw.type, deliveryPlan: raw.delivery_plan, priority: raw.priority, startDate: raw.start_date,
    dueDate: raw.due_date, createdAt: raw.created_at, note: raw.note, requestData: originalAnswers,
    status: "lineart", nextAction: "SECOND_TASK", mutationRevision: revision,
    tasks: [{ id: "one", label: "FIRST_TASK", stage: "rough", done: true }, { id: "two", label: "SECOND_TASK", stage: "lineart", done: false }],
    paymentConfirmedAt: raw.payment_confirmed_at ?? null, paidAt: raw.paid_at ?? null, paidAmount: raw.paid_amount ?? null,
    completedAt: null, deliveryAcceptedAt: null, deliveredMailAt: null, deletedAt: null };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const collection = (project: NatoriProject) => ({ projects: [project], archivedProjects: [] as NatoriProject[] });
beforeEach(() => { vi.resetAllMocks(); api.events.mockResolvedValue([]); });
afterEach(cleanup);
async function mount(raw: ProjectRow) {
  api.fetch.mockResolvedValueOnce(collection(rowToProject(raw, tasks, [])));
  render(<ProjectsBoard />);
  await screen.findByRole("button", { name: "one" });
}
function expectLatestTask() {
  expect(screen.getByTestId("canonical").textContent).toBe("lineart/SECOND_TASK/3");
  expect(screen.getByRole("button", { name: "one" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "two" }).getAttribute("aria-pressed")).toBe("false");
}

describe("ProjectsBoard complete revision and legacy paid date regressions", () => {
  it("keeps a successful raw-null legacy paid date save visible without a rescue GET", async () => {
    const raw = rawRow({ paid_at: null }), saved = deferred<NatoriTaskProjection>();
    api.toggle.mockReturnValueOnce(saved.promise);
    await mount(raw);
    expect(screen.getByTestId("paid-at").textContent).toBe(stamp);
    fireEvent.click(screen.getByRole("button", { name: "one" }));
    expect(api.toggle).toHaveBeenCalledExactlyOnceWith(id, "one", true);
    await act(async () => saved.resolve(rawProjection(raw, 3)));
    expectLatestTask();
    expect(screen.getByTestId("paid-at").textContent).toBe(stamp);
    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(raw.paid_at).toBeNull();
  });

  it("retains committed metadata B through a later task revision and an older delayed full GET", async () => {
    const initial = rawRow(), fresh = rawRow({ title: "Metadata B", client_name: "Client B", amount: 13000,
      delivery_plan: "rush_14_days", start_date: "2026-10-10", note: "Saved note B", mutation_revision: 2 });
    const details = deferred<void>(), heldRead = deferred<ReturnType<typeof collection>>(), saved = deferred<NatoriTaskProjection>();
    api.details.mockReturnValueOnce(details.promise);
    api.toggle.mockReturnValueOnce(saved.promise);
    await mount(initial);
    api.fetch.mockReturnValueOnce(heldRead.promise);
    fireEvent.click(screen.getByRole("button", { name: "Apply metadata B" }));
    expect(api.details).toHaveBeenCalledExactlyOnceWith(id, { title: "Metadata B", clientName: "Client B", amount: 13000,
      deliveryPlan: "rush_14_days", startDate: "2026-10-10", dueDate: null, note: "Saved note B" });
    await act(async () => details.resolve());
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "one" }));
    await act(async () => saved.resolve(rawProjection(fresh, 3)));
    expectLatestTask();
    const expected = { title: "Metadata B", clientName: "Client B", amount: 13000, deliveryPlan: "rush_14_days",
      startDate: "2026-10-10", dueDate: null, note: "Saved note B", requestData: originalAnswers };
    expect(JSON.parse(screen.getByTestId("metadata").textContent ?? "null")).toEqual(expected);
    await act(async () => heldRead.resolve(collection(rowToProject(fresh, tasks, []))));
    expectLatestTask();
    expect(JSON.parse(screen.getByTestId("metadata").textContent ?? "null")).toEqual(expected);
    expect(screen.getByTestId("paid-at").textContent).toBe(stamp);
    expect(api.fetch).toHaveBeenCalledTimes(2);
    expect(api.toggle).toHaveBeenCalledExactlyOnceWith(id, "one", true);
    expect(initial.title).toBe("Metadata A");
    expect(initial.request_data).toEqual(originalAnswers);
  });
});

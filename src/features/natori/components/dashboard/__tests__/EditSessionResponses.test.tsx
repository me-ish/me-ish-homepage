// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "../../../types/projects";
import type { NatoriTaskProjection } from "../../../lib/taskProjection";
type InquiryDetailPanelProps = { project: NatoriProject; onClose: () => void; onCloseInquiry: () => void;
  onConfirmType: (type: "icon") => Promise<void>; onAddLink: (url: string, label: null) => Promise<void>; onOpenMail: (kind: "payment") => void };
const api = vi.hoisted(() => ({ results: vi.fn(), collection: vi.fn(), latest: vi.fn(), save: vi.fn(), close: vi.fn(), confirm: vi.fn(), type: vi.fn(), link: vi.fn(), sent: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", async () => ({
  ...await vi.importActual<typeof import("@/features/natori/data/supabaseProjects")>("@/features/natori/data/supabaseProjects"),
  fetchNatoriProjects: api.results, fetchNatoriProjectThumbs: async () => ({}), fetchNatoriProjectCollection: api.collection,
  fetchNatoriProject: api.latest, updateNatoriProjectDetails: api.save, closeNatoriProject: api.close,
  confirmNatoriProjectType: api.type,
}));
vi.mock("@/features/natori/data/supabaseProjectReferenceLinks", async () => ({
  ...await vi.importActual<typeof import("@/features/natori/data/supabaseProjectReferenceLinks")>("@/features/natori/data/supabaseProjectReferenceLinks"), addNatoriProjectReferenceLink: api.link,
}));
vi.mock("@/features/natori/components/admin/useNatoriConfirm", () => ({ useNatoriConfirm: () => ({ confirm: api.confirm, confirmDialog: null }) }));
vi.mock("../InquiryDetailPanel", () => ({ default: ({ project, onClose, onCloseInquiry, onConfirmType, onAddLink, onOpenMail }: InquiryDetailPanelProps) => <section aria-label="Synthetic detail">
  <p>{project.title} detail</p><input aria-label="New inquiry draft" defaultValue="" /><button onClick={onClose}>Close detail</button><button onClick={onCloseInquiry}>Decline</button>
  <button onClick={() => void onConfirmType("icon").catch(() => {})}>Confirm type</button>
  <button onClick={() => void onAddLink("https://synthetic.invalid/reference", null).catch(() => {})}>Add link</button>
  <button onClick={() => onOpenMail("payment")}>Open mail</button>
</section> }));
vi.mock("../OrderMailPanel", () => ({ default: ({ onSent, onClose }: { onSent: () => void; onClose: () => void }) => { api.sent(onSent); return <button onClick={onClose}>Close mail</button>; } }));
import ResultsBoard from "../ResultsBoard";
import InquiriesBoard from "../InquiriesBoard";

const stamp = "2026-10-01T12:00:00Z";
const a: NatoriProject = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "TitleA", clientName: "ClientA", type: "illustration", status: "completed", amount: 12000,
  dueDate: "2026-10-01", completedAt: stamp, paidAt: stamp, paidAmount: 12000, nextAction: "", tasks: [], mutationRevision: 1, deliveryPlan: "normal" };
const b: NatoriProject = { ...a, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "TitleB", clientName: "ClientB" };
function projection(project: NatoriProject): NatoriTaskProjection { return { ...project, mutationRevision: 2, title: "SavedA", clientEmail: null, priority: null, startDate: null,
  deliveryPlan: "normal", createdAt: stamp, note: null, requestData: null, paymentConfirmedAt: stamp, paidAt: stamp, paidAmount: 12000,
  completedAt: stamp, deliveryAcceptedAt: null, deliveredMailAt: null, deletedAt: null, tasks: [] }; }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, "", "/"); });
afterEach(cleanup);

describe("Q03 parent response session fences", () => {
  it.each(["type", "link"].flatMap(action => ["success", "error"].map(outcome => ({ action, outcome }))))("old $action $outcome cannot start a reload or publish an error in a new detail session", async ({ action, outcome }) => {
    const pending = deferred<void>(); (action === "type" ? api.type : api.link).mockReturnValueOnce(pending.promise);
    api.collection.mockResolvedValue({ projects: [{ ...a, status: "inquiry" }, { ...b, status: "inquiry" }], archivedProjects: [] });
    api.latest.mockImplementation(async (id: string) => ({ ...(id === a.id ? a : b), status: "inquiry" }));
    render(<InquiriesBoard />);
    fireEvent.click((await screen.findAllByRole("button", { name: /TitleA/ }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: action === "type" ? "Confirm type" : "Add link" }));
    await waitFor(() => expect(action === "type" ? api.type : api.link).toHaveBeenCalledOnce());
    fireEvent.click(screen.getAllByRole("button", { name: /TitleB/ })[0]); await screen.findByText("TitleB detail");
    fireEvent.change(screen.getByLabelText("New inquiry draft"), { target: { value: "New B draft" } });
    await act(async () => { if (outcome === "error") pending.reject(new Error("Synthetic old action")); else pending.resolve(); });
    expect(api.collection).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("New inquiry draft") as HTMLInputElement).value).toBe("New B draft");
  });
  it("an old mail onSent callback cannot reload a newly opened detail", async () => {
    api.collection.mockResolvedValue({ projects: [{ ...a, status: "inquiry" }, { ...b, status: "inquiry" }], archivedProjects: [] });
    api.latest.mockImplementation(async (id: string) => ({ ...(id === a.id ? a : b), status: "inquiry" }));
    render(<InquiriesBoard />);
    fireEvent.click((await screen.findAllByRole("button", { name: /TitleA/ }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Open mail" }));
    const oldSent = api.sent.mock.calls.at(-1)![0] as () => void;
    fireEvent.click(screen.getByRole("button", { name: "Close mail" }));
    fireEvent.click(screen.getAllByRole("button", { name: /TitleB/ })[0]); await screen.findByText("TitleB detail");
    await act(async () => oldSent()); expect(api.collection).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("delayed result A save does not close a new draft (reopen A: %s)", async reopen => {
    const pending = deferred<NatoriTaskProjection>(); api.results.mockResolvedValue([a,b]); api.save.mockReturnValue(pending.promise);
    render(<ResultsBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "「TitleA」を編集" }));
    fireEvent.change(screen.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "First A" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    fireEvent.click(screen.getByRole("button", { name: "「TitleB」を編集" }));
    if (reopen) fireEvent.click(screen.getByRole("button", { name: "「TitleA」を編集" }));
    fireEvent.change(screen.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "New draft" } });
    await act(async () => pending.resolve(projection(a)));
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("New draft");
    expect(api.save).toHaveBeenCalledExactlyOnceWith(a.id, { note: "First A" }, 1);
    expect(api.results).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("delayed decline A does not close a new inquiry draft (reopen A: %s)", async reopen => {
    const pending = deferred<void>();
    const inquiryA = { ...a, status: "inquiry" as const, completedAt: undefined, consultation: null };
    const inquiryB = { ...b, status: "inquiry" as const, completedAt: undefined, consultation: null };
    api.collection.mockResolvedValue({ projects: [inquiryA,inquiryB], archivedProjects: [] });
    api.latest.mockImplementation(async (id: string) => id === a.id ? inquiryA : inquiryB);
    api.close.mockReturnValue(pending.promise); api.confirm.mockResolvedValue({ reason: "Synthetic" });
    render(<InquiriesBoard />);
    fireEvent.click((await screen.findAllByRole("button", { name: /TitleA/ }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    await waitFor(() => expect(api.close).toHaveBeenCalledOnce());
    fireEvent.click(screen.getAllByRole("button", { name: /TitleB/ })[0]);
    await screen.findByText("TitleB detail");
    if (reopen) { fireEvent.click(screen.getAllByRole("button", { name: /TitleA/ })[0]); await screen.findByText("TitleA detail"); }
    fireEvent.change(screen.getByLabelText("New inquiry draft"), { target: { value: "New draft" } });
    await act(async () => pending.resolve());
    expect((screen.getByLabelText("New inquiry draft") as HTMLInputElement).value).toBe("New draft");
  });
});

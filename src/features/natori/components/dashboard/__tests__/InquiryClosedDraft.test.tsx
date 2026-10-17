// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "../../../types/projects";
import { parseInquiryNote } from "../../../lib/inquiryNoteView";
const api = vi.hoisted(() => ({ collection: vi.fn(), latest: vi.fn(), close: vi.fn(), confirm: vi.fn(), save: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", async () => ({
  ...await vi.importActual<typeof import("@/features/natori/data/supabaseProjects")>("@/features/natori/data/supabaseProjects"),
  fetchNatoriProjectCollection: api.collection, fetchNatoriProject: api.latest, closeNatoriProject: api.close, updateNatoriProjectDetails: api.save,
}));
vi.mock("@/features/natori/components/admin/useNatoriConfirm", () => ({ useNatoriConfirm: () => ({ confirm: api.confirm, confirmDialog: null }) }));
vi.mock("../ProjectActivityTimeline", () => ({ default: () => null }));
vi.mock("../InquiryTalkMenu", () => ({ default: () => null }));
vi.mock("@/features/natori/components/consultation/ConsultationThread", () => ({ default: () => null }));
vi.mock("../OrderMailPanel", () => ({ default: () => null }));
import InquiriesBoard from "../InquiriesBoard";
import InquiryDetailPanel from "../InquiryDetailPanel";
const stamp = "2026-10-01T12:00:00Z";
const a: NatoriProject = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "TitleA", clientName: "ClientA", type: "illustration", status: "inquiry", amount: 12000,
  dueDate: null, nextAction: "Review", tasks: [], mutationRevision: 1, deliveryPlan: "normal", createdAt: stamp, consultation: null };
const b: NatoriProject = { ...a, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "TitleB", clientName: "ClientB" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, "", "/"); });
afterEach(cleanup);
function openSettings() { fireEvent.click(screen.getByText("案件の設定")); }
function correctionInput() { return screen.getByLabelText("金額（円）") as HTMLInputElement; }

describe("Q03 actual inquiry editor survives read-only lifecycle responses", () => {
  it.each(["closed", "archived"])("retains a real correction draft and disables saving when refreshed as %s", async mode => {
    const props = { project: a, view: parseInquiryNote(a.note), busy: false, onClose: vi.fn(), onOpenMail: vi.fn(), onCloseInquiry: vi.fn(), onConfirmPayment: vi.fn(), onSaveCorrection: api.save };
    const view = render(<InquiryDetailPanel {...props} />);
    openSettings(); fireEvent.change(correctionInput(), { target: { value: "27000" } });
    view.rerender(<InquiryDetailPanel {...props} project={{ ...a, mutationRevision: 2, ...(mode === "closed" ? { status: "closed" } : { deletedAt: stamp }) }} />);
    expect(correctionInput().value).toBe("27000"); expect(correctionInput().disabled).toBe(true);
    const save = screen.getByRole("button", { name: "確定内容を保存" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); fireEvent.click(save); expect(api.save).not.toHaveBeenCalled();
    expect(screen.getByText("案件が終了またはアーカイブされたため保存できません。入力内容は保持しています。")).toBeTruthy();
  });
  it("after decline A finishes, a re-opened A draft entered after busy clears survives the delayed closed detail GET", async () => {
    const close = deferred<void>(), heldDetail = deferred<NatoriProject>();
    const closedA: NatoriProject = { ...a, status: "closed", mutationRevision: 2 };
    let committed = false, readsA = 0;
    api.close.mockImplementation(() => close.promise.then(() => { committed = true; }));
    api.confirm.mockResolvedValue({ reason: "Synthetic" });
    api.collection.mockImplementation(async () => ({ projects: [committed ? closedA : a, b], archivedProjects: [] }));
    api.latest.mockImplementation(async (id: string) => {
      if (id !== a.id) return b;
      readsA += 1;
      return committed ? heldDetail.promise : a;
    });
    render(<InquiriesBoard />);
    fireEvent.click((await screen.findAllByRole("button", { name: /TitleA/ }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "見送りにする" }));
    await waitFor(() => expect(api.close).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getAllByRole("button", { name: /TitleB/ })[0]);
    await screen.findByRole("button", { name: "見送りにする" });
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getAllByRole("button", { name: /TitleA/ })[0]);
    await screen.findByRole("button", { name: "見送りにする" });
    openSettings(); expect(correctionInput().disabled).toBe(true);
    await act(async () => close.resolve());
    await waitFor(() => { expect(readsA).toBeGreaterThanOrEqual(3); expect(correctionInput().disabled).toBe(false); });
    fireEvent.change(correctionInput(), { target: { value: "27000" } });
    await act(async () => heldDetail.resolve(closedA));
    expect(correctionInput().value).toBe("27000"); expect(correctionInput().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "確定内容を保存" }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
  });
});

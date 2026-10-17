// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "../../../types/projects";
import type { NatoriTaskProjection } from "../../../lib/taskProjection";

const api = vi.hoisted(() => ({ collection: vi.fn(), detail: vi.fn(), save: vi.fn(), profile: vi.fn(), signout: vi.fn(), authChange: vi.fn(), saveProfile: vi.fn(), confirm: vi.fn(), payment: vi.fn(), close: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", async () => ({
  ...await vi.importActual<typeof import("@/features/natori/data/supabaseProjects")>("@/features/natori/data/supabaseProjects"),
  fetchNatoriProjectCollection: api.collection, fetchNatoriProject: api.detail, updateNatoriProjectDetails: api.save,
  confirmNatoriProjectPayment: api.payment, closeNatoriProject: api.close,
}));
vi.mock("@/features/natori/data/supabaseProfile", () => ({ fetchOwnNatoriProfile: api.profile, upsertOwnNatoriProfile: api.saveProfile }));
vi.mock("@/features/natori/components/admin/useNatoriConfirm", () => ({ useNatoriConfirm: () => ({ confirm: api.confirm, confirmDialog: null }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getUser: async () => ({ data: { user: { email: "staff@synthetic.invalid" } } }), signOut: api.signout,
  onAuthStateChange: api.authChange,
} }) }));
vi.mock("@/features/natori/components/admin/NatoriPageShell", () => ({ NatoriPageShell: ({ children, headerRight }: { children: ReactNode; headerRight: ReactNode }) => <main>{headerRight}{children}</main> }));
vi.mock("../DashboardTodaySummary", () => ({ default: ({ projects }: { projects: NatoriProject[] }) => <output data-testid="dashboard-projects">{projects.map(p => `${p.title}:${p.amount}:${p.consultation?.latestMessageId}`).join(",")}</output> }));
vi.mock("../ConsultationAttentionPanel", () => ({ default: ({ onRefresh }: { onRefresh: () => void }) => <button onClick={onRefresh}>Refresh dashboard</button> }));
vi.mock("../NotificationStatusPanel", () => ({ default: () => null }));
vi.mock("../NotificationAlertBanner", () => ({ default: () => null }));
vi.mock("../PageEventsPanel", () => ({ default: () => null }));
vi.mock("../ProjectActivityTimeline", () => ({ default: () => null }));
vi.mock("../OrderMailPanel", () => ({ default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close synthetic mail</button> }));
import Dashboard from "@/app/[locale]/natori/dashboard/page";
import InquiriesBoard from "../InquiriesBoard";

const stamp = "2026-10-17T00:00:00Z";
const project: NatoriProject = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Synthetic inquiry", clientName: "Synthetic client",
  type: "icon", status: "quoted", amount: 1000, dueDate: null, nextAction: "Review", createdAt: stamp,
  tasks: [], deliveryPlan: "normal", mutationRevision: 1,
  consultation: { latestMessageId: "original", latestSender: "client", latestMessageAt: stamp,
    notificationFailed: 0, notificationPending: 0, roughOkPending: 0, latestRoughOkId: null, latestRoughOkAt: null },
};
const collection = (p = project) => ({ projects: [p], archivedProjects: [] as NatoriProject[] });
type Collection = ReturnType<typeof collection>;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const resume = async () => { await tick(1100); await act(async () => { window.dispatchEvent(new Event("focus")); }); };
async function openDetail() { fireEvent.click(screen.getAllByRole("button", { name: /Synthetic inquiry/ })[0]); await tick(); }
async function closeDetail() { fireEvent.click(screen.getByRole("button", { name: /^閉じる$/ })); await tick(); }
function savedProjection(): NatoriTaskProjection {
  return { id: project.id, title: project.title, clientName: project.clientName, type: "icon", status: "quoted",
    nextAction: "Review", amount: 2500, mutationRevision: 2, clientEmail: null, priority: null, startDate: null,
    deliveryPlan: "normal", createdAt: stamp, dueDate: null, note: null, requestData: null, tasks: [],
    paymentConfirmedAt: null, paidAt: null, paidAmount: null, completedAt: null, deliveryAcceptedAt: null,
    deliveredMailAt: null, deletedAt: null };
}
async function finishRead(read: ReturnType<typeof deferred<Collection>>, outcome: string) {
  await act(async () => {
    if (outcome === "error") read.reject(new Error("Stale read failure"));
    else read.resolve(collection({ ...project, title: "Stale collection", amount: 9999, mutationRevision: 99 }));
  });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  window.history.replaceState(null, "", "/natori/inquiries");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  api.collection.mockResolvedValue(collection()); api.detail.mockResolvedValue(project);
  api.profile.mockResolvedValue({ userId: "synthetic-owner", mutationRevision: 1, displayName: "Saved name" });
  api.signout.mockResolvedValue({ error: null }); api.save.mockResolvedValue(savedProjection());
  api.authChange.mockReturnValue({ data: { subscription: { unsubscribe() {} } } });
  api.confirm.mockResolvedValue({ reason: "Synthetic reason" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("integrated resume and Q03 response fences using the real inquiry correction form", () => {
  it.each(["close", "popstate"])("recovers the initial list after a deep-linked detail leaves by %s before its collection read returns", async transition => {
    window.history.replaceState(null, "", `/natori/inquiries?project=${project.id}`);
    const held = deferred<Collection>(); api.collection.mockReturnValueOnce(held.promise);
    render(<InquiriesBoard />); await tick(); expect(screen.getByRole("dialog")).toBeTruthy();
    if (transition === "close") await closeDetail();
    else { window.history.replaceState(null, "", "/natori/inquiries"); fireEvent(window, new PopStateEvent("popstate")); await tick(); }
    expect(api.collection).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("button", { name: /Synthetic inquiry/ }).length).toBeGreaterThan(0);
    await finishRead(held, "success");
    expect(screen.queryByText("Stale collection")).toBeNull();
    expect(screen.getByRole("button", { name: "状態を更新" })).toBeTruthy();
  });

  it.each(["reopen", "popstate"].flatMap(transition => ["success", "error"].map(outcome => ({ transition, outcome }))))("a same-project $transition starts a replacement read and ignores the retired $outcome", async ({ transition, outcome }) => {
    render(<InquiriesBoard />); await tick();
    const held = deferred<NatoriProject>(); api.detail.mockReturnValueOnce(held.promise);
    await openDetail(); expect(screen.getByText("案件詳細を読み込み中…")).toBeTruthy();
    if (transition === "reopen") await openDetail();
    else { fireEvent(window, new PopStateEvent("popstate")); await tick(); }
    expect(api.detail).toHaveBeenCalledTimes(2); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { if (outcome === "error") held.reject(new Error("Retired detail failure")); else held.resolve({ ...project, title: "Retired detail", mutationRevision: 99 }); });
    expect(screen.queryByText("Retired detail")).toBeNull();
    expect(screen.queryByText(/案件の詳細を取得できませんでした/)).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it.each(["collection", "detail"].flatMap(kind => ["success", "error"].map(outcome => ({ kind, outcome }))))("rejects a $kind read begun during a save when the PUT fails before its late $outcome", async ({ kind, outcome }) => {
    render(<InquiriesBoard />); await tick(); await openDetail();
    const save = deferred<NatoriTaskProjection>(), list = deferred<Collection>(), detail = deferred<NatoriProject>();
    api.save.mockReturnValueOnce(save.promise);
    fireEvent.click(screen.getByText("案件の設定"));
    fireEvent.change(screen.getByLabelText("金額（円）"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "確定内容を保存" })); await tick();
    if (kind === "collection") api.collection.mockReturnValueOnce(list.promise);
    else api.detail.mockReturnValueOnce(detail.promise);
    fireEvent.click(screen.getByText("状態を更新")); await tick();
    await act(async () => save.reject(new Error("Synthetic uncertain save")));
    expect(screen.getByRole("region", { name: "保存内容の比較" })).toBeTruthy();
    if (kind === "collection") await finishRead(list, outcome);
    else await act(async () => { if (outcome === "error") detail.reject(new Error("Old detail failed")); else detail.resolve({ ...project, title: "Stale detail", mutationRevision: 99 }); });
    expect((screen.getByLabelText("金額（円）") as HTMLInputElement).value).toBe("2500");
    expect(screen.queryByText(/Stale collection|Stale detail/)).toBeNull();
    expect(screen.queryByText(/案件の詳細を取得できませんでした|最新の状況を取得できませんでした/)).toBeNull();
    expect(screen.getByRole("region", { name: "保存内容の比較" })).toBeTruthy();
  });

  it("an old save failure cannot cancel the newly opened B detail request", async () => {
    const b: NatoriProject = { ...project, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Second inquiry" };
    api.collection.mockResolvedValue({ projects: [project, b], archivedProjects: [] });
    const save = deferred<NatoriTaskProjection>(), detailB = deferred<NatoriProject>(); api.save.mockReturnValueOnce(save.promise);
    api.detail.mockImplementation(async (id: string) => id === b.id ? detailB.promise : project);
    render(<InquiriesBoard />); await tick(); await openDetail();
    fireEvent.click(screen.getByText("案件の設定"));
    fireEvent.change(screen.getByLabelText("金額（円）"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: "確定内容を保存" })); await tick();
    await closeDetail(); fireEvent.click(screen.getAllByRole("button", { name: /Second inquiry/ })[0]); await tick();
    expect(screen.getByText("案件詳細を読み込み中…")).toBeTruthy();
    await act(async () => save.reject(new Error("Old A save failed")));
    await act(async () => detailB.resolve(b));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("案件詳細を読み込み中…")).toBeNull();
    expect(screen.queryByText("Old A save failed")).toBeNull();
  });

  it.each(["success", "error"])("rejects a resume %s after mail opens and closes and the detail closes", async outcome => {
    render(<InquiriesBoard />); await tick();
    const held = deferred<Collection>(); api.collection.mockReturnValueOnce(held.promise); await resume();
    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "支払い依頼メールを送る" })); await tick();
    fireEvent.click(screen.getByRole("button", { name: "Close synthetic mail" })); await tick();
    await closeDetail(); await finishRead(held, outcome);
    expect(screen.queryByText("Stale collection")).toBeNull();
    expect(screen.queryByText(/返信状況を更新できませんでした/)).toBeNull();
    expect(api.collection).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "error"].flatMap(save => ["success", "error"].map(read => ({ save, read }))))("rejects old resume $read after correction $save and close", async ({ save, read }) => {
    render(<InquiriesBoard />); await tick();
    const held = deferred<Collection>(); api.collection.mockReturnValueOnce(held.promise); await resume();
    await openDetail(); fireEvent.click(screen.getByText("案件の設定"));
    fireEvent.change(screen.getByLabelText("金額（円）"), { target: { value: "2500" } });
    if (save === "error") api.save.mockRejectedValueOnce(new Error("Synthetic save failure"));
    fireEvent.click(screen.getByRole("button", { name: "確定内容を保存" })); await tick();
    expect(api.save).toHaveBeenCalledExactlyOnceWith(project.id, { amount: 2500 }, 1, undefined);
    expect((screen.getByLabelText("金額（円）") as HTMLInputElement).value).toBe("2500");
    await closeDetail(); await finishRead(held, read);
    expect(screen.queryByText("Stale collection")).toBeNull();
    expect(screen.queryByText(/返信状況を更新できませんでした/)).toBeNull();
    if (save === "success") expect(screen.getAllByText(/2,500/).length).toBeGreaterThan(0);
  });

  it.each(["success", "error"])("rejects a pre-save detail %s while retaining the saved correction", async outcome => {
    render(<InquiriesBoard />); await tick(); await openDetail();
    const held = deferred<NatoriProject>(); api.detail.mockReturnValueOnce(held.promise);
    fireEvent.click(screen.getByText("状態を更新")); await tick();
    fireEvent.click(screen.getByText("案件の設定"));
    fireEvent.change(screen.getByLabelText("金額（円）"), { target: { value: "2500" } });
    api.detail.mockResolvedValue({ ...project, amount: 2500, mutationRevision: 2 });
    fireEvent.click(screen.getByRole("button", { name: "確定内容を保存" })); await tick();
    await act(async () => { if (outcome === "error") held.reject(new Error("Old detail failed")); else held.resolve({ ...project, title: "Stale detail", mutationRevision: 99 }); });
    expect((screen.getByLabelText("金額（円）") as HTMLInputElement).value).toBe("2500");
    expect(screen.queryByText("Stale detail")).toBeNull();
    expect(screen.queryByText(/案件の詳細を取得できませんでした/)).toBeNull();
  });
});

describe.each(["dashboard", "inquiries"])("%s collection revisions and ordering", surface => {
  const manual = () => fireEvent.click(screen.getByRole("button", { name: surface === "dashboard" ? "Refresh dashboard" : "状態を更新" }));
  it("rejects lower revisions and accepts consultation changes at an equal project revision", async () => {
    render(surface === "dashboard" ? <Dashboard /> : <InquiriesBoard />); await tick();
    api.collection.mockResolvedValueOnce(collection({ ...project, title: "Lower revision", mutationRevision: 0 }));
    await resume(); expect(screen.queryByText(/Lower revision/)).toBeNull();
    api.collection.mockResolvedValueOnce(collection({ ...project, title: "Equal revision", consultation: { ...project.consultation!, latestMessageId: "fresh", latestSender: "staff" } }));
    await resume();
    if (surface === "dashboard") expect(screen.getByTestId("dashboard-projects").textContent).toBe("Equal revision:1000:fresh");
    else {
      expect(screen.queryAllByRole("button", { name: /Synthetic inquiry/ })).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: /依頼者の返信待ち/ }));
      expect(screen.getAllByText("Equal revision").length).toBeGreaterThan(0);
    }
  });
  it.each(["manual", "resume"].flatMap(first => ["success", "error"].flatMap(newer => ["success", "error"].map(older => ({ first, newer, older })))))("keeps newer $newer when older $first finishes as $older", async ({ first, newer, older }) => {
    render(surface === "dashboard" ? <Dashboard /> : <InquiriesBoard />); await tick();
    const oldRead = deferred<Collection>(), newRead = deferred<Collection>();
    api.collection.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    if (first === "manual") { manual(); await tick(); await resume(); } else { await resume(); manual(); await tick(); }
    await act(async () => { if (newer === "error") newRead.reject(new Error("Current collection failed")); else newRead.resolve(collection({ ...project, title: "Current collection" })); });
    const currentText = surface === "dashboard" ? screen.getByTestId("dashboard-projects").textContent : screen.getAllByRole("button", { name: /Synthetic inquiry|Current collection/ }).map(button => button.textContent).join();
    const currentErrors = screen.queryAllByText(/更新できませんでした|取得できませんでした/).map(node => node.textContent).join();
    if (newer === "error") expect(currentErrors.length).toBeGreaterThan(0);
    await finishRead(oldRead, older);
    expect(screen.queryByText(/Stale collection/)).toBeNull();
    expect(surface === "dashboard" ? screen.getByTestId("dashboard-projects").textContent : screen.getAllByRole("button", { name: /Synthetic inquiry|Current collection/ }).map(button => button.textContent).join()).toBe(currentText);
    expect(screen.queryAllByText(/更新できませんでした|取得できませんでした/).map(node => node.textContent).join()).toBe(currentErrors);
  });
});

describe("dashboard logout fences resume success and error", () => {
  it.each(["success", "error"])("SIGNED_OUT invalidates a pending resume %s but INITIAL_SESSION null preserves passphrase settings", async outcome => {
    render(<Dashboard />); await tick();
    const authChanged = api.authChange.mock.calls[0][0] as (event: string, session: null) => void;
    await act(async () => authChanged("INITIAL_SESSION", null));
    expect(screen.getByRole("button", { name: /プロフィール設定/ })).toBeTruthy();
    const held = deferred<Collection>(); api.collection.mockReturnValueOnce(held.promise); await resume();
    await act(async () => authChanged("SIGNED_OUT", null));
    await finishRead(held, outcome);
    expect(screen.getByTestId("dashboard-projects").textContent).toBe("Synthetic inquiry:1000:original");
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
    expect(screen.queryByText(/案件情報を更新できませんでした/)).toBeNull();
  });
  it("SIGNED_OUT invalidates a pending profile PUT", async () => {
    render(<Dashboard />); await tick();
    const held = deferred<{ userId: string; displayName: string; mutationRevision: number }>(); api.saveProfile.mockReturnValueOnce(held.promise);
    fireEvent.click(screen.getByRole("button", { name: /プロフィール設定/ }));
    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "Old pending save" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" })); await tick();
    await act(async () => api.authChange.mock.calls[0][0]("SIGNED_OUT", null));
    await act(async () => held.resolve({ userId: "synthetic-owner", displayName: "Old pending save", mutationRevision: 2 }));
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
  });
  it.each(["during", "after"].flatMap(timing => ["success", "error"].map(outcome => ({ timing, outcome }))))("ignores old resume $outcome $timing logout", async ({ timing, outcome }) => {
    render(<Dashboard />); await tick();
    const held = deferred<Collection>(), logout = deferred<{ error: null }>();
    api.collection.mockReturnValueOnce(held.promise); api.signout.mockReturnValueOnce(logout.promise); await resume();
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" })); await tick();
    await resume(); expect(api.collection).toHaveBeenCalledTimes(2);
    if (timing === "after") await act(async () => logout.resolve({ error: null }));
    await finishRead(held, outcome);
    expect(screen.getByTestId("dashboard-projects").textContent).toBe("Synthetic inquiry:1000:original");
    expect(screen.queryByText(/案件情報を更新できませんでした/)).toBeNull();
    if (timing === "during") await act(async () => logout.resolve({ error: null }));
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
    expect(api.profile).toHaveBeenCalledTimes(1);
  });
});

describe("late inquiry lifecycle responses preserve the active detail session", () => {
  it.each(["payment", "decline"].flatMap(action => ["success", "error"].flatMap(outcome => [false, true].map(reopen => ({ action, outcome, reopen })))))("$action $outcome cannot close or error a new draft (reopen A: $reopen)", async ({ action, outcome, reopen }) => {
    const a: NatoriProject = { ...project, status: "awaiting_payment" };
    const b: NatoriProject = { ...project, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Second inquiry" };
    api.collection.mockResolvedValue({ projects: [a, b], archivedProjects: [] });
    api.detail.mockImplementation(async (id: string) => id === a.id ? a : b);
    const held = deferred<void>(); (action === "payment" ? api.payment : api.close).mockReturnValueOnce(held.promise);
    render(<InquiriesBoard />); await tick(); await openDetail();
    fireEvent.click(screen.getByRole("button", { name: action === "payment" ? "入金確認してラフ開始" : "見送りにする" })); await tick();
    await closeDetail();
    fireEvent.click(screen.getAllByRole("button", { name: /Second inquiry/ })[0]); await tick();
    if (reopen) { await closeDetail(); await openDetail(); }
    fireEvent.click(screen.getByText("案件の設定"));
    const before = (screen.getByLabelText("金額（円）") as HTMLInputElement).value;
    if (!reopen) fireEvent.change(screen.getByLabelText("金額（円）"), { target: { value: "7500" } });
    await act(async () => { if (outcome === "error") held.reject(new Error("Old lifecycle failure")); else held.resolve(); });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByLabelText("金額（円）") as HTMLInputElement).value).toBe(reopen ? before : "7500");
    expect(screen.queryByText("Old lifecycle failure")).toBeNull();
  });
});

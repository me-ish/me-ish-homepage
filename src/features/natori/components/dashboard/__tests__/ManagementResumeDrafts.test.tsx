// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NatoriDashboardPage from "@/app/[locale]/natori/dashboard/page";
import InquiriesBoard from "../InquiriesBoard";
import type { NatoriProject } from "../../../types/projects";

const mocks = vi.hoisted(() => ({ collection: vi.fn(), project: vi.fn(), profile: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", () => ({
  fetchNatoriProjectCollection: mocks.collection, fetchNatoriProject: mocks.project,
  closeNatoriProject: vi.fn(), confirmNatoriProjectPayment: vi.fn(), confirmNatoriProjectType: vi.fn(),
  updateNatoriProjectDetails: vi.fn(), updateNatoriProjectStatus: vi.fn(),
}));
vi.mock("@/features/natori/data/supabaseProfile", () => ({ fetchOwnNatoriProfile: mocks.profile, upsertOwnNatoriProfile: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getUser: async () => ({ data: { user: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
} }) }));
vi.mock("@/features/natori/components/admin/NatoriPageShell", () => ({ NatoriPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("../DashboardTodaySummary", () => ({ default: ({ projects }: { projects: NatoriProject[] | null }) => <div data-testid="project-count">{projects?.length}</div> }));
vi.mock("../ConsultationAttentionPanel", () => ({ default: () => null }));
vi.mock("../NotificationStatusPanel", () => ({ default: () => null }));
vi.mock("../NotificationAlertBanner", () => ({ default: () => null }));
vi.mock("../PageEventsPanel", () => ({ default: () => null }));
vi.mock("../ProjectActivityTimeline", () => ({ default: () => null }));

const project: NatoriProject = {
  id: "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c", title: "復帰時の架空案件", clientName: "架空依頼者",
  clientEmail: "audit@example.invalid", status: "inquiry", type: "undecided", amount: 1000, dueDate: null,
  nextAction: "確認", createdAt: "2026-10-17T00:00:00Z", tasks: [],
  consultation: { latestMessageId: "message", latestSender: "client", latestMessageAt: "2026-10-17T00:00:00Z",
    notificationFailed: 0, notificationPending: 0, roughOkPending: 0, latestRoughOkId: null, latestRoughOkAt: null },
};
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const resume = async () => { await tick(1100); await act(async () => { window.dispatchEvent(new Event("focus")); }); };

beforeEach(() => {
  vi.useFakeTimers(); sessionStorage.clear();
  window.history.replaceState(null, "", "/natori/inquiries");
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  mocks.collection.mockReset().mockImplementation(async () => ({ projects: [{ ...project }], archivedProjects: [] }));
  mocks.project.mockReset().mockImplementation(async () => ({ ...project }));
  // A full profile reload returns a fresh object and would reset the real form.
  mocks.profile.mockReset().mockImplementation(async () => ({ userId: "synthetic-owner", displayName: "保存済みの名前" }));
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.useRealTimers(); });

describe("resume refresh preserves other management drafts", () => {
  it("refreshes dashboard counts without replacing unsaved profile inputs", async () => {
    render(<NatoriDashboardPage />); await tick();
    fireEvent.click(screen.getByRole("button", { name: /プロフィール設定/ }));
    const input = screen.getByRole("textbox", { name: "表示名" }) as HTMLInputElement;
    expect(input.value).toBe("保存済みの名前");
    fireEvent.change(input, { target: { value: "編集中の名前" } });
    mocks.collection.mockResolvedValue({ projects: [project, { ...project, id: "another-project" }], archivedProjects: [] });
    await resume();
    expect(screen.getByTestId("project-count").textContent).toBe("2");
    expect(mocks.profile).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("編集中の名前");
  });

  it("does not refresh the inquiry collection while its detail form is being edited", async () => {
    render(<InquiriesBoard />); await tick();
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(project.title) })[0]); await tick();
    expect(screen.getByRole("dialog")).toBeTruthy();
    const input = screen.getByLabelText("金額（円）") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2500" } });
    const before = mocks.collection.mock.calls.length;
    await resume();
    expect(mocks.collection).toHaveBeenCalledTimes(before);
    expect(input.value).toBe("2500");
    fireEvent.click(screen.getByRole("button", { name: /^閉じる$/ })); await tick();
    await resume();
    expect(mocks.collection).toHaveBeenCalledTimes(before + 1);
  });

  it("ignores an earlier slow resume response after an inquiry editor has opened", async () => {
    render(<InquiriesBoard />); await tick();
    let finish = (_data: { projects: NatoriProject[]; archivedProjects: NatoriProject[] }) => {};
    mocks.collection.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await resume();
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(project.title) })[0]); await tick();
    const input = screen.getByLabelText("金額（円）") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2500" } });
    mocks.project.mockResolvedValue({ ...project, amount: 9999 });
    await act(async () => finish({ projects: [{ ...project, amount: 9999 }], archivedProjects: [] }));
    expect(input.value).toBe("2500");
  });
});

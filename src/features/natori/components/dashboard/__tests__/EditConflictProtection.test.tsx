// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "../../../types/projects";
import { NatoriEditConflictError, projectEditSnapshot, type ProjectEditSnapshot } from "../../../lib/editConflict";

const api = vi.hoisted(() => ({ latest: vi.fn(), profile: vi.fn(), saveProfile: vi.fn(), collection: vi.fn(), authUser: vi.fn(), signout: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", async () => ({
  ...await vi.importActual<typeof import("@/features/natori/data/supabaseProjects")>("@/features/natori/data/supabaseProjects"),
  fetchNatoriProject: api.latest, fetchNatoriProjectCollection: api.collection,
}));
vi.mock("@/features/natori/data/supabaseProfile", () => ({ fetchOwnNatoriProfile: api.profile, upsertOwnNatoriProfile: api.saveProfile }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getUser: api.authUser, signOut: api.signout, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }) }));
vi.mock("@/features/natori/components/dashboard/ConsultationAttentionPanel", () => ({ default: ({ onRefresh }: { onRefresh: () => void }) => <button onClick={onRefresh}>Refresh</button> }));
vi.mock("@/features/natori/components/dashboard/DashboardTodaySummary", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/NotificationStatusPanel", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/NotificationAlertBanner", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/PageEventsPanel", () => ({ default: () => null }));
vi.mock("@/features/natori/components/admin/NatoriPageShell", () => ({ NatoriPageShell: ({ children, headerRight }: { children: React.ReactNode; headerRight: React.ReactNode }) => <main>{headerRight}{children}</main> }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import ProjectEditForm from "../ProjectEditForm";
import InquiryAdminCorrectionForm from "../inquiry/InquiryAdminCorrectionForm";
import Dashboard from "@/app/[locale]/natori/dashboard/page";

const project: NatoriProject = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Original", clientName: "Synthetic", amount: 10000,
  type: "illustration", status: "inquiry", deliveryPlan: "normal", dueDate: null, note: "Original note", nextAction: "Review", tasks: [], mutationRevision: 1 };
const compareLabel = "最新の保存済み内容を取得して比較";
const acknowledgeLabel = "比較内容を確認し、最新の保存済み内容を基準にする";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { vi.resetAllMocks(); api.authUser.mockResolvedValue({ data: { user: null } }); api.collection.mockResolvedValue({ projects: [], archivedProjects: [] }); });
afterEach(cleanup);

describe("Q03 actual edit forms", () => {
  it("fences the old title-only writer, preserves its draft and rebases only its dirty intent after explicit review", async () => {
    let stored = projectEditSnapshot(project);
    const save = vi.fn(async (patch, revision) => {
      if (revision !== stored.mutationRevision) throw new NatoriEditConflictError();
      stored = { ...stored, ...patch, mutationRevision: stored.mutationRevision + 1 };
      return stored;
    });
    const a = render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    const b = render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    const A = within(a.container), B = within(b.container);
    fireEvent.change(A.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "Note A" } });
    fireEvent.click(A.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(stored.note).toBe("Note A"));
    fireEvent.change(B.getByLabelText("案件タイトル（必須）"), { target: { value: "Title B" } });
    fireEvent.click(B.getByRole("button", { name: "保存" }));
    await B.findByRole("region", { name: "保存内容の比較" });
    expect(save.mock.calls[1]).toEqual([{ title: "Title B" }, 1]);
    expect(stored.title).toBe("Original"); expect(stored.note).toBe("Note A");
    expect((B.getByLabelText("案件タイトル（必須）") as HTMLInputElement).value).toBe("Title B");
    api.latest.mockImplementation(async () => ({ ...project, ...stored }));
    fireEvent.click(B.getByRole("button", { name: compareLabel }));
    await B.findByRole("button", { name: acknowledgeLabel });
    expect((B.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Original note");
    expect(save).toHaveBeenCalledTimes(2);
    fireEvent.click(B.getByRole("button", { name: acknowledgeLabel }));
    expect((B.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Note A");
    expect(save).toHaveBeenCalledTimes(2);
    fireEvent.click(B.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(stored.title).toBe("Title B"));
    expect(save.mock.calls[2]).toEqual([{ title: "Title B" }, 2]); expect(stored.note).toBe("Note A");
  });

  it("a further update after comparison conflicts again rather than overwriting", async () => {
    const save = vi.fn().mockRejectedValue(new NatoriEditConflictError());
    render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("region", { name: "保存内容の比較" });
    api.latest.mockResolvedValue({ ...project, mutationRevision: 2, note: "Someone else" });
    fireEvent.click(screen.getByRole("button", { name: compareLabel }));
    fireEvent.click(await screen.findByRole("button", { name: acknowledgeLabel }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]).toEqual([{ note: "Draft" }, 2]);
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Draft");
    await screen.findByRole("region", { name: "保存内容の比較" });
  });

  it("keeps edits during prop refresh, blocks duplicate saves and inputs until an authoritative response", async () => {
    const pending = deferred<ProjectEditSnapshot>(), save = vi.fn(() => pending.promise);
    const view = render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "Draft" } });
    view.rerender(<ProjectEditForm project={{ ...project, title: "Refreshed", mutationRevision: 2 }} onCancel={vi.fn()} onSave={save} />);
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Draft");
    const button = screen.getByRole("button", { name: "保存" });
    fireEvent.click(button); fireEvent.click(button);
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: "Draft" }, 1);
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).closest("fieldset")?.disabled).toBe(true);
    await act(async () => pending.resolve({ ...projectEditSnapshot(project), note: "Draft", mutationRevision: 3 }));
    view.rerender(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Draft");
  });

  it("does not retry an uncertain save, and a read alone never changes its draft", async () => {
    const save = vi.fn().mockRejectedValue(new TypeError("network disconnected"));
    render(<ProjectEditForm project={project} onCancel={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("依頼内容・確認事項メモ"), { target: { value: "Held draft" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("region", { name: "保存内容の比較" });
    api.latest.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ...project, note: "Saved by someone", mutationRevision: 2 });
    fireEvent.click(screen.getByRole("button", { name: compareLabel }));
    await screen.findByText("最新の保存済み内容を取得できませんでした。入力内容は保持しています。");
    fireEvent.click(screen.getByRole("button", { name: compareLabel }));
    await screen.findByRole("button", { name: acknowledgeLabel });
    expect(save).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("依頼内容・確認事項メモ") as HTMLTextAreaElement).value).toBe("Held draft");
  });

  it("saves only changed inquiry fields and next action in one request, preserving failed input", async () => {
    const save = vi.fn().mockRejectedValue(new NatoriEditConflictError());
    const view = render(<InquiryAdminCorrectionForm project={project} onSave={save} />);
    fireEvent.change(screen.getByLabelText("納品予定日"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("次のアクション"), { target: { value: "Contact" } });
    view.rerender(<InquiryAdminCorrectionForm project={{ ...project, amount: 25000, nextAction: "Other", mutationRevision: 2 }} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "確定内容を保存" }));
    await screen.findByRole("region", { name: "保存内容の比較" });
    expect(save).toHaveBeenCalledExactlyOnceWith({ dueDate: "2026-12-31" }, 1, "Contact");
    expect((screen.getByLabelText("納品予定日") as HTMLInputElement).value).toBe("2026-12-31");
  });
});

describe("Q03 actual dashboard profile", () => {
  const profile = { userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", mutationRevision: 1, displayName: "Original name", dailyCapacityHours: 4 };
  it("preserves a stale capacity edit and never sends the unchanged old display name", async () => {
    api.profile.mockResolvedValue(profile);
    api.saveProfile.mockRejectedValueOnce(new NatoriEditConflictError()).mockResolvedValue({ ...profile, displayName: "New name", dailyCapacityHours: 6, mutationRevision: 3 });
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: /プロフィール設定/ }));
    fireEvent.change(screen.getByLabelText(/1日の作業時間/), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("region", { name: "保存内容の比較" });
    expect(api.saveProfile).toHaveBeenCalledExactlyOnceWith({ dailyCapacityHours: 6 }, 1);
    api.profile.mockResolvedValue({ ...profile, displayName: "New name", mutationRevision: 2 });
    fireEvent.click(screen.getByRole("button", { name: compareLabel }));
    fireEvent.click(await screen.findByRole("button", { name: acknowledgeLabel }));
    expect((screen.getByLabelText("表示名") as HTMLInputElement).value).toBe("New name");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("保存しました。");
    expect(api.saveProfile.mock.calls[1]).toEqual([{ dailyCapacityHours: 6 }, 2]);
  });
  it("does not treat failed initial profile reads as a create-only save", async () => {
    api.profile.mockRejectedValue(new Error("offline"));
    render(<Dashboard />);
    await screen.findByRole("button", { name: "プロフィールを再取得" });
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
    expect(api.saveProfile).not.toHaveBeenCalled();
  });
  it.each(["before", "during"])("an old PUT begun %s logout cannot restore its profile editor", async timing => {
    const logout = deferred<{ error: null }>(), saved = deferred<typeof profile>();
    api.authUser.mockResolvedValue({ data: { user: { email: "staff@q03.invalid" } } });
    api.profile.mockResolvedValue(profile); api.signout.mockReturnValue(logout.promise); api.saveProfile.mockReturnValue(saved.promise);
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole("button", { name: /プロフィール設定/ }));
    if (timing === "during") fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    fireEvent.change(screen.getByLabelText("表示名"), { target: { value: "Pending" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.saveProfile).toHaveBeenCalledOnce());
    if (timing === "before") fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await act(async () => logout.resolve({ error: null }));
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
    await act(async () => saved.resolve({ ...profile, displayName: "Pending", mutationRevision: 2 }));
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
  });
  it("a delayed refresh GET cannot restore the profile editor after logout", async () => {
    const held = deferred<typeof profile>();
    api.authUser.mockResolvedValue({ data: { user: { email: "staff@q03.invalid" } } });
    api.profile.mockResolvedValueOnce(profile).mockReturnValueOnce(held.promise); api.signout.mockResolvedValue({ error: null });
    render(<Dashboard />);
    await screen.findByRole("button", { name: /プロフィール設定/ });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.profile).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull());
    await act(async () => held.resolve({ ...profile, mutationRevision: 2 }));
    expect(screen.queryByRole("button", { name: /プロフィール設定/ })).toBeNull();
  });
});

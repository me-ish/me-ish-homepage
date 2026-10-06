// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "@/features/natori/types/projects";
import { NatoriToastProvider } from "@/features/natori/components/admin/NatoriToast";

const api = vi.hoisted(() => ({ fetch: vi.fn(), events: vi.fn(), status: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", () => ({
  fetchNatoriProjectCollection: api.fetch,
  toggleNatoriTaskDone: vi.fn(),
  NatoriTaskConflictError: class extends Error {},
  confirmNatoriProjectPayment: vi.fn(),
  deleteNatoriProject: vi.fn(),
  restoreNatoriProject: vi.fn(),
  updateNatoriProjectDetails: vi.fn(),
  updateNatoriProjectStatus: api.status,
}));
vi.mock("@/features/natori/data/supabaseEvents", () => ({
  fetchNatoriEvents: api.events,
  createNatoriEvent: vi.fn(),
  deleteNatoriEvent: vi.fn(),
  updateNatoriEvent: vi.fn(),
}));
vi.mock("@/features/natori/components/dashboard/ProjectCard", () => ({
  default: ({ project, onAdvanceStatus }: { project: NatoriProject; onAdvanceStatus?: (project: NatoriProject) => void }) => (
    <article>
      <output data-testid="state">{project.status}/{project.nextAction}</output>
      <button onClick={() => onAdvanceStatus?.(project)}>advance</button>
    </article>
  ),
}));
vi.mock("@/features/natori/components/dashboard/ProjectMonthCalendar", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectDayDetail", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectPriorityList", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ClosedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ArchivedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm", () => ({
  default: ({ onCreated, onClose }: { onCreated: () => void; onClose?: () => void }) => (
    <button onClick={() => { onCreated(); onClose?.(); }}>Reload fixture</button>
  ),
}));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel", () => ({ default: () => null }));
import ProjectsBoard from "../ProjectsBoard";

const stamp = "2026-10-01T12:00:00.000Z";
const project = (status: NatoriProject["status"], nextAction: string): NatoriProject => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Synthetic",
  clientName: "Synthetic",
  amount: 12000,
  type: "illustration",
  status,
  nextAction,
  dueDate: null,
  tasks: [],
  paymentConfirmedAt: stamp,
  mutationRevision: 1,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function mountSupabase(initial: NatoriProject) {
  api.fetch.mockResolvedValue({ projects: [initial], archivedProjects: [] });
  api.events.mockResolvedValue([]);
  api.status.mockResolvedValue(undefined);
  render(
    <NatoriToastProvider>
      <ProjectsBoard />
    </NatoriToastProvider>,
  );
  await screen.findByRole("button", { name: "advance" });
}

describe("ProjectsBoard 「元に戻す」 after advancing a stage (Q-03)", () => {
  it("offers undo for a production stage and restores both status and next action", async () => {
    await mountSupabase(project("rough", "ラフ提出"));
    api.fetch.mockResolvedValue({ projects: [project("lineart", "線画作業")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    await screen.findByText("「線画」にしました");
    expect(api.status).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "lineart", "線画作業");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("lineart/線画作業"));

    api.fetch.mockResolvedValue({ projects: [project("rough", "ラフ提出")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() =>
      expect(api.status).toHaveBeenLastCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "rough", "ラフ提出"),
    );
    await screen.findByText("「ラフ」に戻しました");
    expect(screen.getByTestId("state").textContent).toBe("rough/ラフ提出");
    expect(api.status).toHaveBeenCalledTimes(2);
  });

  it("does not offer undo before an order (those stages only move forward)", async () => {
    await mountSupabase(project("quoted", "案件化（入金待ちへ）"));
    api.fetch.mockResolvedValue({ projects: [project("awaiting_payment", "入金確認後、ラフ開始")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    await waitFor(() => expect(api.status).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("awaiting_payment/入金確認後、ラフ開始"));
    expect(screen.queryByRole("button", { name: "元に戻す" })).toBeNull();
    expect(screen.queryByText(/にしました/)).toBeNull();
  });

  it("a second advance replaces the first toast, so only the latest step can be undone", async () => {
    await mountSupabase(project("rough", "ラフ提出"));
    api.fetch.mockResolvedValue({ projects: [project("lineart", "線画作業")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    await screen.findByText("「線画」にしました");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("lineart/線画作業"));

    api.fetch.mockResolvedValue({ projects: [project("coloring", "着彩作業")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    await screen.findByText("「着彩」にしました");
    expect(screen.queryByText("「線画」にしました")).toBeNull();
    expect(screen.getAllByRole("button", { name: "元に戻す" })).toHaveLength(1);

    api.fetch.mockResolvedValue({ projects: [project("lineart", "線画作業")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await waitFor(() =>
      expect(api.status).toHaveBeenLastCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "lineart", "線画作業"),
    );
  });

  it("refuses to undo when the confirmed stage is no longer the one that was set", async () => {
    await mountSupabase(project("rough", "ラフ提出"));
    api.fetch.mockResolvedValue({ projects: [project("lineart", "線画作業")], archivedProjects: [] });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    await screen.findByText("「線画」にしました");
    // 別の場所で工程が着彩に変わり、画面の再読み込みで反映された
    api.fetch.mockResolvedValue({ projects: [project("coloring", "着彩作業")], archivedProjects: [] });
    fireEvent.click(await screen.findByRole("button", { name: "案件を登録" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reload fixture" }));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("coloring/着彩作業"));
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await screen.findByText("工程が変わっていたため、元に戻しませんでした");
    expect(api.status).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectsBoard 「元に戻す」 in local (demo) data", () => {
  it("restores the previous stage locally", async () => {
    render(
      <NatoriToastProvider>
        <ProjectsBoard demoProjects={[project("coloring", "着彩作業")]} />
      </NatoriToastProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "advance" }));
    await screen.findByText("「確認待ち」にしました");
    expect(screen.getByTestId("state").textContent).toBe("waiting/返信待ち");
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await screen.findByText("「着彩」に戻しました");
    expect(screen.getByTestId("state").textContent).toBe("coloring/着彩作業");
    expect(api.status).not.toHaveBeenCalled();
  });
});

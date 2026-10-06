// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "@/features/natori/types/projects";
import { NatoriToastProvider } from "@/features/natori/components/admin/NatoriToast";

const api = vi.hoisted(() => ({ fetch: vi.fn(), events: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", () => ({
  fetchNatoriProjectCollection: api.fetch,
  toggleNatoriTaskDone: vi.fn(),
  NatoriTaskConflictError: class extends Error {},
  confirmNatoriProjectPayment: vi.fn(),
  deleteNatoriProject: vi.fn(),
  restoreNatoriProject: vi.fn(),
  updateNatoriProjectDetails: vi.fn(),
  updateNatoriProjectStatus: vi.fn(),
}));
vi.mock("@/features/natori/data/supabaseEvents", () => ({
  fetchNatoriEvents: api.events,
  createNatoriEvent: vi.fn(),
  deleteNatoriEvent: vi.fn(),
  updateNatoriEvent: vi.fn(),
}));
vi.mock("@/features/natori/components/dashboard/ProjectCard", () => ({
  default: ({ project, highlighted }: { project: NatoriProject; highlighted?: boolean }) => (
    <article aria-label={project.title} data-highlighted={highlighted ? "true" : "false"} />
  ),
}));
vi.mock("@/features/natori/components/dashboard/ProjectDayDetail", () => ({
  default: ({ selectedISO, highlightProjectId }: { selectedISO: string; highlightProjectId?: string | null }) => (
    <output data-testid="day" data-selected={selectedISO} data-highlight={highlightProjectId ?? ""} />
  ),
}));
vi.mock("@/features/natori/components/dashboard/ProjectListView", () => ({ default: () => <p>list-view</p> }));
vi.mock("@/features/natori/components/dashboard/ProjectMonthCalendar", () => ({
  default: ({ year, monthIndex }: { year: number; monthIndex: number }) => <output data-testid="month">{year}-{monthIndex + 1}</output>,
}));
vi.mock("@/features/natori/components/dashboard/ProjectPriorityList", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ClosedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ArchivedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel", () => ({ default: () => null }));
import ProjectsBoard from "../ProjectsBoard";

const stamp = "2026-10-01T12:00:00.000Z";
const dated: NatoriProject = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Dated",
  clientName: "Synthetic",
  amount: 12000,
  type: "illustration",
  status: "rough",
  nextAction: "ラフ提出",
  dueDate: "2027-03-15",
  tasks: [],
  paymentConfirmedAt: stamp,
  mutationRevision: 1,
};
const undated: NatoriProject = { ...dated, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Undated", dueDate: null };
const closed: NatoriProject = { ...dated, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Closed", status: "closed" };

function mount() {
  api.fetch.mockResolvedValue({ projects: [dated, undated, closed], archivedProjects: [] });
  api.events.mockResolvedValue([]);
  return render(
    <NatoriToastProvider>
      <ProjectsBoard />
    </NatoriToastProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("ProjectsBoard ?project= deep link (Q-02)", () => {
  it("jumps to the due date and month of the linked project and highlights it", async () => {
    window.history.replaceState({}, "", `/natori/projects?project=${dated.id}`);
    mount();
    await waitFor(() => expect(screen.getByTestId("day").getAttribute("data-highlight")).toBe(dated.id));
    expect(screen.getByTestId("day").getAttribute("data-selected")).toBe("2027-03-15");
    expect(screen.getByTestId("month").textContent).toBe("2027-3");
  });

  it("opens the calendar view even when the saved preference is the list", async () => {
    window.localStorage.setItem("natori-projects-view", "list");
    window.history.replaceState({}, "", `/natori/projects?project=${dated.id}`);
    mount();
    await waitFor(() => expect(screen.getByTestId("day").getAttribute("data-highlight")).toBe(dated.id));
    expect(screen.queryByText("list-view")).toBeNull();
    // 好みの保存は書き換えない
    expect(window.localStorage.getItem("natori-projects-view")).toBe("list");
  });

  it("highlights an undated project in its own section", async () => {
    window.history.replaceState({}, "", `/natori/projects?project=${undated.id}`);
    mount();
    await waitFor(() => expect(screen.getByRole("article", { name: "Undated" }).getAttribute("data-highlighted")).toBe("true"));
  });

  it("clears the highlight after a few seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.history.replaceState({}, "", `/natori/projects?project=${undated.id}`);
    mount();
    await waitFor(() => expect(screen.getByRole("article", { name: "Undated" }).getAttribute("data-highlighted")).toBe("true"));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByRole("article", { name: "Undated" }).getAttribute("data-highlighted")).toBe("false");
  });

  it("says so when the linked project is closed, deleted or unknown", async () => {
    window.history.replaceState({}, "", `/natori/projects?project=${closed.id}`);
    mount();
    await screen.findByText(/リンク先の案件が見つかりませんでした/);
    expect(screen.getByTestId("day").getAttribute("data-highlight")).toBe("");
    expect(screen.getByRole("article", { name: "Undated" }).getAttribute("data-highlighted")).toBe("false");
  });

  it("does nothing without the parameter", async () => {
    mount();
    await screen.findByTestId("day");
    expect(screen.getByTestId("day").getAttribute("data-highlight")).toBe("");
    expect(screen.queryByText(/リンク先の案件/)).toBeNull();
  });
});

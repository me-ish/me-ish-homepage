// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NatoriProject } from "@/features/natori/types/projects";

vi.mock("@/features/natori/data/supabaseProjects", () => ({
  fetchNatoriProjectCollection: vi.fn(),
  toggleNatoriTaskDone: vi.fn(),
  NatoriTaskConflictError: class extends Error {},
  confirmNatoriProjectPayment: vi.fn(),
  deleteNatoriProject: vi.fn(),
  restoreNatoriProject: vi.fn(),
  updateNatoriProjectDetails: vi.fn(),
  updateNatoriProjectStatus: vi.fn(),
}));
vi.mock("@/features/natori/data/supabaseEvents", () => ({
  fetchNatoriEvents: vi.fn(),
  createNatoriEvent: vi.fn(),
  deleteNatoriEvent: vi.fn(),
  updateNatoriEvent: vi.fn(),
}));
// 実データ（デモの案件）をそのまま渡し、各案件の「工程を進める」だけを取り出す
vi.mock("@/features/natori/components/dashboard/ProjectDayDetail", () => ({
  default: ({
    allProjects,
    onAdvanceStatus,
  }: {
    allProjects: NatoriProject[];
    onAdvanceStatus?: (project: NatoriProject) => void;
  }) => (
    <ul>
      {allProjects.map((project) => (
        <li key={project.id}>
          <output data-testid={`state-${project.id}`}>{project.status}</output>
          <button onClick={() => onAdvanceStatus?.(project)}>advance {project.title}</button>
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("@/features/natori/components/dashboard/ProjectMonthCalendar", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectPriorityList", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ClosedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ArchivedProjectsSection", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel", () => ({ default: () => null }));
import { DemoProjects } from "../DemoBoards";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("Etorie demo project board notifications", () => {
  it("shows the 「元に戻す」 toast after advancing a production stage and undoes it", async () => {
    render(<DemoProjects />);
    fireEvent.click(await screen.findByRole("button", { name: "advance ファンアートアイコン" }));
    await screen.findByText("「線画」にしました");

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    await screen.findByText("「ラフ」に戻しました");
    const states = screen.getAllByTestId(/^state-/).map((node) => node.textContent);
    expect(states).toContain("rough");
  });

  it("tells the visitor when a ?project= link points at no project", async () => {
    window.history.replaceState(null, "", "/?project=not-in-the-demo");
    render(<DemoProjects />);
    await waitFor(() =>
      expect(
        screen.getByText("リンク先の案件が見つかりませんでした。見送り・削除された可能性があります。"),
      ).toBeTruthy(),
    );
  });
});

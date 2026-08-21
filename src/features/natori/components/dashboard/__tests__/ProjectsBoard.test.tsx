// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import ProjectsBoard from "@/features/natori/components/dashboard/ProjectsBoard";
import { createTasksForType } from "@/features/natori/lib/projects";
import type { NatoriProject } from "@/features/natori/types/projects";

function project(): NatoriProject {
  return {
    id: "project-focus-target",
    title: "記念イラスト",
    clientName: "テスト依頼者",
    amount: 15_000,
    dueDate: "2026-09-30",
    status: "rough",
    nextAction: "ラフを仕上げる",
    type: "illustration",
    tasks: createTasksForType("illustration"),
  };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/natori/projects?project=project-focus-target");
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("ProjectsBoard", () => {
  it("focuses the project requested by the dashboard link", async () => {
    render(<ProjectsBoard demoProjects={[project()]} demoEvents={[]} />);

    await waitFor(() => {
      expect(
        document
          .getElementById("natori-project-project-focus-target")
          ?.getAttribute("data-focused")
      ).toBe("true");
    });
  });
});

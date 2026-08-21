// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProjectDayDetail from "@/features/natori/components/dashboard/ProjectDayDetail";
import {
  computeProjectBars,
  createTasksForType,
  getAdvanceButtonLabel,
} from "@/features/natori/lib/projects";
import type { NatoriProject } from "@/features/natori/types/projects";

beforeEach(() => {
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProjectDayDetail", () => {
  it("keeps edit and progress actions on an active project before its due date", () => {
    const today = new Date(2026, 8, 1);
    const project: NatoriProject = {
      id: "project-active-day",
      title: "SNSアイコン",
      clientName: "テスト依頼者",
      amount: 5_000,
      dueDate: "2026-09-30",
      status: "rough",
      nextAction: "ラフを仕上げる",
      type: "icon",
      tasks: createTasksForType("icon"),
    };
    const activeDate = computeProjectBars(project, today).find(
      (bar) => bar.startISO !== project.dueDate
    )?.startISO;
    expect(activeDate).toBeTruthy();

    render(
      <ProjectDayDetail
        selectedISO={activeDate!}
        allProjects={[project]}
        today={today}
        onToggleTask={() => undefined}
        onAdvanceStatus={() => undefined}
        onConfirmPayment={() => undefined}
        onOpenMail={() => undefined}
        onEditDetails={async () => undefined}
        events={[]}
        authed={false}
        eventsBusy={false}
        eventsError={null}
        onCreateEvent={async () => undefined}
        onUpdateEvent={async () => undefined}
        onDeleteEvent={async () => undefined}
      />
    );

    expect(screen.getByRole("button", { name: "編集" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: getAdvanceButtonLabel(project.status)! })
    ).toBeTruthy();
  });
});

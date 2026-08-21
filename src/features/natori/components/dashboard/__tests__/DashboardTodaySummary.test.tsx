// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DashboardTodaySummary from "@/features/natori/components/dashboard/DashboardTodaySummary";
import { createTasksForType } from "@/features/natori/lib/projects";
import type { NatoriProject } from "@/features/natori/types/projects";

afterEach(cleanup);

describe("DashboardTodaySummary", () => {
  it("links the recommended item directly to its project", () => {
    const project: NatoriProject = {
      id: "project-direct-link",
      title: "配信用立ち絵",
      clientName: "テスト依頼者",
      amount: 12_000,
      dueDate: "2026-09-10",
      status: "rough",
      nextAction: "ラフを仕上げる",
      type: "standing",
      tasks: createTasksForType("standing"),
    };

    render(
      <DashboardTodaySummary projects={[project]} today={new Date(2026, 8, 1)} />
    );

    expect(
      screen
        .getByRole("link", { name: /テスト依頼者｜配信用立ち絵/ })
        .getAttribute("href")
    ).toBe("/natori/projects?project=project-direct-link");
  });
});

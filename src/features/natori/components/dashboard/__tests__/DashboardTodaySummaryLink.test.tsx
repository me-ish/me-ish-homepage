// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DashboardTodaySummary from "../DashboardTodaySummary";
import type { NatoriProject } from "../../../types/projects";

afterEach(cleanup);

const project: NatoriProject = {
  id: "top-priority-1",
  title: "Top fixture",
  clientName: "Synthetic client",
  type: "illustration",
  status: "rough",
  nextAction: "ラフ提出",
  tasks: [{ id: "t", label: "ラフ", stage: "rough", done: false }],
  dueDate: "2026-10-08",
  amount: 12000,
  paidAmount: 12000,
  paidAt: "2026-10-01T00:00:00Z",
};

describe("DashboardTodaySummary top-priority link (Q-02)", () => {
  it("opens the project board on the top project", () => {
    render(<DashboardTodaySummary projects={[project]} today={new Date("2026-10-02T00:00:00Z")} />);
    const link = screen.getByRole("link", { name: /最優先/ });
    expect(link.getAttribute("href")).toBe("/natori/projects?project=top-priority-1");
  });

  it("keeps the plain board link in the header", () => {
    render(<DashboardTodaySummary projects={[project]} today={new Date("2026-10-02T00:00:00Z")} />);
    expect(screen.getByRole("link", { name: /案件管理へ/ }).getAttribute("href")).toBe("/natori/projects");
  });
});

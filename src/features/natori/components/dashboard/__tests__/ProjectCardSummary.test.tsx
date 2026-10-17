// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import ProjectCard from "../ProjectCard";
import { consultationNeedsAttention } from "../../../lib/consultationOverview";
import type { NatoriProject } from "../../../types/projects";
import type { ConsultationOverview } from "../../../types/consultation";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const quietConsultation: ConsultationOverview = {
  latestMessageId: null, latestSender: null, latestMessageAt: null,
  notificationFailed: 0, notificationPending: 0, roughOkPending: 0, latestRoughOkId: null, latestRoughOkAt: null,
};

function paidProject(overrides: Partial<NatoriProject> = {}): NatoriProject {
  return {
    id: "summary-fixture",
    title: "Summary fixture",
    clientName: "Synthetic client",
    type: "illustration",
    status: "lineart",
    nextAction: "線画を仕上げる",
    tasks: [{ id: "line-task", label: "線画", stage: "lineart", done: false }],
    dueDate: "2026-11-30",
    amount: 12000,
    paidAmount: 12000,
    paidAt: "2026-10-01T00:00:00Z",
    refunds: { available: true, originalMapped: true, confirmedAmount: 0, pendingCount: 0, reviewCount: 0 },
    consultation: quietConsultation,
    ...overrides,
  } as NatoriProject;
}

function renderCard(project: NatoriProject) {
  render(<ProjectCard project={project} today={new Date("2026-10-02T00:00:00Z")}
    onToggleTask={vi.fn()} onOpenMail={vi.fn()} onEditDetails={vi.fn()} />);
  return within(screen.getByRole("article", { name: project.title }));
}

describe("project card summary", () => {
  it("返金がない入金済み案件には返金の行を出さない", () => {
    const card = renderCard(paidProject());
    expect(card.queryByText(/元の入金|確定返金|純入金/)).toBeNull();
  });

  it("返金処理中があれば返金の行を出す", () => {
    const card = renderCard(paidProject({ refunds: { available: true, originalMapped: true, confirmedAmount: 0, pendingCount: 1, reviewCount: 0 } }));
    expect(card.getByText(/元の入金/)).toBeTruthy();
    expect(card.getByText(/返金処理中 1件/)).toBeTruthy();
  });

  it("短い手入力メモは「詳細」に入れず、常に見える位置に出す", () => {
    const card = renderCard(paidProject({ note: "納品前に色味を確認" }));
    const note = card.getByText("納品前に色味を確認");
    expect(note.closest("details")).toBeNull();
  });

  it("対応が要らない相談と残り作業は「詳細」に畳み、タスクとメールは表に出したまま", () => {
    const project = paidProject();
    expect(consultationNeedsAttention(project)).toBe(false);
    const card = renderCard(project);
    const details = card.getByText("詳細").closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText("相談を開く")).toBeTruthy();
    expect(within(details).getByText("現在のステージ")).toBeTruthy();
    expect(card.getByRole("button", { name: /線画/, pressed: false }).closest("details")).toBeNull();
    expect(card.getByRole("button", { name: "ラフ提出メール" }).closest("details")).toBeNull();
    expect(card.getByRole("button", { name: "納品メール" }).closest("details")).toBeNull();
  });

  it("返信が必要な相談は畳まずに表へ出す", () => {
    const project = paidProject({
      consultation: { ...quietConsultation, latestMessageId: "m1", latestSender: "client", latestMessageAt: "2026-10-01T12:00:00Z" },
    });
    expect(consultationNeedsAttention(project)).toBe(true);
    const card = renderCard(project);
    expect(card.getByText("相談を開く").closest("details")).toBeNull();
  });
});

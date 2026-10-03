// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import ProjectCard from "../ProjectCard";
import type { NatoriProject } from "../../../types/projects";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
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

function activeProject(confirmedAmount: number): NatoriProject {
  return {
    id: "active-refund-fixture",
    title: "Production refund fixture",
    clientName: "Synthetic client",
    type: "illustration",
    status: "rough",
    nextAction: "ラフ制作を続ける",
    tasks: [{ id: "rough-task", label: "ラフ線を整える", stage: "rough", done: false }],
    dueDate: null,
    amount: 12000,
    paidAmount: 12000,
    paidAt: "2026-10-01T00:00:00Z",
    refunds: {
      available: true,
      originalMapped: true,
      confirmedAmount,
      pendingCount: 2,
      reviewCount: 1,
    },
  };
}

describe("active project refund visibility", () => {
  it.each([
    { state: "一部返金", confirmedAmount: 3000, refunded: "￥3,000", net: "￥9,000" },
    { state: "全額返金", confirmedAmount: 12000, refunded: "￥12,000", net: "￥0" },
  ])("shows $state without changing production status or controls", ({ state, confirmedAmount, refunded, net }) => {
    const project = activeProject(confirmedAmount);
    const before = JSON.stringify(project);
    const onToggleTask = vi.fn();
    const onAdvanceStatus = vi.fn();
    const onConfirmPayment = vi.fn();
    const onOpenMail = vi.fn();

    render(<ProjectCard project={project} today={new Date("2026-10-02T00:00:00Z")}
      onToggleTask={onToggleTask} onAdvanceStatus={onAdvanceStatus}
      onConfirmPayment={onConfirmPayment} onOpenMail={onOpenMail} />);

    const card = within(screen.getByRole("article", { name: project.title }));
    expect(card.getByText(`元の入金 ￥12,000 / 確定返金 ${refunded} / 純入金 ${net}`)).toBeTruthy();
    expect(card.getByText(`${state} / 返金処理中 2件 / 返金要確認 1件`)).toBeTruthy();
    expect(card.getByText("ラフ", { exact: true, selector: "div" })).toBeTruthy();
    expect(card.getByText("ラフ制作を続ける")).toBeTruthy();
    expect(card.queryByRole("button", { name: /返金を実行|返金する/ })).toBeNull();
    expect(onToggleTask).not.toHaveBeenCalled();
    expect(onAdvanceStatus).not.toHaveBeenCalled();
    expect(onConfirmPayment).not.toHaveBeenCalled();
    expect(onOpenMail).not.toHaveBeenCalled();

    fireEvent.click(card.getByRole("button", { name: /タスク/ }));
    fireEvent.click(card.getByRole("button", { name: /ラフ線を整える/ }));
    expect(onToggleTask).toHaveBeenCalledWith(project.id, "rough-task");
    fireEvent.click(card.getByRole("button", { name: "線画へ進む" }));
    expect(onAdvanceStatus).toHaveBeenCalledWith(project);
    fireEvent.click(card.getByRole("button", { name: "ラフ提出メール" }));
    expect(onOpenMail).toHaveBeenCalledWith(project, "rough");
    expect(onConfirmPayment).not.toHaveBeenCalled();
    expect(JSON.stringify(project)).toBe(before);
    expect(card.getByText("ラフ", { exact: true, selector: "div" })).toBeTruthy();
  });

  it("does not present an unpaid estimate as income and keeps payment-confirmation controls", () => {
    const project: NatoriProject = {
      ...activeProject(0),
      status: "awaiting_payment",
      nextAction: "入金待ち",
      paidAt: undefined,
      paidAmount: undefined,
      refunds: { available: true, originalMapped: true, confirmedAmount: 0, pendingCount: 0, reviewCount: 0 },
    };
    const before = JSON.stringify(project);
    const onConfirmPayment = vi.fn();
    const onAdvanceStatus = vi.fn();
    render(<ProjectCard project={project} today={new Date("2026-10-02T00:00:00Z")}
      onToggleTask={vi.fn()} onConfirmPayment={onConfirmPayment} onAdvanceStatus={onAdvanceStatus} />);
    const card = within(screen.getByRole("article", { name: project.title }));
    expect(card.queryByText(/元の入金|確定返金|純入金/)).toBeNull();
    expect(card.getByText("入金待ち", { exact: true, selector: "div" })).toBeTruthy();
    expect(card.getByText("入金確認後に制作スケジュールへ反映されます。")).toBeTruthy();
    expect(onConfirmPayment).not.toHaveBeenCalled();
    fireEvent.click(card.getByRole("button", { name: "入金確認してラフ開始" }));
    expect(onConfirmPayment).toHaveBeenCalledWith(project);
    expect(onAdvanceStatus).not.toHaveBeenCalled();
    expect(JSON.stringify(project)).toBe(before);
  });

  it("keeps legacy/demo cards without a refund projection unchanged", () => {
    render(<ProjectCard project={{ ...activeProject(0), refunds: undefined }}
      today={new Date("2026-10-02T00:00:00Z")} onToggleTask={vi.fn()} />);
    const card = within(screen.getByRole("article", { name: "Production refund fixture" }));
    expect(card.queryByText(/確定返金/)).toBeNull();
    expect(card.getByText("ラフ", { exact: true, selector: "div" })).toBeTruthy();
    expect(card.getByText("ラフ制作を続ける")).toBeTruthy();
  });
});

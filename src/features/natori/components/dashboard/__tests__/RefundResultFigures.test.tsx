// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RefundResultDetails, RefundResultsSummary } from "../RefundResultFigures";
import { summarizeNatoriResults } from "../../../lib/results";
import type { NatoriProject } from "../../../types/projects";

const project: NatoriProject = { id: "fixture", title: "Synthetic", clientName: "Synthetic", type: "illustration", status: "completed",
  nextAction: "Completed", tasks: [], dueDate: null, amount: 12000, paidAmount: 12000, paidAt: "2026-10-01", completedAt: "2026-10-01",
  refunds: { available: true, originalMapped: true, confirmedAmount: 3000, pendingCount: 1, reviewCount: 1 } };

describe("refund figures", () => {
  it("shows pending/review independently from confirmed partial refund without a financial-action button", () => {
    render(<RefundResultDetails project={project} />);
    expect(screen.getByText(/一部返金 \/ 返金処理中 1件 \/ 返金要確認 1件/)).toBeTruthy();
    expect(screen.getByText(/純入金/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
  });
  it("distinguishes a known confirmed refund total from an unknown original/net", () => {
    const unknown = { ...project, amount: null, paidAmount: undefined };
    render(<RefundResultsSummary summary={summarizeNatoriResults([unknown], new Date("2026-10-02"))} />);
    expect(screen.getByText("￥3,000")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("元の入金額が不明");
    expect(screen.getByRole("status").textContent).toContain("確定返金額は記録された合計");
    expect(screen.getByRole("status").textContent).not.toContain("確定返金額と純入金額は確定していません");
    cleanup();
  });
  it("explains aggregate/CSV semantics and unavailable data", () => {
    render(<RefundResultsSummary summary={summarizeNatoriResults([{ ...project, refunds: null }], new Date("2026-10-02"))} />);
    expect(screen.getByText(/未確定・失敗・元の入金と未照合/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("未取得");
    cleanup();
  });
});

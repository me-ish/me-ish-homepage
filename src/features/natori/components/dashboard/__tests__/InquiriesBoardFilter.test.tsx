// @vitest-environment jsdom
// 問い合わせ一覧: 開いたときは「対応・確認が必要」から始まり、その件数が「すべて」を超えない（Q-06 / Q-08）。
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import InquiriesBoard from "@/features/natori/components/dashboard/InquiriesBoard";
import type { NatoriProject } from "@/features/natori/types/projects";

const stamp = "2026-10-01T12:00:00.000Z";
const client = { latestMessageId: "m", latestSender: "client" as const, latestMessageAt: stamp, notificationFailed: 0, notificationPending: 0 };
const staff = { ...client, latestSender: "staff" as const };

function project(id: string, title: string, overrides: Partial<NatoriProject> = {}): NatoriProject {
  return {
    id,
    title,
    clientName: `依頼者${id}`,
    amount: null,
    dueDate: null,
    createdAt: stamp,
    status: "inquiry",
    nextAction: "-",
    type: "illustration",
    tasks: [],
    consultation: client,
    ...overrides,
  };
}

const demo: NatoriProject[] = [
  project("a", "返信が要る案件"), // 依頼者が最後 → ナトリの返信待ち（要対応）
  project("b", "依頼者の返信待ちの案件", { consultation: staff }),
  // 終了済みで返信状況が取れない案件。以前は「要対応」に数えられ、件数が「すべて」を超えていた。
  project("c", "終了済みの案件", { status: "closed", consultation: null }),
];

afterEach(cleanup);

/** チップ内の件数だけを取り出す（ラベルの後ろに付く数字） */
function chipCount(label: RegExp): number {
  const chip = screen.getAllByRole("button", { pressed: undefined }).find((button) => label.test(button.textContent ?? ""));
  if (!chip) throw new Error(`chip not found: ${label}`);
  return Number((chip.textContent ?? "").replace(/\D+/g, ""));
}

describe("InquiriesBoard の既定フィルタと件数", () => {
  it("開いたときは「対応・確認が必要」が選ばれ、要対応の案件だけが並ぶ", () => {
    render(<InquiriesBoard demoProjects={demo} />);
    const attention = screen.getByRole("button", { name: /対応・確認が必要/ });
    expect(attention.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^すべて/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByText("依頼者a").length).toBeGreaterThan(0);
    expect(screen.queryByText("依頼者b")).toBeNull();
    expect(screen.queryByText("依頼者c")).toBeNull();
  });

  it("終了済みは「対応・確認が必要」に数えず、件数は「すべて」を超えない", () => {
    render(<InquiriesBoard demoProjects={demo} />);
    const attention = chipCount(/対応・確認が必要/);
    const all = chipCount(/^すべて/);
    expect(attention).toBe(1);
    expect(all).toBe(2);
    expect(attention).toBeLessThanOrEqual(all);
    expect(chipCount(/終了・アーカイブ/)).toBe(1);
  });

  it("要対応がゼロなら案内を出し、ボタンで「すべて」に切り替えられる", () => {
    render(<InquiriesBoard demoProjects={[demo[1]]} />);
    expect(screen.getByText("今、対応・確認が必要な問い合わせはありません")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "すべての問い合わせを表示" }));
    expect(screen.getAllByText("依頼者b").length).toBeGreaterThan(0);
  });
});

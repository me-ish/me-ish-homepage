// @vitest-environment jsdom
// 実績画面の集計タイル（Q-14）: タイプで絞り込んだときも、タイルと実績一覧が同じ範囲を指す。
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { NatoriProject } from "@/features/natori/types/projects";
import ResultsBoard from "../ResultsBoard";

afterEach(cleanup);

function completed(id: string, type: NatoriProject["type"], amount: number, completedAt: string): NatoriProject {
  return {
    id,
    title: `Fixture ${id}`,
    clientName: "Synthetic",
    amount,
    dueDate: completedAt.slice(0, 10),
    paidAt: completedAt,
    completedAt,
    status: "completed",
    nextAction: "",
    type,
    tasks: [],
  };
}

const projects = [
  completed("a", "icon", 10000, "2026-05-10T00:00:00.000Z"),
  completed("b", "icon", 20000, "2026-05-20T00:00:00.000Z"),
  completed("c", "illustration", 30000, "2026-04-05T00:00:00.000Z"),
];

function tile(label: string) {
  const heading = screen.getByText(label, { selector: "p" });
  return heading.nextElementSibling?.textContent ?? "";
}

describe("ResultsBoard type filter and summary tiles (Q-14)", () => {
  it("narrows the tiles, the scope label and the list to the chosen type, and restores them", async () => {
    render(<ResultsBoard demoProjects={projects} />);
    await waitFor(() => expect(tile("実績件数")).toBe("3件"));
    expect(tile("総入金額")).toBe("￥60,000");
    expect(screen.getByText(/集計対象: 全期間$/)).toBeTruthy();

    const typeSection = screen.getByText("タイプ別の実績").closest("section") as HTMLElement;
    fireEvent.click(within(typeSection).getByRole("button", { name: /^アイコン/ }));

    expect(tile("実績件数")).toBe("2件");
    expect(tile("総入金額")).toBe("￥30,000");
    expect(tile("平均単価")).toBe("￥15,000");
    expect(screen.getByText(/集計対象: 全期間・アイコン$/)).toBeTruthy();
    expect(screen.getByText("実績一覧（2件）")).toBeTruthy();
    // タイプ別メーターは全タイプを出したままなので、別のタイプへ切り替えられる
    expect(within(typeSection).getByRole("button", { name: /^イラスト/ })).toBeTruthy();

    fireEvent.click(within(typeSection).getByRole("button", { name: /^アイコン/ }));
    expect(tile("実績件数")).toBe("3件");
    expect(screen.getByText(/集計対象: 全期間$/)).toBeTruthy();
  });

  it("combines with a month: tiles count only that type within that month", async () => {
    render(<ResultsBoard demoProjects={projects} />);
    await waitFor(() => expect(tile("実績件数")).toBe("3件"));
    const monthSection = screen.getByText(/^月別の実績/).closest("section") as HTMLElement;
    fireEvent.click(within(monthSection).getByRole("button", { name: /^2026年4月/ }));
    expect(tile("実績件数")).toBe("1件");

    const typeSection = screen.getByText("タイプ別の実績").closest("section") as HTMLElement;
    fireEvent.click(within(typeSection).getByRole("button", { name: /^アイコン/ }));
    // 4月にアイコンの実績はない
    expect(tile("実績件数")).toBe("0件");
    expect(screen.getByText(/集計対象: 2026年4月・アイコン$/)).toBeTruthy();
    expect(screen.getByText("実績一覧（0件）")).toBeTruthy();
  });
});

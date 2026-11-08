// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../CaseWorkPanel", () => ({ CaseWorkPanel: () => null }));
import { buildPreviewRecords } from "../../../../../../scripts/natori-case-preview/fixtureReader";
import { CaseWorkspacePreview } from "../CaseWorkspacePreview";
import type { CaseWorkspaceRecord } from "../../../types/caseWorkspace";

let records: CaseWorkspaceRecord[];
beforeAll(async () => { records = await buildPreviewRecords(); });
beforeEach(() => { window.history.replaceState(null, "", "/"); vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const todayLists = () => screen.getAllByRole("region", { name: "今日やること" });

it("shows 今日やること at the top of the case list and in the empty right pane, in due order", async () => {
  render(<CaseWorkspacePreview load={async () => records} initialSearch="?entry=cases" />);
  await screen.findAllByRole("region", { name: "今日やること" });
  // スマホ用の一覧の上と、PC 用の右側。同じ部品で同じ中身。
  expect(todayLists()).toHaveLength(2);
  for (const list of todayLists()) {
    const rows = within(list).getAllByRole("link").map(link => link.textContent);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("ラフにOKが出たので制作を進める");
    expect(rows[0]).toContain("今日まで");
    expect(rows[1]).toContain("あと3日");
    expect(rows[2]).toContain("支払いリンクを送る");
  }
  expect(screen.queryByText("案件を選んでください")).toBeNull();
});

it("replaces the 予定 empty pane with the same list and opens the case at its next step", async () => {
  render(<CaseWorkspacePreview load={async () => records} initialSearch="?entry=schedule" />);
  await screen.findAllByRole("region", { name: "今日やること" });
  const [list] = todayLists();
  expect(todayLists()).toHaveLength(1);
  fireEvent.click(within(list).getByRole("link", { name: /支払いリンクを送る/ }));
  expect(window.location.search).toContain("entry=schedule");
  expect(window.location.search).toContain("section=transaction");
  expect(await screen.findByRole("heading", { name: "森の表紙イラスト" })).toBeTruthy();
});

it("keeps the トーク tab's own empty pane", async () => {
  render(<CaseWorkspacePreview load={async () => records} initialSearch="?entry=notifications" />);
  expect(await screen.findByText("案件を選んでください")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "今日やること" })).toBeNull();
});

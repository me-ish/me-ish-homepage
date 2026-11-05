// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn(), context: vi.fn(), add: vi.fn() }));
vi.mock("../../../data/supabaseCaseAdministration", () => ({ loadCaseAdministration: m.load, submitCaseAdministration: m.submit }));
vi.mock("../../../data/supabaseCaseScreen", () => ({ loadCaseContext: m.context }));
vi.mock("../../../data/supabaseCaseItems", () => ({ addCaseItem: m.add }));
import { CaseRegistration } from "../CaseRegistration";

const PID = "33333333-3333-4333-8333-333333333333";
const view = () => render(<CaseRegistration today="2026-11-05" onChanged={() => {}} onDraftChange={() => {}} onOpen={() => {}} />);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  m.add.mockResolvedValue({ kind: "ok", items: [] });
});
afterEach(cleanup);

async function prepareTwoItems() {
  fireEvent.click(await screen.findByRole("button", { name: "案件を登録" }));
  fireEvent.change(screen.getByLabelText("案件名"), { target: { value: "冬の依頼" } });
  fireEvent.change(screen.getByLabelText("お客さんの名前"), { target: { value: "架空さん" } });
  fireEvent.click(screen.getByLabelText("1つの依頼で2点以上ある"));
  const names = screen.getAllByLabelText("名前");
  fireEvent.change(names[0], { target: { value: "クリスマス等身" } });
  fireEvent.change(names[1], { target: { value: "SD" } });
  fireEvent.click(screen.getByRole("button", { name: "登録する（前に内容を表示）" }));
  expect(await screen.findByText("品目：2点（クリスマス等身、SD）")).not.toBeNull();
}

it("adds each item after the case is created", async () => {
  m.submit.mockResolvedValue({ result: "applied", projectId: PID });
  view();
  await prepareTwoItems();
  fireEvent.click(screen.getByRole("button", { name: "この内容で保存する" }));
  await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2));
  expect(m.add.mock.calls.map((c) => [c[0], c[1].title])).toEqual([[PID, "クリスマス等身"], [PID, "SD"]]);
});

it("still adds the items when the result is confirmed after a reload", async () => {
  m.submit.mockRejectedValue(new Error("通信が切れました"));
  const first = view();
  await prepareTwoItems();
  fireEvent.click(screen.getByRole("button", { name: "この内容で保存する" }));
  await screen.findByText("通信が切れました");
  first.unmount();
  m.load.mockResolvedValue({ receipt: { result: "applied", projectId: PID } });
  view();
  fireEvent.click(await screen.findByRole("button", { name: "結果を見る" }));
  await waitFor(() => expect(m.add).toHaveBeenCalledTimes(2));
  // 一度足し始めたら予定は消える（もう一度確かめても二重に足さない）。
  expect(sessionStorage.getItem("natori-case-admin/new-items")).toBeNull();
});

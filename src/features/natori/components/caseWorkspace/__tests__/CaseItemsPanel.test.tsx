// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NatoriCaseItem } from "../../../types/caseItems";

const m = vi.hoisted(() => ({ load: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../../data/supabaseCaseItems", () => ({ loadCaseItems: m.load, addCaseItem: m.add, updateCaseItem: m.update, deleteCaseItem: m.remove }));
import { CaseItemsPanel, CaseItemsProgress } from "../CaseItemsPanel";
import { useCaseItems } from "../useCaseItems";

const PID = "11111111-1111-4111-8111-111111111111";
const item = (position: number, patch: Partial<NatoriCaseItem> = {}): NatoriCaseItem => ({
  id: `i${position}`, projectId: PID, position, title: `品目${position}`, projectType: "standing", amount: 12000, dueDate: "2026-12-20",
  progress: "not_started", publicationPolicy: "unknown", publicationAllowedFrom: null, note: null, handedOverAt: null, updatedAt: "t", ...patch,
});
const draft = vi.fn();
function Harness({ progress = false }: { progress?: boolean }) {
  const store = useCaseItems(PID);
  return progress ? <CaseItemsProgress projectId={PID} store={store} disabled={false} /> : <CaseItemsPanel projectId={PID} store={store} disabled={false} onDraftChange={draft} />;
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it("lists items with their total and publication rule", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [item(1, { title: "クリスマス等身", publicationPolicy: "delayed", publicationAllowedFrom: "2026-12-26" }), item(2, { title: "SD", amount: 5000, progress: "done" })] });
  render(<Harness />);
  expect(await screen.findByText(/クリスマス等身/)).not.toBeNull();
  expect(screen.getByText("2点")).not.toBeNull();
  expect(screen.getByText("合計 17,000円")).not.toBeNull();
  expect(screen.getByText(/公開：12\/26/)).not.toBeNull();
  expect(screen.getByText("完成")).not.toBeNull();
});

it("shows nothing when items cannot be read yet", async () => {
  m.load.mockResolvedValue({ kind: "unavailable" });
  const { container } = render(<Harness />);
  await waitFor(() => expect(container.textContent).toBe(""));
});

it("adds an item and asks for a date when publication is delayed", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [] });
  m.add.mockResolvedValue({ kind: "ok", items: [item(1, { title: "正月等身" })] });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: "＋ 品目を足す" }));
  expect(draft).toHaveBeenLastCalledWith(true);
  fireEvent.change(screen.getByLabelText("名前"), { target: { value: "正月等身" } });
  fireEvent.change(screen.getByLabelText("ポートフォリオへの公開"), { target: { value: "delayed" } });
  fireEvent.click(screen.getByRole("button", { name: "足す" }));
  expect(await screen.findByText("公開してよい日を入れてください。")).not.toBeNull();
  expect(m.add).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("公開してよい日"), { target: { value: "2027-01-10" } });
  fireEvent.click(screen.getByRole("button", { name: "足す" }));
  await waitFor(() => expect(m.add).toHaveBeenCalledWith(PID, expect.objectContaining({ title: "正月等身", publicationPolicy: "delayed", publicationAllowedFrom: "2027-01-10", amount: null })));
  expect(await screen.findByText(/正月等身/)).not.toBeNull();
  expect(draft).toHaveBeenLastCalledWith(false);
});

it("keeps the form open and explains a conflict", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [item(1)] });
  m.update.mockResolvedValue({ kind: "error", message: "ほかの画面で品目が変わりました。" });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /品目1/ }));
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  expect(await screen.findByText(/ほかの画面で品目が変わりました。/)).not.toBeNull();
  expect(screen.getByRole("button", { name: "保存する" })).not.toBeNull();
});

it("shows the other screen's values after reloading a conflict", async () => {
  m.load.mockResolvedValueOnce({ kind: "ok", items: [item(1)] });
  m.update.mockResolvedValue({ kind: "error", message: "ほかの画面で品目が変わりました。" });
  render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: /品目1/ }));
  fireEvent.change(screen.getByLabelText("名前"), { target: { value: "古い下書き" } });
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  m.load.mockResolvedValueOnce({ kind: "ok", items: [item(1, { title: "別の画面で直した名前", updatedAt: "t2" })] });
  fireEvent.click(await screen.findByRole("button", { name: "読み込み直す" }));
  await waitFor(() => expect((screen.getByLabelText("名前") as HTMLInputElement).value).toBe("別の画面で直した名前"));
});

it("hides adding when the last number is already used", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [item(1), item(20)] });
  render(<Harness />);
  expect(await screen.findByText("2点")).not.toBeNull();
  expect(screen.queryByRole("button", { name: "＋ 品目を足す" })).toBeNull();
});

it("changes one item's progress from the production tab", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [item(1, { title: "クリスマス等身" }), item(2, { title: "SD", progress: "done" })] });
  m.update.mockResolvedValue({ kind: "ok", items: [item(1, { title: "クリスマス等身", progress: "in_progress" }), item(2, { title: "SD", progress: "done" })] });
  render(<Harness progress />);
  expect(await screen.findByText("1/2 完成")).not.toBeNull();
  const group = screen.getByRole("group", { name: "クリスマス等身の進み" });
  fireEvent.click(within(group).getByRole("button", { name: "制作中" }));
  await waitFor(() => expect(m.update).toHaveBeenCalledWith(PID, expect.objectContaining({ id: "i1" }), expect.objectContaining({ title: "クリスマス等身", progress: "in_progress", amount: 12000 })));
  await waitFor(() => expect(within(group).getByRole("button", { name: "制作中" }).getAttribute("aria-pressed")).toBe("true"));
});

it("shows no progress card when the case has no items", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [] });
  const { container } = render(<Harness progress />);
  await waitFor(() => expect(m.load).toHaveBeenCalled());
  expect(container.textContent).toBe("");
});

it("records an early handover for a finished item and clears it when the item goes back", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-18T15:30:00Z")); // 日本時間 12/19 0:30
  try {
    m.load.mockResolvedValue({ kind: "ok", items: [item(1, { title: "クリスマス等身", progress: "done" }), item(2, { title: "SD" })] });
    m.update.mockResolvedValueOnce({ kind: "ok", items: [item(1, { title: "クリスマス等身", progress: "done", handedOverAt: "2026-12-19", updatedAt: "t2" }), item(2, { title: "SD" })] });
    render(<Harness progress />);
    const group = await screen.findByRole("group", { name: "クリスマス等身の進み" });
    expect(within(screen.getByRole("group", { name: "SDの進み" })).queryByRole("button", { name: "先に渡した" })).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "先に渡した" }));
    await waitFor(() => expect(m.update).toHaveBeenLastCalledWith(PID, expect.objectContaining({ id: "i1" }), expect.objectContaining({ progress: "done", handedOverAt: "2026-12-19" })));
    expect(await screen.findByText(/12\/19.*にお渡し済み/)).not.toBeNull();
    m.update.mockResolvedValueOnce({ kind: "ok", items: [item(1, { title: "クリスマス等身", progress: "in_progress" }), item(2, { title: "SD" })] });
    fireEvent.click(within(group).getByRole("button", { name: "制作中" }));
    await waitFor(() => expect(m.update).toHaveBeenLastCalledWith(PID, expect.anything(), expect.objectContaining({ progress: "in_progress", handedOverAt: null })));
  } finally {
    vi.useRealTimers();
  }
});

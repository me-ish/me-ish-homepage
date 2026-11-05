// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NatoriCaseItem } from "../../../types/caseItems";

const m = vi.hoisted(() => ({ load: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../../data/supabaseCaseItems", () => ({ loadCaseItems: m.load, addCaseItem: m.add, updateCaseItem: m.update, deleteCaseItem: m.remove }));
import { CaseItemsPanel } from "../CaseItemsPanel";

const PID = "11111111-1111-4111-8111-111111111111";
const item = (position: number, patch: Partial<NatoriCaseItem> = {}): NatoriCaseItem => ({
  id: `i${position}`, projectId: PID, position, title: `品目${position}`, projectType: "standing", amount: 12000, dueDate: "2026-12-20",
  progress: "not_started", publicationPolicy: "unknown", publicationAllowedFrom: null, note: null, updatedAt: "t", ...patch,
});
const draft = vi.fn();
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it("lists items with their total and publication rule", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [item(1, { title: "クリスマス等身", publicationPolicy: "delayed", publicationAllowedFrom: "2026-12-26" }), item(2, { title: "SD", amount: 5000, progress: "done" })] });
  render(<CaseItemsPanel projectId={PID} disabled={false} onDraftChange={draft} />);
  expect(await screen.findByText(/クリスマス等身/)).not.toBeNull();
  expect(screen.getByText("2点")).not.toBeNull();
  expect(screen.getByText("合計 17,000円")).not.toBeNull();
  expect(screen.getByText(/公開：12\/26/)).not.toBeNull();
  expect(screen.getByText("完成")).not.toBeNull();
});

it("shows nothing when items cannot be read yet", async () => {
  m.load.mockResolvedValue({ kind: "unavailable" });
  const { container } = render(<CaseItemsPanel projectId={PID} disabled={false} onDraftChange={draft} />);
  await waitFor(() => expect(container.textContent).toBe(""));
});

it("adds an item and asks for a date when publication is delayed", async () => {
  m.load.mockResolvedValue({ kind: "ok", items: [] });
  m.add.mockResolvedValue({ kind: "ok", items: [item(1, { title: "正月等身" })] });
  render(<CaseItemsPanel projectId={PID} disabled={false} onDraftChange={draft} />);
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
  render(<CaseItemsPanel projectId={PID} disabled={false} onDraftChange={draft} />);
  fireEvent.click(await screen.findByRole("button", { name: /品目1/ }));
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  expect(await screen.findByText(/ほかの画面で品目が変わりました。/)).not.toBeNull();
  expect(screen.getByRole("button", { name: "保存する" })).not.toBeNull();
});

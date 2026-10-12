// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { NatoriProject } from "../../../types/projects";

const api = vi.hoisted(() => ({ projects: vi.fn(), thumbs: vi.fn(), create: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", () => ({
  fetchNatoriProjects: api.projects, fetchNatoriProjectThumbs: api.thumbs, createNatoriProject: api.create,
  deleteNatoriProject: vi.fn(), updateNatoriProjectDetails: vi.fn(), uploadNatoriProjectThumb: vi.fn(),
}));
import ResultsBoard from "../ResultsBoard";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("ResultsBoard historical manual registration (PAY-01)", () => {
  it("offers completed history, excludes an unissued delivery, and retains the selected historical date", async () => {
    const fixture: NatoriProject = { id: "synthetic-result", title: "Synthetic", clientName: "Synthetic client",
      type: "illustration", status: "completed", amount: 12000, paidAt: "2026-09-15T03:00:00Z",
      completedAt: "2026-09-15T03:00:00Z", dueDate: "2026-09-15", nextAction: "", tasks: [] };
    api.projects.mockResolvedValue([fixture]);
    api.thumbs.mockResolvedValue({});
    api.create.mockResolvedValue("synthetic-created-result");
    render(<ResultsBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "過去の実績を追加" }));
    const form = within(screen.getByRole("dialog"));
    const select = form.getByRole("combobox", { name: "ステータス" }) as HTMLSelectElement;
    expect([...select.options].map(option => option.value)).toEqual(["completed"]);
    fireEvent.change(form.getByRole("textbox", { name: "依頼者名（必須）" }), { target: { value: "Synthetic client" } });
    fireEvent.change(form.getByRole("textbox", { name: "案件タイトル（必須）" }), { target: { value: "Synthetic historical result" } });
    fireEvent.change(form.getByRole("spinbutton", { name: "金額（円）" }), { target: { value: "12000" } });
    fireEvent.change(form.getByLabelText("完了日（必須）"), { target: { value: "2026-09-15" } });
    fireEvent.click(form.getByRole("button", { name: "実績に追加" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      status: "completed", amount: 12000, startDateISO: "2026-09-15", dueDateISO: "2026-09-15",
    })));
    await form.findByText(/Synthetic historical result.*実績に追加しました/);
    expect(api.create.mock.calls[0][0]).not.toHaveProperty("deliveryAcceptedAt");
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateJourney from "@/features/natori/components/dashboard/EstimateJourney";
import type { NatoriProject } from "@/features/natori/types/projects";

vi.mock("@/features/natori/data/supabaseProjects", () => ({ confirmNatoriProjectType: vi.fn() }));
const project: NatoriProject = {
  id: "60000000-0000-4000-8000-000000000001", title: "動画サムネイル", clientName: "依頼者",
  clientEmail: "requester@example.com", type: "illustration", amount: null, dueDate: null,
  status: "inquiry", nextAction: "相談", tasks: [],
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => ({
    ok: true, status: 200,
    json: async () => options?.method === "PUT"
      ? { draft: { ...(JSON.parse(String(options.body)) as Record<string, unknown>), revision: 1 } }
      : { draft: null },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("EstimateJourney", () => {
  it("keeps external requests on the conditions -> price -> review path without guessing their initial amount", async () => {
    render(<EstimateJourney project={project} portfolioContent={null} />);
    expect(await screen.findByText("今回決まった条件")).toBeTruthy();
    expect(screen.getByLabelText("制作するもの")).toHaveProperty("value", "");
    await userEvent.click(screen.getByRole("button", { name: /条件を保存して金額へ/ }));
    expect(await screen.findByText("今回の金額を決める")).toBeTruthy();
    expect(screen.getByText("未入力")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "明細を追加" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /単価/ }), { target: { value: "3500" } });
    await userEvent.click(screen.getByRole("button", { name: /明細を保存して送信確認へ/ }));
    expect(await screen.findByText("相手に見える内容を確認")).toBeTruthy();
    expect(screen.getByText(/送信前に決める項目/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /正式見積り/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("estimate-draft?projectId="), expect.anything());
  });
});

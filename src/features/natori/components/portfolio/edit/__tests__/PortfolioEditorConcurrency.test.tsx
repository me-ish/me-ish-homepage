// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "../../../../constants/portfolioContent";
import PortfolioEditor from "../PortfolioEditor";
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ content: defaultPortfolioContent, revision: 7 }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const status = () => document.querySelector('[aria-live="polite"]')!;
const button = () => status().parentElement!.querySelector("button")!;
const name = () =>
  within(document.getElementById("section-basic")!).getByLabelText(
    "サイト名（ヘッダーの呼び名の下・共有画像に小さく表示）",
  ) as HTMLInputElement;
const edit = (value: string) => fireEvent.change(name(), { target: { value } });
const response = (revision: number, artistName: string) => ({
  ok: true,
  status: 200,
  json: async () => ({
    revision,
    content: { ...defaultPortfolioContent, artistName },
  }),
});
describe("editor save concurrency", () => {
  it("preserves edits made during save, prevents another in-flight request and uses returned revision next", async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<PortfolioEditor />);
    await waitFor(() =>
      expect(document.getElementById("section-basic")).not.toBeNull(),
    );
    edit("First");
    fireEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    edit("Second");
    fireEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish(response(8, "First"));
    });
    expect(name().value).toBe("Second");
    expect(status().textContent).toContain("未保存の変更");
    fetchMock.mockResolvedValueOnce(response(9, "Second"));
    fireEvent.click(button());
    await waitFor(() => expect(status().textContent).toContain("保存しました"));
    const next = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(next).toMatchObject({
      expectedRevision: 8,
      content: { artistName: "Second" },
    });
  }, 30_000);
  it.each([409, 500])(
    "retains pending edits and dirty state after server status %s",
    async (statusCode) => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: statusCode });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<PortfolioEditor />);
      await waitFor(() =>
        expect(document.getElementById("section-basic")).not.toBeNull(),
      );
      edit("Pending");
      fireEvent.click(button());
      await waitFor(() =>
        expect(status().textContent).toContain(
          statusCode === 409 ? "別の保存" : "保存に失敗",
        ),
      );
      expect(name().value).toBe("Pending");
      expect(button().disabled).toBe(false);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).expectedRevision).toBe(
        7,
      );
      log.mockRestore();
    },
    30_000,
  );
});

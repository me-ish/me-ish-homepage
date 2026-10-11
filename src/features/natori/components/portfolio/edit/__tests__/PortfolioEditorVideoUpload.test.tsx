// @vitest-environment jsdom
// 制作過程の動画: 動画ファイルのアップロード中は「保存する」を押せず、終わったあとの保存には新しいURLが入る。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProcessVideo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/natori/data/supabaseProcessVideo")>();
  return { ...actual, uploadProcessVideoFile: (...args: unknown[]) => uploadMock(...args) };
});

import PortfolioEditor from "../PortfolioEditor";

const FILE_URL =
  "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";

const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
  init?.method === "PUT"
    ? ({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response)
    : ({ ok: true, status: 200, json: async () => ({ content: defaultPortfolioContent }) } as Response)
);

beforeEach(() => {
  uploadMock.mockReset();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const processSection = () => within(document.getElementById("section-process") as HTMLElement);
const saveButton = () => screen.getByRole("button", { name: "保存する" }) as HTMLButtonElement;
const status = () => document.querySelector('[aria-live="polite"]') as HTMLElement;
const putBodies = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)) as { content: { processVideo?: { url: string; caption?: string } } });

describe("PortfolioEditor 動画ファイルのアップロード中の保存", () => {
  it("アップロードが終わるまで保存を止め、終わったあとの保存には新しいURLと他の編集が入る", async () => {
    let finish: (url: string) => void = () => {};
    uploadMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    render(<PortfolioEditor />);
    await screen.findByRole("button", { name: "保存する" });

    // 他の欄に未保存の変更があるので、ふだんは保存できる
    fireEvent.change(processSection().getByLabelText("見出しの下の説明（任意）"), {
      target: { value: "アップロード前に書いた説明" },
    });
    expect(saveButton().disabled).toBe(false);

    fireEvent.click(processSection().getByRole("button", { name: "動画ファイル" }));
    const file = new File([new Uint8Array(8)], "timelapse.mp4", { type: "video/mp4" });
    fireEvent.change(document.querySelector('#section-process input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    // アップロード中: 保存できず、理由が出る。押しても保存の通信は起きない
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect(status().textContent).toBe("動画をアップロード中です。終わると保存できます。");
    fireEvent.click(saveButton());
    expect(putBodies()).toHaveLength(0);

    // 終わると保存できるようになり、未保存の変更として知らせる
    await act(async () => {
      finish(FILE_URL);
    });
    expect(saveButton().disabled).toBe(false);
    expect(status().textContent).toBe("未保存の変更があります");

    fireEvent.click(saveButton());
    await waitFor(() => expect(status().textContent).toContain("保存しました"));
    expect(putBodies()).toHaveLength(1);
    expect(putBodies()[0].content.processVideo).toEqual(
      expect.objectContaining({ url: FILE_URL, caption: "アップロード前に書いた説明" })
    );
  });

  it("アップロードに失敗したら、保存できる状態に戻す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    uploadMock.mockRejectedValue(new Error("TypeError: Failed to fetch"));
    render(<PortfolioEditor />);
    await screen.findByRole("button", { name: "保存する" });

    fireEvent.change(processSection().getByLabelText("見出しの下の説明（任意）"), {
      target: { value: "失敗しても残る説明" },
    });
    fireEvent.click(processSection().getByRole("button", { name: "動画ファイル" }));
    fireEvent.change(document.querySelector('#section-process input[type="file"]') as HTMLInputElement, {
      target: { files: [new File([new Uint8Array(8)], "timelapse.mp4", { type: "video/mp4" })] },
    });

    await waitFor(() => expect(processSection().getByRole("alert")).toBeTruthy());
    expect(saveButton().disabled).toBe(false);
    expect(status().textContent).toBe("未保存の変更があります");
    consoleError.mockRestore();
  });
});

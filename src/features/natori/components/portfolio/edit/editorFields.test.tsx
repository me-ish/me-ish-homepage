// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageUploadField } from "./editorFields";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function uploadResponse(url: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ url }),
  } as Response;
}

describe("ImageUploadField", () => {
  it("アップロード完了時は最新の onChange を使う", async () => {
    let resolveFetch!: (response: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => pendingFetch));

    const firstOnChange = vi.fn();
    const latestOnChange = vi.fn();
    const view = render(
      <ImageUploadField label="作例" value={null} onChange={firstOnChange} />
    );
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["image"], "sample.png", { type: "image/png" })] },
    });

    view.rerender(
      <ImageUploadField label="作例" value={null} onChange={latestOnChange} />
    );

    resolveFetch(uploadResponse("https://example.com/sample.webp"));

    await waitFor(() => {
      expect(latestOnChange).toHaveBeenCalledWith("https://example.com/sample.webp");
    });
    expect(firstOnChange).not.toHaveBeenCalled();
  });

  it("アップロード中に欄が削除された場合は完了結果を反映しない", async () => {
    let resolveFetch!: (response: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => pendingFetch));

    const onChange = vi.fn();
    const view = render(<ImageUploadField label="作例" value={null} onChange={onChange} />);
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["image"], "sample.png", { type: "image/png" })] },
    });
    view.unmount();

    await act(async () => {
      resolveFetch(uploadResponse("https://example.com/sample.webp"));
      await pendingFetch;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

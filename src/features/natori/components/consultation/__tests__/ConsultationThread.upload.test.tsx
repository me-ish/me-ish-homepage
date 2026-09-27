// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { UploadOptions } from "tus-js-client";
const tus = vi.hoisted(() => ({
  options: null as UploadOptions | null,
  fail: false,
}));
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(_file: unknown, options: UploadOptions) {
      tus.options = options;
    }
    start() {
      if (tus.fail)
        tus.options?.onError?.(new Error("synthetic upload failure"));
      else
        tus.options?.onSuccess?.({
          lastResponse: {
            getStatus: () => 201,
            getHeader: () => undefined,
            getBody: () => "",
            getUnderlyingObject: () => null,
          },
        });
    }
  },
}));
import ConsultationThread from "../ConsultationThread";
import { consultationUploadEndpoint } from "@/features/natori/lib/consultationUploadEndpoint";
let calls: Record<string, unknown>[];
beforeEach(() => {
  calls = [];
  tus.fail = false;
  tus.options = null;
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://synthetic-project.supabase.co",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (body) calls.push(body);
      return Response.json(
        body?.action === "sign"
          ? {
              path: "synthetic/file.png",
              uploadToken: "synthetic-upload-token",
            }
          : body?.action === "finish"
            ? { ok: true }
            : { messages: [] },
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("consultation signed upload UI", () => {
  it("uses the signed TUS route, then finalizes and reports success", async () => {
    render(
      <ConsultationThread
        mode="client"
        token="synthetic-token"
        initialMessages={[]}
        closed={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"), {
      target: {
        files: [new File(["fake"], "file.png", { type: "image/png" })],
      },
    });
    await screen.findByText("ファイルを共有しました。");
    expect(tus.options?.endpoint).toBe(
      "https://synthetic-project.storage.supabase.co/storage/v1/upload/resumable/sign",
    );
    expect(tus.options?.headers).toEqual({
      "x-signature": "synthetic-upload-token",
    });
    expect(tus.options?.uploadDataDuringCreation).toBe(true);
    expect(calls.map((c) => c.action)).toEqual(["sign", "finish"]);
  });
  it("does not finalize or display success after the upload is refused", async () => {
    tus.fail = true;
    render(
      <ConsultationThread
        mode="client"
        token="synthetic-token"
        initialMessages={[]}
        closed={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"), {
      target: {
        files: [new File(["fake"], "file.png", { type: "image/png" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "synthetic upload failure",
      ),
    );
    expect(calls.map((c) => c.action)).toEqual(["sign"]);
    expect(screen.queryByText("ファイルを共有しました。")).toBeNull();
  });
  it("retains local/custom origins and rejects embedded credentials", () => {
    expect(consultationUploadEndpoint("http://127.0.0.1:55431")).toBe(
      "http://127.0.0.1:55431/storage/v1/upload/resumable/sign",
    );
    expect(consultationUploadEndpoint("https://storage.example.invalid")).toBe(
      "https://storage.example.invalid/storage/v1/upload/resumable/sign",
    );
    expect(() =>
      consultationUploadEndpoint("https://user:pass@example.invalid"),
    ).toThrow();
  });
});

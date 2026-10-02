// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
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
  sessionStorage.clear();
  vi.stubGlobal("crypto",{subtle:webcrypto.subtle,randomUUID:()=>"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"});
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
        body?.action === "prepare"
          ? {
              kind:"prepared",files:[{id:body.operation.files[0].id,path:"synthetic/file.png",uploadToken:"synthetic-upload-token",uploaded:false}],
            }
          : body?.action === "commit"
            ? { kind:"committed",messageId:"66666666-7777-4888-8999-aaaaaaaaaaaa",operationId:body.operation.operationId,requestHash:body.operation.requestHash }
            : { messages: [] },
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
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
        files: [Object.defineProperty(new File(["fake"], "file.png", { type: "image/png" }),"arrayBuffer",{value:async()=>Uint8Array.from(new TextEncoder().encode("fake")).buffer})],
      },
    });
    expect(calls).toHaveLength(0);
    await screen.findByRole("button",{name:"file.pngの添付を取り消す"});
    fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));
    await screen.findByText(/送信を保存しました/);
    expect(tus.options?.endpoint).toBe(
      "https://synthetic-project.storage.supabase.co/storage/v1/upload/resumable/sign",
    );
    expect(tus.options?.headers).toEqual({
      "x-signature": "synthetic-upload-token",
    });
    expect(tus.options?.uploadDataDuringCreation).toBe(true);
    expect(calls.map((c) => c.action)).toEqual(["prepare", "commit"]);
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
        files: [Object.defineProperty(new File(["fake"], "file.png", { type: "image/png" }),"arrayBuffer",{value:async()=>Uint8Array.from(new TextEncoder().encode("fake")).buffer})],
      },
    });
    await screen.findByRole("button",{name:"file.pngの添付を取り消す"});
    fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "synthetic upload failure",
      ),
    );
    expect(calls.map((c) => c.action)).toEqual(["prepare"]);
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

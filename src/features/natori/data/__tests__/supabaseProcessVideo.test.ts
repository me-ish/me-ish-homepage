import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockStorageFrom, mockUploadToSignedUrl, tus } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockUploadToSignedUrl: vi.fn(),
  tus: { construct: vi.fn(), start: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

type TusOptions = {
  endpoint: string;
  headers: Record<string, string>;
  chunkSize: number;
  metadata: Record<string, string>;
  onProgress: (sent: number, total: number) => void;
  onSuccess: () => void;
  onError: (error: Error) => void;
};

vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(
      file: unknown,
      private options: TusOptions
    ) {
      tus.construct(file, options);
    }
    start() {
      tus.start(this.options);
    }
  },
}));

import {
  ProcessVideoUploadError,
  uploadProcessVideoFile,
} from "@/features/natori/data/supabaseProcessVideo";

const PUBLIC_URL =
  "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";
const PATH = "videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";

function response(body: Record<string, unknown> | null, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === null) throw new Error("not json");
      return body;
    },
  } as Response;
}

const prepared = { ok: true, path: PATH, token: "signed-token", publicUrl: PUBLIC_URL };
const smallFile = { name: "small.mp4", type: "video/mp4", size: 3_000_000 } as File;
const largeFile = { name: "large.mp4", type: "video/mp4", size: 30_000_000 } as File;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
  mockStorageFrom.mockReturnValue({ uploadToSignedUrl: mockUploadToSignedUrl });
  mockCreateClient.mockReturnValue({ storage: { from: mockStorageFrom } });
  mockUploadToSignedUrl.mockResolvedValue({ error: null });
  tus.start.mockImplementation((options: TusOptions) => options.onSuccess());
  fetchMock = vi.fn().mockResolvedValue(response(prepared));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function rejection(promise: Promise<unknown>): Promise<ProcessVideoUploadError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(ProcessVideoUploadError);
  return error as ProcessVideoUploadError;
}

describe("uploadProcessVideoFile", () => {
  it("小さいファイルは、サーバーが決めた場所と署名だけを使って通常のアップロードで送る", async () => {
    const onProgress = vi.fn();
    const url = await uploadProcessVideoFile(smallFile, { onProgress });

    expect(url).toBe(PUBLIC_URL);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/natori/portfolio/video-upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-requested-with": "me-ish", "Content-Type": "application/json" }),
        body: JSON.stringify({ sizeBytes: 3_000_000, contentType: "video/mp4" }),
      })
    );
    expect(mockStorageFrom).toHaveBeenCalledWith("natori-portfolio");
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(PATH, "signed-token", smallFile, {
      contentType: "video/mp4",
      cacheControl: "31536000",
    });
    expect(tus.construct).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.map(([ratio]) => ratio)).toEqual([0, 1]);
  });

  it("大きいファイルは再開可能アップロード（TUS）で送り、進み具合を伝える", async () => {
    tus.start.mockImplementation((options: TusOptions) => {
      options.onProgress(6_000_000, 30_000_000);
      options.onProgress(30_000_000, 30_000_000);
      options.onSuccess();
    });
    const onProgress = vi.fn();
    const url = await uploadProcessVideoFile(largeFile, { onProgress });

    expect(url).toBe(PUBLIC_URL);
    expect(tus.construct).toHaveBeenCalledTimes(1);
    const [sentFile, options] = tus.construct.mock.calls[0] as [File, TusOptions];
    expect(sentFile).toBe(largeFile);
    expect(options.endpoint).toBe("https://abcdefgh.storage.supabase.co/storage/v1/upload/resumable/sign");
    expect(options.headers).toEqual({ "x-signature": "signed-token" });
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.metadata).toEqual({
      bucketName: "natori-portfolio",
      objectName: PATH,
      contentType: "video/mp4",
      cacheControl: "31536000",
    });
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
    expect(onProgress.mock.calls.map(([ratio]) => ratio)).toEqual([0, 0.2, 1, 1]);
  });

  it("再開可能アップロードが使えないときは、通常のアップロードで送り直す", async () => {
    tus.start.mockImplementation((options: TusOptions) => options.onError(new Error("tus unavailable")));
    const onProgress = vi.fn();
    const url = await uploadProcessVideoFile(largeFile, { onProgress });

    expect(url).toBe(PUBLIC_URL);
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(PATH, "signed-token", largeFile, expect.any(Object));
    expect(onProgress.mock.calls.map(([ratio]) => ratio)).toEqual([0, 0, 1]);
  });

  it("どちらの送り方でも失敗したら、画面に出せる日本語の理由で失敗する", async () => {
    tus.start.mockImplementation((options: TusOptions) => options.onError(new Error("tus unavailable")));
    mockUploadToSignedUrl.mockResolvedValue({ error: { message: "payload too large" } });

    const error = await rejection(uploadProcessVideoFile(largeFile));
    expect(error.message).toBe("アップロードに失敗しました。通信状況を確認して、もう一度お試しください。");
  });

  it("小さいファイルの通常のアップロードが失敗したときも同じ理由で失敗する", async () => {
    mockUploadToSignedUrl.mockResolvedValue({ error: { message: "network" } });

    const error = await rejection(uploadProcessVideoFile(smallFile));
    expect(error.message).toBe("アップロードに失敗しました。通信状況を確認して、もう一度お試しください。");
    expect(tus.construct).not.toHaveBeenCalled();
  });

  it("MP4 以外・空・上限超えは、通信する前に断る", async () => {
    const wrongType = await rejection(uploadProcessVideoFile({ name: "a.mov", type: "video/quicktime", size: 10 } as File));
    expect(wrongType.message).toBe("MP4形式（.mp4）の動画を選んでください。");

    const empty = await rejection(uploadProcessVideoFile({ name: "a.mp4", type: "video/mp4", size: 0 } as File));
    expect(empty.message).toContain("空");

    const tooLarge = await rejection(
      uploadProcessVideoFile({ name: "a.mp4", type: "video/mp4", size: 63_200_000 } as File)
    );
    expect(tooLarge.message).toBe(
      "動画は50MBまでです（選んだ動画は63.2MB）。書き出しの画質やサイズを下げてから、もう一度選んでください。"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("準備のAPIが断った理由を、そのまま案内にする", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "Unauthorized" }, 401));
    expect((await rejection(uploadProcessVideoFile(smallFile))).message).toContain("ログインの有効期限");

    fetchMock.mockResolvedValueOnce(response({ error: "invalid_mime" }, 400));
    expect((await rejection(uploadProcessVideoFile(smallFile))).message).toBe("MP4形式（.mp4）の動画を選んでください。");

    fetchMock.mockResolvedValueOnce(response({ error: "file_too_large" }, 400));
    expect((await rejection(uploadProcessVideoFile(smallFile))).message).toContain("動画は50MBまでです");

    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["サーバーエラー", () => response({ error: "storage_error" }, 500)],
    ["JSON ではない応答", () => response(null, 200)],
    ["必要な項目が足りない応答", () => response({ ok: true, path: PATH }, 200)],
  ])("準備のAPIが使えない（%s）ときは、準備できなかったと伝える", async (_label, build) => {
    fetchMock.mockResolvedValueOnce(build());

    const error = await rejection(uploadProcessVideoFile(smallFile));
    expect(error.message).toBe("アップロードの準備ができませんでした。時間をおいて、もう一度お試しください。");
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
  });

  it("通信できなかったときも、準備できなかったと伝える", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = await rejection(uploadProcessVideoFile(smallFile));
    expect(error.message).toBe("アップロードの準備ができませんでした。時間をおいて、もう一度お試しください。");
  });

  it("保存できない形の公開URLが返ってきたら、アップロードを始めない", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ ...prepared, publicUrl: "https://abcdefgh.supabase.co/storage/v1/object/public/other-bucket/videos/a.mp4" })
    );

    const error = await rejection(uploadProcessVideoFile(smallFile));
    expect(error.message).toContain("アップロードの準備ができませんでした");
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
    expect(tus.construct).not.toHaveBeenCalled();
  });
});

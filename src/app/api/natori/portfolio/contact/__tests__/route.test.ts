// ご依頼フォーム (POST /api/natori/portfolio/contact) のテスト。
// CSRF・honeypot・レート制限と、multipart でのファイル同梱アップロード
// （旧 contact/upload の廃止に伴う新フロー）を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const { mockSendContact, mockAutoReply, mockCreateInquiry, mockUpload, mockSign, mockDelete } = vi.hoisted(
  () => ({
    mockSendContact: vi.fn(),
    mockAutoReply: vi.fn(),
    mockCreateInquiry: vi.fn(),
    mockUpload: vi.fn(),
    mockSign: vi.fn(),
    mockDelete: vi.fn(),
  })
);

vi.mock("@/features/natori/server/portfolioContactService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/natori/server/portfolioContactService")>();
  return {
    ...actual,
    isPortfolioContactConfigured: () => true,
    sendPortfolioContactEmail: (...args: unknown[]) => mockSendContact(...args),
    sendPortfolioContactAutoReply: (...args: unknown[]) => mockAutoReply(...args),
  };
});

vi.mock("@/features/natori/server/inquiryProjectService", () => ({
  createInquiryProject: (...args: unknown[]) => mockCreateInquiry(...args),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  uploadPortfolioReferenceImage: (...args: unknown[]) => mockUpload(...args),
  signPortfolioReferenceImage: (...args: unknown[]) => mockSign(...args),
  deletePortfolioReferenceImages: (...args: unknown[]) => mockDelete(...args),
}));

import { POST } from "../route";

/* ---------- Helpers ---------- */

const URL_ = "https://example.com/api/natori/portfolio/contact";
const CSRF = { "x-requested-with": "me-ish" };

const VALID_FIELDS = {
  name: "テスト太郎",
  email: "client@example.com",
  requestType: "SNSアイコン",
  details: "淡いピンクでふんわりお願いします。",
};

function makeJsonReq(
  body: Record<string, unknown>,
  headers: Record<string, string> = CSRF
) {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeMultipartReq(
  fields: Record<string, string>,
  files: File[] = [],
  headers: Record<string, string> = CSRF
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  for (const file of files) {
    form.append("refImages", file);
  }
  // content-type は FormData から boundary 付きで自動設定される
  return new Request(URL_, { method: "POST", headers, body: form });
}

function makePngFile(name = "ref.png") {
  const pngSig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([pngSig], name, { type: "image/png" });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
  mockSendContact.mockResolvedValue({ mailed: true });
  mockAutoReply.mockResolvedValue({ mailed: true });
  mockCreateInquiry.mockResolvedValue({ kind: "ok", projectId: "proj-1" });
  mockUpload.mockResolvedValue({ kind: "ok", path: "submission/a.webp" });
  mockSign.mockResolvedValue("https://signed.example.com/refs/a.webp");
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ---------- Tests ---------- */

describe("guards", () => {
  it("CSRF ヘッダーが無ければ 403（フォーム本体にも CSRF を適用）", async () => {
    const res = await POST(makeJsonReq(VALID_FIELDS, {}));
    expect(res.status).toBe(403);
    expect(mockCreateInquiry).not.toHaveBeenCalled();
  });

  it("honeypot が埋まっていたら成功風レスポンスで終了し、画像も保存しない", async () => {
    const res = await POST(
      makeMultipartReq({ ...VALID_FIELDS, website: "http://spam.example" }, [makePngFile()])
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.spam).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreateInquiry).not.toHaveBeenCalled();
    expect(mockSendContact).not.toHaveBeenCalled();
  });

  it("レート制限（3回/10分）を超えたら 429", async () => {
    for (let i = 0; i < 3; i++) {
      await POST(makeJsonReq(VALID_FIELDS));
    }
    const res = await POST(makeJsonReq(VALID_FIELDS));
    expect(res.status).toBe(429);
  });

  it("必須項目が欠けていたら 400", async () => {
    const res = await POST(makeJsonReq({ ...VALID_FIELDS, name: "" }));
    expect(res.status).toBe(400);
    expect(mockCreateInquiry).not.toHaveBeenCalled();
  });
});

describe("multipart（ファイル同梱）", () => {
  it("正規のフォーム添付フロー: 非公開パスを案件へ、署名URLをメールだけへ引き継ぐ", async () => {
    const res = await POST(makeMultipartReq(VALID_FIELDS, [makePngFile()]));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, mailed: true, caseCreated: true });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockCreateInquiry.mock.calls[0][1]).toEqual(["submission/a.webp"]);
    const inquiryInput = mockCreateInquiry.mock.calls[0][0] as { refImages: string[] };
    expect(inquiryInput.refImages).toEqual([]);
    const mailInput = mockSendContact.mock.calls[0][0] as { refImages: string[] };
    expect(mailInput.refImages).toEqual(["https://signed.example.com/refs/a.webp"]);
  });

  it("ファイル無しの multipart 送信も通る", async () => {
    const res = await POST(makeMultipartReq(VALID_FIELDS));
    expect(res.status).toBe(200);
    expect(mockUpload).not.toHaveBeenCalled();
    const inquiryInput = mockCreateInquiry.mock.calls[0][0] as { refImages: string[] };
    expect(inquiryInput.refImages).toEqual([]);
  });

  it("画像が実バイト判定で弾かれたら 400 で、案件もメールも作らない", async () => {
    mockUpload.mockResolvedValue({ kind: "invalid-type" });
    const res = await POST(makeMultipartReq(VALID_FIELDS, [makePngFile()]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_mime");
    expect(mockCreateInquiry).not.toHaveBeenCalled();
    expect(mockSendContact).not.toHaveBeenCalled();
  });

  it("サイズ超過は 400 file_too_large", async () => {
    mockUpload.mockResolvedValue({ kind: "too-large" });
    const res = await POST(makeMultipartReq(VALID_FIELDS, [makePngFile()]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("file_too_large");
  });

  it("6枚以上は 400 too_many_files（保存前に弾く）", async () => {
    const files = Array.from({ length: 6 }, (_, i) => makePngFile(`ref-${i}.png`));
    const res = await POST(makeMultipartReq(VALID_FIELDS, files));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("too_many_files");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe("JSON 経路", () => {
  it("refImages の URL 直接指定は受け付けない（外部URLをメールに流し込ませない）", async () => {
    const res = await POST(
      makeJsonReq({ ...VALID_FIELDS, refImages: ["https://evil.example.com/x.png"] })
    );
    expect(res.status).toBe(200);
    const inquiryInput = mockCreateInquiry.mock.calls[0][0] as { refImages: string[] };
    expect(inquiryInput.refImages).toEqual([]);
    const mailInput = mockSendContact.mock.calls[0][0] as { refImages: string[] };
    expect(mailInput.refImages).toEqual([]);
  });
});

// P1-06 構造化受付 (POST /api/natori/portfolio/contact, formVersion=etorie-request-v1)
// のテスト。security guard、public owner 境界、URL/画像の受付制約、
// RPC・Storage の cleanup 境界、メール失敗時の契約を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";

/* ---------- Mocks ---------- */

vi.mock("server-only", () => ({}));

const {
  mockSendStructured,
  mockStructuredAutoReply,
  mockSendLegacy,
  mockLegacyAutoReply,
  mockCreateStructured,
  mockCreateLegacyInquiry,
  mockUpload,
  mockSign,
  mockDelete,
  mockResolveActingUser,
} = vi.hoisted(() => ({
  mockSendStructured: vi.fn(),
  mockStructuredAutoReply: vi.fn(),
  mockSendLegacy: vi.fn(),
  mockLegacyAutoReply: vi.fn(),
  mockCreateStructured: vi.fn(),
  mockCreateLegacyInquiry: vi.fn(),
  mockUpload: vi.fn(),
  mockSign: vi.fn(),
  mockDelete: vi.fn(),
  mockResolveActingUser: vi.fn(),
}));

vi.mock("@/features/natori/server/portfolioContactService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/natori/server/portfolioContactService")>();
  return {
    ...actual,
    isPortfolioContactConfigured: () => true,
    sendPortfolioContactEmail: (...args: unknown[]) => mockSendLegacy(...args),
    sendPortfolioContactAutoReply: (...args: unknown[]) => mockLegacyAutoReply(...args),
    sendStructuredPortfolioContactEmail: (...args: unknown[]) => mockSendStructured(...args),
    sendStructuredPortfolioContactAutoReply: (...args: unknown[]) =>
      mockStructuredAutoReply(...args),
  };
});

vi.mock("@/features/natori/server/inquiryProjectService", () => ({
  createInquiryProject: (...args: unknown[]) => mockCreateLegacyInquiry(...args),
  createStructuredInquiryProject: (...args: unknown[]) => mockCreateStructured(...args),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  uploadPortfolioReferenceImage: (...args: unknown[]) => mockUpload(...args),
  signPortfolioReferenceImage: (...args: unknown[]) => mockSign(...args),
  deletePortfolioReferenceImages: (...args: unknown[]) => mockDelete(...args),
}));

// 公開 route が管理系の session-first resolver を使わないことを固定する。
vi.mock("@/features/natori/server/natoriOwner", () => ({
  resolveNatoriActingUserId: (...args: unknown[]) => mockResolveActingUser(...args),
  NATORI_OWNER_UNRESOLVED_MESSAGE: "",
}));

import { POST } from "../route";

/* ---------- Helpers ---------- */

const URL_ = "https://example.com/api/natori/portfolio/contact";
const CSRF = { "x-requested-with": "me-ish" };
const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type RequestDataOverrides = Record<string, unknown>;

function consultationRequestData(overrides: RequestDataOverrides = {}) {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "consultation",
    requestType: "undecided",
    requestTypeOther: null,
    commissionScope: "undecided",
    commissionScopeOther: null,
    options: [],
    usageTypes: [],
    usageTypeOther: null,
    commercialUse: "unknown",
    publicationPolicy: "unknown",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "まずはご相談させてください。",
    legacySource: null,
    ...overrides,
  };
}

function quoteRequestData(overrides: RequestDataOverrides = {}) {
  return consultationRequestData({ inquiryMode: "quote", ...overrides });
}

function makeStructuredReq({
  requestData = consultationRequestData(),
  referenceLinks,
  files = [],
  fields = {},
  headers = CSRF,
}: {
  requestData?: unknown;
  referenceLinks?: unknown;
  files?: File[];
  fields?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const form = new FormData();
  form.append("formVersion", "etorie-request-v1");
  form.append("name", "テスト太郎");
  form.append("email", "client@example.com");
  form.append(
    "requestData",
    typeof requestData === "string" ? requestData : JSON.stringify(requestData)
  );
  if (referenceLinks !== undefined) {
    form.append(
      "referenceLinks",
      typeof referenceLinks === "string" ? referenceLinks : JSON.stringify(referenceLinks)
    );
  }
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const file of files) form.append("refImages", file);
  return new Request(URL_, { method: "POST", headers, body: form });
}

function makePngFile(name = "ref.png", bytes = 8) {
  const pngSig = new Uint8Array(bytes);
  pngSig.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].slice(0, Math.min(8, bytes)));
  return new File([pngSig], name, { type: "image/png" });
}

function structuredCallArg() {
  return mockCreateStructured.mock.calls[0][0] as {
    submissionId: string;
    ownerId?: string;
    submission: {
      clientName: string;
      clientEmail: string;
      requestData: Record<string, unknown>;
    };
    referencePaths: string[];
    referenceLinks: Array<{ url: string; label: string | null }>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
  vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "1");
  vi.stubEnv("NATORI_OWNER_USER_ID", OWNER_ID);
  mockSendStructured.mockResolvedValue({ mailed: true });
  mockStructuredAutoReply.mockResolvedValue({ mailed: true });
  mockCreateStructured.mockImplementation(
    async (input: { submissionId: string }) => ({ kind: "ok", projectId: input.submissionId })
  );
  mockUpload.mockImplementation(async (_file: File, submissionId: string) => ({
    kind: "ok",
    path: `${submissionId}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`,
  }));
  mockDelete.mockResolvedValue(undefined);
  mockResolveActingUser.mockResolvedValue("session-user-id");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ---------- Tests ---------- */

describe("structured intake: 受付成功", () => {
  it("consultation の最低入力で受け付ける", async () => {
    const res = await POST(makeStructuredReq());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, accepted: true, mailed: true, autoReplied: true });
    // 内部 project ID / submission ID を返さない
    expect(JSON.stringify(json)).not.toMatch(UUID_PATTERN);
  });

  it("quote でも requestType / commissionScope が undecided のまま受け付ける", async () => {
    const res = await POST(
      makeStructuredReq({
        requestData: quoteRequestData({ message: "お見積もりをお願いします。" }),
      })
    );
    expect(res.status).toBe(201);
    const arg = structuredCallArg();
    expect(arg.submission.requestData.inquiryMode).toBe("quote");
    expect(arg.submission.requestData.requestType).toBe("undecided");
    expect(arg.submission.requestData.commissionScope).toBe("undecided");
  });

  it("project UUID は upload path 生成前に作られ、RPC の submissionId と一致する", async () => {
    await POST(makeStructuredReq({ files: [makePngFile()] }));
    const arg = structuredCallArg();
    expect(arg.submissionId).toMatch(UUID_PATTERN);
    expect(mockUpload.mock.calls[0][1]).toBe(arg.submissionId);
    expect(arg.referencePaths).toEqual([
      `${arg.submissionId}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`,
    ]);
  });

  it("画像とURLは混在して受け付けられる（合算5件ではない）", async () => {
    const files = Array.from({ length: 5 }, (_, i) => makePngFile(`ref-${i}.png`));
    const links = Array.from({ length: 5 }, (_, i) => ({
      url: `https://example.com/ref-${i}`,
      label: `資料${i}`,
    }));
    const res = await POST(makeStructuredReq({ files, referenceLinks: links }));
    expect(res.status).toBe(201);
    const arg = structuredCallArg();
    expect(arg.referencePaths).toHaveLength(5);
    expect(arg.referenceLinks).toHaveLength(5);
  });
});

describe("structured intake: request_data の canonical 化", () => {
  it("client 由来の formVersion / legacySource / 未 trim 値を canonical へ正規化する", async () => {
    await POST(
      makeStructuredReq({
        requestData: consultationRequestData({
          formVersion: "natori-portfolio-v1",
          legacySource: {
            formVersion: "natori-portfolio-v1",
            requestTypeLabel: "改ざん",
            planLabel: "",
            optionLabels: [],
            budgetLabel: "",
            deadlineLabel: "",
            referenceUrlsText: "",
            details: "",
            message: "",
          },
          message: "   前後に空白があります。   ",
        }),
      })
    );
    const requestData = structuredCallArg().submission.requestData;
    expect(requestData.schemaVersion).toBe(1);
    expect(requestData.formVersion).toBe("etorie-request-v1");
    expect(requestData.legacySource).toBeNull();
    expect(requestData.message).toBe("前後に空白があります。");
  });

  it("note は送らない（原回答を note へ複製しない）", async () => {
    await POST(makeStructuredReq());
    const arg = structuredCallArg();
    expect(arg).not.toHaveProperty("note");
    expect(arg.submission).not.toHaveProperty("note");
  });

  it("legacy の直接 INSERT 経路は呼ばない", async () => {
    await POST(makeStructuredReq());
    expect(mockCreateLegacyInquiry).not.toHaveBeenCalled();
  });
});

describe("structured intake: validation", () => {
  it("壊れた RequestData は 400 invalid_request", async () => {
    const res = await POST(makeStructuredReq({ requestData: "{not json" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("未知キーを含む RequestData は 400", async () => {
    const res = await POST(
      makeStructuredReq({ requestData: consultationRequestData({ evilKey: "x" }) })
    );
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("64KiB 超の RequestData は 400", async () => {
    const res = await POST(
      makeStructuredReq({
        requestData: consultationRequestData({ message: "あ".repeat(40_000) }),
      })
    );
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("詳細が全て空なら field error を返す", async () => {
    const res = await POST(
      makeStructuredReq({ requestData: consultationRequestData({ message: "" }) })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_request");
    expect(json.fields.some((f: { path: string }) => f.path === "requestData.message")).toBe(
      true
    );
  });

  it("other 補足が無い場合は field error を返す", async () => {
    const res = await POST(
      makeStructuredReq({
        requestData: consultationRequestData({ requestType: "other", requestTypeOther: null }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(
      json.fields.some((f: { path: string }) => f.path === "requestData.requestTypeOther")
    ).toBe(true);
  });
});

describe("structured intake: security guards", () => {
  it("CSRF ヘッダーが無ければ 403", async () => {
    const res = await POST(makeStructuredReq({ headers: {} }));
    expect(res.status).toBe(403);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("Origin が配信ホストと異なれば 403", async () => {
    const res = await POST(
      makeStructuredReq({ headers: { ...CSRF, origin: "https://evil.example" } })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("origin_rejected");
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("同一 Origin なら通す", async () => {
    const res = await POST(
      makeStructuredReq({ headers: { ...CSRF, origin: "https://example.com" } })
    );
    expect(res.status).toBe(201);
  });

  it("honeypot が埋まっていたら保存も送信もしない", async () => {
    const res = await POST(
      makeStructuredReq({
        fields: { website: "http://spam.example" },
        files: [makePngFile()],
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).spam).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreateStructured).not.toHaveBeenCalled();
    expect(mockSendStructured).not.toHaveBeenCalled();
  });

  it("レート制限（3回/10分）の4回目は 429", async () => {
    for (let i = 0; i < 3; i++) await POST(makeStructuredReq());
    const res = await POST(makeStructuredReq());
    expect(res.status).toBe(429);
  });
});

describe("structured intake: public owner 境界", () => {
  it("NATORI_OWNER_USER_ID が未設定なら 503 で、DB へ触れない", async () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", "");
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("temporarily_unavailable");
    expect(mockCreateStructured).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("設定値が UUID でなければ 503（任意 owner へ倒さない）", async () => {
    vi.stubEnv("NATORI_OWNER_USER_ID", "not-a-uuid");
    const res = await POST(makeStructuredReq());
    expect(res.status).toBe(503);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("session ではなく env の owner を明示的に渡す", async () => {
    await POST(makeStructuredReq());
    expect(structuredCallArg().ownerId).toBe(OWNER_ID);
    expect(mockResolveActingUser).not.toHaveBeenCalled();
  });

  it("rollout guard が無効なら 503 で writer を使わない", async () => {
    vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "");
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(503);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });
});

describe("structured intake: 外部参照 URL", () => {
  it("6件は 400", async () => {
    const links = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/${i}`,
      label: "",
    }));
    const res = await POST(makeStructuredReq({ referenceLinks: links }));
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("normalize 後に重複する URL は 400", async () => {
    const res = await POST(
      makeStructuredReq({
        referenceLinks: [
          { url: "https://example.com/a#one", label: "" },
          { url: "https://EXAMPLE.com:443/a#two", label: "" },
        ],
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.some((f: { path: string }) => f.path === "referenceLinks.1.url")).toBe(
      true
    );
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("HTTP URL は 400", async () => {
    const res = await POST(
      makeStructuredReq({ referenceLinks: [{ url: "http://example.com/a", label: "" }] })
    );
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("credentials 付き URL は 400", async () => {
    const res = await POST(
      makeStructuredReq({
        referenceLinks: [{ url: "https://user:pass@example.com/a", label: "" }],
      })
    );
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("空行は送信対象から外し、sortOrder の基準となる順序を保つ", async () => {
    await POST(
      makeStructuredReq({
        referenceLinks: [
          { url: "https://example.com/first", label: "一つ目" },
          { url: "", label: "" },
          { url: "https://example.com/second", label: "" },
        ],
      })
    );
    expect(structuredCallArg().referenceLinks).toEqual([
      { url: "https://example.com/first", label: "一つ目" },
      { url: "https://example.com/second", label: null },
    ]);
  });
});

describe("structured intake: 画像", () => {
  it("6枚は 400 で upload しない", async () => {
    const files = Array.from({ length: 6 }, (_, i) => makePngFile(`ref-${i}.png`));
    const res = await POST(makeStructuredReq({ files }));
    expect(res.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("合計サイズ超過は 400 で upload しない", async () => {
    const files = [makePngFile("big.png", 11 * 1024 * 1024)];
    const res = await POST(makeStructuredReq({ files }));
    expect(res.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("MIME 不正は 400 で、それまでに保存した object を cleanup する", async () => {
    mockUpload
      .mockResolvedValueOnce({ kind: "ok", path: "first.webp" })
      .mockResolvedValueOnce({ kind: "invalid-type" });
    const res = await POST(
      makeStructuredReq({ files: [makePngFile("a.png"), makePngFile("b.png")] })
    );
    expect(res.status).toBe(400);
    expect(mockDelete).toHaveBeenCalledWith(["first.webp"]);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("upload 失敗は 502 upload_failed", async () => {
    mockUpload.mockResolvedValue({ kind: "upload-error" });
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("upload_failed");
  });
});

describe("structured intake: RPC / Storage 境界", () => {
  it("upload 成功 → RPC 成功では cleanup しない", async () => {
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(201);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("明確な RPC 拒否は 400 submission_rejected で、route は二重削除しない", async () => {
    mockCreateStructured.mockResolvedValue({ kind: "db-error" });
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("submission_rejected");
    // 未参照 object の cleanup は inquiryProjectService の責務。
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("結果不明なら 503 で object を保持する", async () => {
    mockCreateStructured.mockResolvedValue({ kind: "unresolved" });
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("temporarily_unavailable");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("owner 解決不能を service が返しても 503 にする", async () => {
    mockCreateStructured.mockResolvedValue({ kind: "no-owner" });
    const res = await POST(makeStructuredReq());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("temporarily_unavailable");
  });
});

describe("structured intake: メール", () => {
  it("メール失敗でも受付は成功のまま、案件は削除しない", async () => {
    mockSendStructured.mockResolvedValue({ mailed: false });
    mockStructuredAutoReply.mockResolvedValue({ mailed: false });
    const res = await POST(makeStructuredReq({ files: [makePngFile()] }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      accepted: true,
      mailed: false,
      autoReplied: false,
      mailDelivery: "mail_delivery_failed",
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("メール送信が throw しても受付成功を返す", async () => {
    mockSendStructured.mockRejectedValue(new Error("resend down"));
    const res = await POST(makeStructuredReq());
    expect(res.status).toBe(201);
    expect((await res.json()).accepted).toBe(true);
  });

  it("メールへ署名URLや Storage path を渡さない", async () => {
    await POST(makeStructuredReq({ files: [makePngFile()] }));
    const mailInput = mockSendStructured.mock.calls[0][0] as Record<string, unknown>;
    expect(mailInput).toMatchObject({ referenceImageCount: 1 });
    expect(JSON.stringify(mailInput)).not.toContain(".webp");
    expect(mockSign).not.toHaveBeenCalled();
  });
});

describe("legacy 互換", () => {
  it("formVersion が無い multipart は従来経路のまま", async () => {
    mockCreateLegacyInquiry.mockResolvedValue({ kind: "ok", projectId: "proj-1" });
    mockSendLegacy.mockResolvedValue({ mailed: true });
    mockLegacyAutoReply.mockResolvedValue({ mailed: true });
    mockSign.mockResolvedValue("https://signed.example.com/a.webp");

    const form = new FormData();
    form.append("name", "テスト太郎");
    form.append("email", "client@example.com");
    form.append("requestType", "SNSアイコン");
    form.append("details", "淡いピンクでお願いします。");
    const res = await POST(new Request(URL_, { method: "POST", headers: CSRF, body: form }));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockCreateLegacyInquiry).toHaveBeenCalledTimes(1);
    expect(mockCreateStructured).not.toHaveBeenCalled();
  });

  it("JSON 経路で structured を名乗る payload は 400", async () => {
    const res = await POST(
      new Request(URL_, {
        method: "POST",
        headers: { "content-type": "application/json", ...CSRF },
        body: JSON.stringify({ formVersion: "etorie-request-v1" }),
      })
    );
    expect(res.status).toBe(400);
    expect(mockCreateStructured).not.toHaveBeenCalled();
    expect(mockCreateLegacyInquiry).not.toHaveBeenCalled();
  });
});

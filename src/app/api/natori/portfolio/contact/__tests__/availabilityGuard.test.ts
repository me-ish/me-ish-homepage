import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitStore } from "@/lib/rateLimit";
import {
  resetMockPublicCommissionAvailability,
  setMockPublicCommissionAvailability,
} from "@/features/natori/server/publicCommissionAvailability";

vi.mock("server-only", () => ({}));

const { mockCreateStructured, mockCreateLegacy, mockUpload } = vi.hoisted(() => ({
  mockCreateStructured: vi.fn(),
  mockCreateLegacy: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock("@/features/natori/server/inquiryProjectService", () => ({
  createInquiryProject: (...args: unknown[]) => mockCreateLegacy(...args),
  createStructuredInquiryProject: (...args: unknown[]) => mockCreateStructured(...args),
}));

vi.mock("@/features/natori/server/portfolioSiteService", () => ({
  uploadPortfolioReferenceImage: (...args: unknown[]) => mockUpload(...args),
  signPortfolioReferenceImage: vi.fn(),
  deletePortfolioReferenceImages: vi.fn(),
}));

import { POST } from "../route";

const URL_ = "https://example.com/api/natori/portfolio/contact";
const CSRF = { "x-requested-with": "me-ish" };

function legacyRequest(requestType = "SNSアイコン") {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...CSRF },
    body: JSON.stringify({
      name: "テスト太郎",
      email: "client@example.com",
      requestType,
      details: "依頼内容です。",
    }),
  });
}

function massProductionRequest() {
  const form = new FormData();
  form.set("formVersion", "etorie-request-v1");
  form.set("name", "テスト太郎");
  form.set("email", "client@example.com");
  form.set(
    "requestData",
    JSON.stringify({
      schemaVersion: 1,
      formVersion: "etorie-request-v1",
      inquiryMode: "consultation",
      requestType: "other",
      requestTypeOther: "量産イラスト",
      commissionScope: "other",
      commissionScopeOther: "おばけ",
      options: [],
      usageTypes: [],
      usageTypeOther: null,
      commercialUse: "none",
      publicationPolicy: "unknown",
      budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
      deadline: { kind: "undecided", date: null, note: "" },
      characterFeatures: "",
      expressionMood: "笑顔",
      composition: "",
      colorDirection: "",
      referenceNotes: "",
      message: "",
      legacySource: null,
    })
  );
  return new Request(URL_, { method: "POST", headers: CSRF, body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetRateLimitStore();
  resetMockPublicCommissionAvailability();
  vi.stubEnv("NATORI_PUBLIC_INTAKE_V2", "1");
});

afterEach(() => {
  resetMockPublicCommissionAvailability();
  vi.unstubAllEnvs();
});

describe("public commission availability guard", () => {
  it("受付状態を取得できなければ fail-closed で 503", async () => {
    setMockPublicCommissionAvailability({ kind: "unavailable" });

    const response = await POST(legacyRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "temporarily_unavailable",
    });
    expect(mockCreateLegacy).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("コミッション全体が停止中なら直接POSTも 409 で拒否する", async () => {
    setMockPublicCommissionAvailability({
      kind: "ok",
      commissionOpen: false,
      massProductionIllustrationOpen: true,
    });

    const response = await POST(legacyRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "submission_rejected",
    });
    expect(mockCreateLegacy).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("量産イラスト停止中は structured の直接POSTも拒否する", async () => {
    setMockPublicCommissionAvailability({
      kind: "ok",
      commissionOpen: true,
      massProductionIllustrationOpen: false,
    });

    const response = await POST(massProductionRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "submission_rejected",
    });
    expect(mockCreateStructured).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("量産イラスト停止中は legacy の直接POSTも拒否する", async () => {
    setMockPublicCommissionAvailability({
      kind: "ok",
      commissionOpen: true,
      massProductionIllustrationOpen: false,
    });

    const response = await POST(legacyRequest("量産イラスト"));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "submission_rejected",
    });
    expect(mockCreateLegacy).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

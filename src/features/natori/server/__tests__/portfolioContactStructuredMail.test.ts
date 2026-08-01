// structured 受付メールのテスト。
// request_data の raw JSON・署名URL・Storage path・内部 UUID を載せないこと、
// 依頼者入力を HTML escape すること、未定表示が読めることを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  },
}));

import {
  sendStructuredPortfolioContactAutoReply,
  sendStructuredPortfolioContactEmail,
  type StructuredPortfolioContactInput,
} from "@/features/natori/server/portfolioContactService";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

const PROJECT_UUID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const OWNER_UUID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";

function requestData(overrides: Partial<NatoriRequestDataV1> = {}): NatoriRequestDataV1 {
  return {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "quote",
    requestType: "icon",
    requestTypeOther: null,
    commissionScope: "bust_up",
    commissionScopeOther: null,
    options: [
      { id: "expression_variation", label: "表情差分", quantity: 2, notes: "笑顔と泣き顔" },
    ],
    usageTypes: ["social_icon", "other"],
    usageTypeOther: "社内資料",
    commercialUse: "yes",
    publicationPolicy: "delayed",
    budget: { kind: "range", min: 5000, max: 12000, currency: "JPY" },
    deadline: { kind: "preferred_date", date: "2026-09-01", note: "イベント前に" },
    characterFeatures: "黒髪ロング <script>alert(1)</script>",
    expressionMood: "",
    composition: "",
    colorDirection: "",
    referenceNotes: "",
    message: "よろしくお願いします。",
    legacySource: null,
    ...overrides,
  } as NatoriRequestDataV1;
}

function input(
  overrides: Partial<StructuredPortfolioContactInput> = {}
): StructuredPortfolioContactInput {
  return {
    clientName: "テスト太郎",
    clientEmail: "client@example.com",
    requestData: requestData(),
    referenceImageCount: 2,
    referenceLinkUrls: ["https://example.com/board"],
    ...overrides,
  };
}

function sentPayload() {
  return mockSend.mock.calls[0][0] as {
    subject: string;
    text: string;
    html?: string;
    to: string[];
    replyTo?: string;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ error: null });
});

describe("管理者向け structured メール", () => {
  it("受付区分・依頼内容の要約と件数を載せる", async () => {
    await sendStructuredPortfolioContactEmail(input());
    const payload = sentPayload();
    expect(payload.subject).toContain("見積もりを希望");
    expect(payload.subject).toContain("テスト太郎");
    expect(payload.replyTo).toBe("client@example.com");
    for (const fragment of [
      "テスト太郎",
      "client@example.com",
      "SNSアイコン",
      "胸上",
      "表情差分",
      "商用利用する",
      "5,000円〜12,000円",
      "2026-09-01 希望",
      "添付画像: 2件",
      "参考URL: 1件",
    ]) {
      expect(payload.text).toContain(fragment);
    }
  });

  it("raw JSON・署名URL・Storage path・内部 UUID を載せない", async () => {
    await sendStructuredPortfolioContactEmail(
      input({ referenceLinkUrls: ["https://example.com/board"] })
    );
    const payload = sentPayload();
    const body = `${payload.subject}\n${payload.text}\n${payload.html ?? ""}`;
    expect(body).not.toContain("schemaVersion");
    expect(body).not.toContain("legacySource");
    expect(body).not.toContain("etorie-request-v1");
    expect(body).not.toContain(".webp");
    expect(body).not.toContain("natori-inquiry-refs");
    expect(body).not.toContain("token=");
    expect(body).not.toContain(PROJECT_UUID);
    expect(body).not.toContain(OWNER_UUID);
    expect(body).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u
    );
  });

  it("依頼者入力を HTML escape する", async () => {
    await sendStructuredPortfolioContactEmail(input());
    const html = sentPayload().html ?? "";
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("参考URLは escape 済み平文で、img や自動リンクにしない", async () => {
    await sendStructuredPortfolioContactEmail(
      input({ referenceLinkUrls: ["https://example.com/a?x=1&y=2"] })
    );
    const html = sentPayload().html ?? "";
    expect(html).toContain("https://example.com/a?x=1&amp;y=2");
    expect(html).not.toContain('<img src="https://example.com');
    expect(html).not.toContain('<a href="https://example.com');
  });

  it("未定・未選択は「未定」「なし」と表示する", async () => {
    await sendStructuredPortfolioContactEmail(
      input({
        requestData: requestData({
          requestType: "undecided",
          commissionScope: "undecided",
          options: [],
          usageTypes: [],
          usageTypeOther: null,
          commercialUse: "unknown",
          publicationPolicy: "unknown",
          budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
          deadline: { kind: "undecided", date: null, note: "" },
        }),
        referenceImageCount: 0,
        referenceLinkUrls: [],
      })
    );
    const text = sentPayload().text;
    expect(text).toContain("ご依頼の種類: 未定・相談して決めたい");
    expect(text).toContain("追加オプション: なし");
    expect(text).toContain("使用目的: 未定");
    expect(text).toContain("ご予算: 未定");
    expect(text).toContain("希望納期: 未定");
    expect(text).toContain("添付画像: 0件");
  });

  it("送信失敗は mailed:false を返し、例外にしない", async () => {
    mockSend.mockResolvedValue({ error: { message: "boom" } });
    await expect(sendStructuredPortfolioContactEmail(input())).resolves.toEqual({
      mailed: false,
    });
  });
});

describe("依頼者向け structured 自動返信", () => {
  it("依頼者宛に要約を送り、内部情報を載せない", async () => {
    await sendStructuredPortfolioContactAutoReply(input());
    const payload = sentPayload();
    expect(payload.to).toEqual(["client@example.com"]);
    expect(payload.text).toContain("テスト太郎 様");
    expect(payload.text).toContain("お見積もりをご連絡いたします");
    expect(payload.text).not.toContain(".webp");
    expect(payload.text).not.toContain("schemaVersion");
    expect(payload.text).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u
    );
  });

  it("consultation では相談の返信文言にする", async () => {
    await sendStructuredPortfolioContactAutoReply(
      input({ requestData: requestData({ inquiryMode: "consultation" }) })
    );
    expect(sentPayload().text).toContain("ご相談のお返事をいたします");
  });
});

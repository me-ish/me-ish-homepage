import { describe, expect, it } from "vitest";
import {
  natoriRequestDataV1Schema,
  natoriRequestSubmissionV1Schema,
  readNatoriRequestData,
  requestSchemaVersionOf,
  validateNatoriRequestDataV1,
} from "../requestSchema";
import type { NatoriRequestDataV1 } from "@/features/natori/types/request";

const consultationExample = {
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
  message: "配信用のイラストを考えています。内容から相談したいです。",
  legacySource: null,
} as const;

const quoteExample = {
  schemaVersion: 1,
  formVersion: "etorie-request-v1",
  inquiryMode: "quote",
  requestType: "icon",
  requestTypeOther: null,
  commissionScope: "bust_up",
  commissionScopeOther: null,
  options: [
    {
      id: "expression_variation",
      label: "表情差分",
      quantity: 2,
      notes: "笑顔と困り顔",
    },
  ],
  usageTypes: ["social_icon"],
  usageTypeOther: null,
  commercialUse: "none",
  publicationPolicy: "allowed",
  budget: { kind: "range", min: 5000, max: 10000, currency: "JPY" },
  deadline: { kind: "standard", date: null, note: "" },
  characterFeatures: "ピンクのボブヘア、青い瞳、白いパーカー",
  expressionMood: "明るい笑顔、やわらかい雰囲気",
  composition: "正面の胸上、丸型アイコンでも顔が切れない構図",
  colorDirection: "淡いピンクと水色",
  referenceNotes: "添付画像は髪型と衣装の参考です。",
  message: "",
  legacySource: null,
} as const;

const urgentQuoteExample = {
  schemaVersion: 1,
  formVersion: "etorie-request-v1",
  inquiryMode: "quote",
  requestType: "standing",
  requestTypeOther: null,
  commissionScope: "full_body",
  commissionScopeOther: null,
  options: [
    {
      id: "detailed_background",
      label: "しっかり背景",
      quantity: 1,
      notes: "配信部屋",
    },
    {
      id: "commercial_use",
      label: "商用利用",
      quantity: 1,
      notes: "収益化済み配信で使用",
    },
    {
      id: "private_work",
      label: "完全非公開",
      quantity: 1,
      notes: "",
    },
  ],
  usageTypes: ["streaming", "video_thumbnail"],
  usageTypeOther: null,
  commercialUse: "yes",
  publicationPolicy: "fully_private",
  budget: { kind: "range", min: 20000, max: null, currency: "JPY" },
  deadline: {
    kind: "rush_consultation",
    date: "2026-08-05",
    note: "配信開始日に間に合うか相談したいです。",
  },
  characterFeatures: "黒髪ロング、猫耳、赤いジャケット",
  expressionMood: "自信のある表情",
  composition: "全身立ち絵、背景透過版も希望",
  colorDirection: "黒と赤を基調",
  referenceNotes: "外部リンクに三面図と衣装資料があります。",
  message: "公開前案件のため、制作実績への掲載も不可でお願いします。",
  legacySource: null,
} as const;

function mutableClone<T>(value: T): T {
  return structuredClone(value);
}

describe("NatoriRequestData V1 examples", () => {
  it.each([
    ["内容がほぼ未定の相談", consultationExample],
    ["通常の見積依頼", quoteExample],
    ["商用・非公開・お急ぎ相談", urgentQuoteExample],
  ])("%sを正式contractとして受理する", (_label, value) => {
    expect(natoriRequestDataV1Schema.safeParse(value).success).toBe(true);
  });

  it("金額0は無料、nullは未定として別のunionで保持する", () => {
    const free = {
      ...quoteExample,
      budget: { kind: "fixed", min: 0, max: 0, currency: "JPY" },
    };

    expect(natoriRequestDataV1Schema.safeParse(free).success).toBe(true);
    expect(natoriRequestDataV1Schema.parse(consultationExample).budget).toEqual({
      kind: "undecided",
      min: null,
      max: null,
      currency: "JPY",
    });
  });

  it("前後空白をtrimし、表示label snapshotはIDと別に保持する", () => {
    const value = {
      ...quoteExample,
      options: [{ ...quoteExample.options[0], label: "  表情差分  " }],
      message: "  補足です  ",
    };
    const parsed = natoriRequestDataV1Schema.parse(value);

    expect(parsed.options[0]).toMatchObject({
      id: "expression_variation",
      label: "表情差分",
    });
    expect(parsed.message).toBe("補足です");
  });
});

describe("NatoriRequestData V1 conditional validation", () => {
  it("quoteの未定商品種別と未定制作範囲を拒否する", () => {
    const value = { ...mutableClone(consultationExample), inquiryMode: "quote" };
    expect(natoriRequestDataV1Schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["requestTypeOther", { requestType: "other", requestTypeOther: null }],
    ["commissionScopeOther", { commissionScope: "other", commissionScopeOther: "" }],
    ["usageTypeOther", { usageTypes: ["other"], usageTypeOther: null }],
  ])("%sの条件付き必須を検証する", (field, update) => {
    const result = validateNatoriRequestDataV1({
      ...mutableClone(consultationExample),
      ...update,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((error) => error.path === field)).toBe(true);
  });

  it("otherでない項目へother補足を混在させない", () => {
    const result = validateNatoriRequestDataV1({
      ...mutableClone(consultationExample),
      requestTypeOther: "誤った補足",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "requestTypeOther" })
      );
    }
  });

  it("other optionはtrim後に空でない補足を必須にする", () => {
    const result = validateNatoriRequestDataV1({
      ...mutableClone(quoteExample),
      options: [{ id: "other", label: "その他", quantity: 1, notes: "   " }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "options.0.notes" })
      );
    }
  });

  it("詳細6項目がすべて空なら拒否する", () => {
    const result = natoriRequestDataV1Schema.safeParse({
      ...mutableClone(consultationExample),
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("送信用envelopeは依頼者名・連絡先・相談内容を必須にする", () => {
    const detailsOnlyConsultation = {
      ...mutableClone(consultationExample),
      characterFeatures: "内容は決まっています",
      message: "",
    };
    expect(natoriRequestDataV1Schema.safeParse(detailsOnlyConsultation).success).toBe(true);
    expect(
      natoriRequestSubmissionV1Schema.safeParse({
        clientName: "",
        clientEmail: "not-an-email",
        requestData: detailsOnlyConsultation,
      }).success
    ).toBe(false);
    const missingConsultationMessage = natoriRequestSubmissionV1Schema.safeParse({
      clientName: "依頼者",
      clientEmail: "client@example.com",
      requestData: detailsOnlyConsultation,
    });
    expect(missingConsultationMessage.success).toBe(false);
    if (!missingConsultationMessage.success) {
      expect(missingConsultationMessage.error.issues).toContainEqual(
        expect.objectContaining({ path: ["requestData", "message"] })
      );
    }
    expect(
      natoriRequestSubmissionV1Schema.safeParse({
        clientName: "依頼者",
        clientEmail: "client@example.com",
        requestData: consultationExample,
      }).success
    ).toBe(true);
  });
});

describe("NatoriRequestData V1 bounds", () => {
  it.each([
    ["負の金額", { budget: { kind: "fixed", min: -1, max: -1, currency: "JPY" } }],
    ["rangeの逆転", { budget: { kind: "range", min: 10000, max: 5000, currency: "JPY" } }],
    ["fixedの不一致", { budget: { kind: "fixed", min: 1000, max: 2000, currency: "JPY" } }],
    ["不正な日付形式", { deadline: { kind: "preferred_date", date: "2026/02/28", note: "" } }],
    ["存在しない日付", { deadline: { kind: "preferred_date", date: "2026-02-30", note: "" } }],
  ])("%sを拒否する", (_label, update) => {
    expect(
      natoriRequestDataV1Schema.safeParse({ ...mutableClone(quoteExample), ...update }).success
    ).toBe(false);
  });

  it("optionの件数・数量・stable ID・重複を検証する", () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      id: `option_${index}`,
      label: `option ${index}`,
      quantity: 1,
      notes: "",
    }));
    const invalidQuantity = [{ ...quoteExample.options[0], quantity: 11 }];
    const invalidId = [{ ...quoteExample.options[0], id: "表情差分" }];
    const duplicate = [quoteExample.options[0], quoteExample.options[0]];

    for (const options of [tooMany, invalidQuantity, invalidId, duplicate]) {
      expect(
        natoriRequestDataV1Schema.safeParse({
          ...mutableClone(quoteExample),
          options,
        }).success
      ).toBe(false);
    }
  });

  it("文字数超過と危険な制御文字を拒否する", () => {
    expect(
      natoriRequestDataV1Schema.safeParse({
        ...mutableClone(quoteExample),
        message: "x".repeat(2001),
      }).success
    ).toBe(false);
    expect(
      natoriRequestDataV1Schema.safeParse({
        ...mutableClone(quoteExample),
        message: "unsafe\u0000text",
      }).success
    ).toBe(false);
  });

  it("元の外部JSON全体が64KiBを超えたら、未知fieldをstripする前に拒否する", () => {
    const result = natoriRequestDataV1Schema.safeParse({
      ...mutableClone(quoteExample),
      // 文字数は64KiB未満でもUTF-8では3bytes/文字なので上限を超える。
      unknownLargeField: "あ".repeat(22 * 1024),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("64KiB"))).toBe(true);
    }
  });
});

describe("versioned request reader", () => {
  it.each([
    ["schemaVersion", { ...quoteExample, schemaVersion: 99 }],
    ["discriminator", { ...quoteExample, inquiryMode: "inquiry" }],
  ])("不正な%sを拒否する", (_label, value) => {
    expect(natoriRequestDataV1Schema.safeParse(value).success).toBe(false);
  });

  it("V1を読み、field-level errorを返す", () => {
    const valid = readNatoriRequestData(quoteExample);
    expect(valid.success).toBe(true);

    const invalid = readNatoriRequestData({ ...mutableClone(quoteExample), options: [] });
    expect(invalid.success).toBe(true);

    const missingDetails = readNatoriRequestData({
      ...mutableClone(quoteExample),
      characterFeatures: "",
      expressionMood: "",
      composition: "",
      colorDirection: "",
      referenceNotes: "",
      message: "",
    });
    expect(missingDetails).toMatchObject({ success: false, reason: "invalid" });
    if (!missingDetails.success) {
      expect(missingDetails.errors).toContainEqual(expect.objectContaining({ path: "message" }));
    }
  });

  it("未知schemaVersionをV1へ推測変換しない", () => {
    expect(readNatoriRequestData({ ...mutableClone(quoteExample), schemaVersion: 2 })).toEqual({
      success: false,
      reason: "unsupported_version",
      errors: [],
    });
  });

  it("schemaVersionのswitchは現在の全versionを明示処理する", () => {
    const parsed: NatoriRequestDataV1 = natoriRequestDataV1Schema.parse(quoteExample);
    expect(requestSchemaVersionOf(parsed)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildInquiryNote,
  buildInquiryProjectDraft,
  buildInquiryTitle,
  inferNatoriProjectType,
  type NatoriInquiryInput,
} from "@/features/natori/lib/inquiry";

function makeInput(overrides: Partial<NatoriInquiryInput> = {}): NatoriInquiryInput {
  return {
    name: "テスト太郎",
    email: "test@example.com",
    requestType: "一枚絵",
    details: "淡いピンクでふんわり、正面バストアップでお願いします。",
    ...overrides,
  };
}

describe("inferNatoriProjectType", () => {
  it("maps icon / standing / sd keywords", () => {
    expect(inferNatoriProjectType("SNSアイコン")).toBe("icon");
    expect(inferNatoriProjectType("配信用立ち絵")).toBe("standing");
    expect(inferNatoriProjectType("ちびキャラ")).toBe("sd");
    expect(inferNatoriProjectType("SD", "デフォルメ")).toBe("sd");
  });

  it("falls back to illustration for unknown types", () => {
    expect(inferNatoriProjectType("一枚絵")).toBe("illustration");
    expect(inferNatoriProjectType("オリジナルキャラクター")).toBe("illustration");
  });

  it("also considers the plan text", () => {
    expect(inferNatoriProjectType("おまかせ", "アイコン")).toBe("icon");
  });
});

describe("buildInquiryTitle", () => {
  it("appends a concrete plan", () => {
    expect(buildInquiryTitle(makeInput({ requestType: "立ち絵", plan: "膝〜腰上（6,000円）" }))).toBe(
      "立ち絵・膝〜腰上（6,000円）"
    );
  });

  it("omits an undecided plan", () => {
    expect(buildInquiryTitle(makeInput({ requestType: "一枚絵", plan: "未定・相談して決めたい" }))).toBe(
      "一枚絵"
    );
    expect(buildInquiryTitle(makeInput({ requestType: "一枚絵" }))).toBe("一枚絵");
  });
});

describe("buildInquiryNote", () => {
  it("captures all fields and hides empty message section", () => {
    const note = buildInquiryNote(
      makeInput({
        email: "a@b.com",
        options: ["表情差分（+500円）", "商用利用（+3,000円）"],
        budget: "5,000円〜10,000円",
      })
    );
    expect(note).toContain("メール: a@b.com");
    expect(note).toContain("表情差分（+500円） / 商用利用（+3,000円）");
    expect(note).toContain("ご予算: 5,000円〜10,000円");
    expect(note).toContain("ご依頼の詳細");
    expect(note).not.toContain("その他・ご質問");
  });

  it("includes the message section when present", () => {
    const note = buildInquiryNote(makeInput({ message: "非公開希望です" }));
    expect(note).toContain("その他・ご質問");
    expect(note).toContain("非公開希望です");
  });

  it("lists attached reference images and falls back to '-' without refs", () => {
    const withRefs = buildInquiryNote(
      makeInput({
        refImages: ["https://example.com/a.webp", "https://example.com/b.webp"],
      })
    );
    expect(withRefs).toContain("添付画像1: https://example.com/a.webp");
    expect(withRefs).toContain("添付画像2: https://example.com/b.webp");

    const withoutRefs = buildInquiryNote(makeInput());
    expect(withoutRefs).toContain("--- キャラクター資料 ---\n-");
  });
});

describe("buildInquiryProjectDraft", () => {
  it("assembles title, client name, email, type and note", () => {
    const draft = buildInquiryProjectDraft(
      makeInput({ name: "  ナトリ  ", requestType: "SNSアイコン" })
    );
    expect(draft.clientName).toBe("ナトリ");
    expect(draft.clientEmail).toBe("test@example.com");
    expect(draft.type).toBe("icon");
    expect(draft.title).toBe("SNSアイコン");
    expect(draft.note).toContain("自動起票");
  });

  it("trims the client email", () => {
    const draft = buildInquiryProjectDraft(makeInput({ email: "  pad@example.com  " }));
    expect(draft.clientEmail).toBe("pad@example.com");
  });
});

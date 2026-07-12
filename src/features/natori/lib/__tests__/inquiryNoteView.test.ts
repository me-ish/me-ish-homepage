import { describe, expect, it } from "vitest";
import { buildInquiryNote } from "@/features/natori/lib/inquiry";
import {
  daysSinceISO,
  getInquiryLastActivityISO,
  parseInquiryNote,
} from "@/features/natori/lib/inquiryNoteView";
import { buildOrderMailLogEntry } from "@/features/natori/lib/orderMail";

describe("parseInquiryNote", () => {
  it("parses an auto-inquiry note built by buildInquiryNote", () => {
    const note = buildInquiryNote({
      name: "テスト太郎",
      email: "client@example.com",
      requestType: "SNSアイコン",
      plan: "胸上（4,000円）",
      options: ["表情差分（+500円）"],
      budget: "〜5,000円",
      deadline: "通常（約1ヶ月前後）",
      refImages: ["https://example.com/a.webp", "https://example.com/b.webp"],
      details: "淡いピンクでふんわりお願いします。",
      message: "非公開希望です",
    });

    const view = parseInquiryNote(note);
    expect(view.isAutoInquiry).toBe(true);
    expect(view.email).toBe("client@example.com");
    expect(view.fields).toContainEqual({ label: "ご依頼の種類", value: "SNSアイコン" });
    expect(view.fields).toContainEqual({ label: "ご予算", value: "〜5,000円" });
    expect(view.refImages).toEqual([
      "https://example.com/a.webp",
      "https://example.com/b.webp",
    ]);
    expect(view.details).toBe("淡いピンクでふんわりお願いします。");
    expect(view.message).toBe("非公開希望です");
    expect(view.logs).toEqual([]);
  });

  it("splits appended logs (estimate / payment / paid) from the note body", () => {
    const base = buildInquiryNote({
      name: "テスト太郎",
      email: "client@example.com",
      requestType: "一枚絵",
      details: "詳細です。",
    });
    const note = [
      base,
      "",
      buildOrderMailLogEntry("estimate", "2026-07-01", "client@example.com", 8000),
      "",
      buildOrderMailLogEntry(
        "payment",
        "2026-07-05",
        "client@example.com",
        8000,
        "https://pay.example.com/x"
      ),
      "",
      "【入金確認（Stripe） 2026-07-08】¥8,000 / session: cs_test",
    ].join("\n");

    const view = parseInquiryNote(note);
    expect(view.details).toBe("詳細です。");
    expect(view.logs.map((log) => log.label)).toEqual([
      "見積もりメール送信",
      "支払い依頼メール送信",
      "入金確認（Stripe）",
    ]);
    expect(view.logs[1].dateISO).toBe("2026-07-05");
    expect(view.logs[1].body).toContain("https://pay.example.com/x");
  });

  it("treats manual notes as plain text and still extracts logs", () => {
    const view = parseInquiryNote("手入力のメモです。\n\n【見送り 2026-07-02】予算が合わず");
    expect(view.isAutoInquiry).toBe(false);
    expect(view.plainNote).toBe("手入力のメモです。");
    expect(view.logs).toEqual([{ label: "見送り", dateISO: "2026-07-02", body: "予算が合わず" }]);
  });

  it("returns an empty view for missing notes", () => {
    const view = parseInquiryNote(null);
    expect(view.isAutoInquiry).toBe(false);
    expect(view.logs).toEqual([]);
    expect(view.plainNote).toBe("");
  });
});

describe("getInquiryLastActivityISO / daysSinceISO", () => {
  it("uses the latest log date, falling back to the received date", () => {
    const withLogs = parseInquiryNote(
      "【見積もりメール送信 2026-07-01】x\n【支払い依頼メール送信 2026-07-05】y"
    );
    expect(getInquiryLastActivityISO(withLogs, "2026-06-20")).toBe("2026-07-05");
    expect(getInquiryLastActivityISO(parseInquiryNote(null), "2026-06-20")).toBe("2026-06-20");
  });

  it("counts elapsed days and clamps future dates to 0", () => {
    const today = new Date(2026, 6, 12); // 2026-07-12
    expect(daysSinceISO("2026-07-05", today)).toBe(7);
    expect(daysSinceISO("2026-07-12", today)).toBe(0);
    expect(daysSinceISO("2026-07-20", today)).toBe(0);
  });
});

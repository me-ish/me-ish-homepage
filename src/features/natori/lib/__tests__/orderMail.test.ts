import { describe, expect, it } from "vitest";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  PAYMENT_LINK_PLACEHOLDER,
  buildEstimateMailDraft,
  buildOrderMailLogEntry,
  buildPaymentMailDraft,
  extractClientEmailFromNote,
  injectPaymentLink,
} from "@/features/natori/lib/orderMail";

describe("extractClientEmailFromNote", () => {
  it("finds the email line written by the inquiry auto-note", () => {
    const note = [
      "【ご依頼フォームからの自動起票】",
      "メール: client@example.com",
      "ご依頼の種類: SNSアイコン",
    ].join("\n");
    expect(extractClientEmailFromNote(note)).toBe("client@example.com");
  });

  it("returns null for missing or invalid values", () => {
    expect(extractClientEmailFromNote(null)).toBeNull();
    expect(extractClientEmailFromNote("手入力の案件メモ")).toBeNull();
    expect(extractClientEmailFromNote("メール: -")).toBeNull();
  });

  it("falls back to the latest send-log recipient for manual projects", () => {
    const note = [
      "手入力の案件メモ",
      "",
      buildOrderMailLogEntry("estimate", "2026-07-01", "old@example.com", 8000),
      "",
      buildOrderMailLogEntry("payment", "2026-07-05", "new@example.com", 8000, "https://pay.example.com/x"),
    ].join("\n");
    expect(extractClientEmailFromNote(note)).toBe("new@example.com");
  });

  it("prefers the auto-note email over log recipients", () => {
    const note = [
      "メール: form@example.com",
      buildOrderMailLogEntry("estimate", "2026-07-01", "typo@example.com", 8000),
    ].join("\n");
    expect(extractClientEmailFromNote(note)).toBe("form@example.com");
  });
});

describe("buildEstimateMailDraft", () => {
  it("includes client name, title, amount and acceptance ask", () => {
    const draft = buildEstimateMailDraft({
      clientName: "テスト太郎",
      title: "立ち絵一式",
      amount: 12000,
    });
    expect(draft.subject).toContain("お見積もり");
    expect(draft.subject).toContain("立ち絵一式");
    expect(draft.body).toContain("テスト太郎 様");
    expect(draft.body).toContain(formatYen(12000));
    expect(draft.body).toContain("このメールにご返信ください");
  });
});

describe("buildPaymentMailDraft / injectPaymentLink", () => {
  it("keeps the placeholder in the draft and replaces it on inject", () => {
    const draft = buildPaymentMailDraft({
      clientName: "テスト太郎",
      title: "立ち絵一式",
      amount: 12000,
    });
    expect(draft.body).toContain(PAYMENT_LINK_PLACEHOLDER);

    const injected = injectPaymentLink(draft.body, "https://pay.example.com/abc");
    expect(injected).toContain("https://pay.example.com/abc");
    expect(injected).not.toContain(PAYMENT_LINK_PLACEHOLDER);
  });

  it("appends the link when the placeholder was edited away", () => {
    const injected = injectPaymentLink("こんにちは", "https://pay.example.com/abc");
    expect(injected).toContain("https://pay.example.com/abc");
  });
});

describe("buildOrderMailLogEntry", () => {
  it("formats estimate and payment log lines", () => {
    expect(buildOrderMailLogEntry("estimate", "2026-07-12", "a@b.com", 12000)).toBe(
      `【見積もりメール送信 2026-07-12】宛先: a@b.com / 金額: ${formatYen(12000)}`
    );
    const payment = buildOrderMailLogEntry(
      "payment",
      "2026-07-12",
      "a@b.com",
      12000,
      "https://pay.example.com/abc"
    );
    expect(payment).toContain("支払い依頼メール送信");
    expect(payment).toContain("支払いリンク: https://pay.example.com/abc");
  });
});

import { describe, expect, it } from "vitest";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  ACCEPT_LINK_PLACEHOLDER,
  PAYMENT_LINK_PLACEHOLDER,
  QUOTE_VALID_DAYS,
  buildEstimateMailDraft,
  buildOrderMailLogEntry,
  buildPaidConfirmationMail,
  buildPaymentMailDraft,
  extractClientEmailFromNote,
  injectAcceptLink,
  injectPaymentLink,
  resolveClientEmail,
} from "@/features/natori/lib/orderMail";

describe("resolveClientEmail", () => {
  it("client_email カラムを最優先で使う（note にある別のメールより優先）", () => {
    expect(
      resolveClientEmail({
        clientEmail: "column@example.com",
        note: "メール: note@example.com",
      })
    ).toBe("column@example.com");
  });

  it("カラムが空・不正なら note からの抽出にフォールバックする", () => {
    expect(
      resolveClientEmail({ clientEmail: null, note: "メール: note@example.com" })
    ).toBe("note@example.com");
    expect(
      resolveClientEmail({ clientEmail: "   ", note: "メール: note@example.com" })
    ).toBe("note@example.com");
    expect(
      resolveClientEmail({ clientEmail: "not-an-email", note: "メール: note@example.com" })
    ).toBe("note@example.com");
  });

  it("カラムも note も無ければ null", () => {
    expect(resolveClientEmail({ clientEmail: null, note: "手入力の案件メモ" })).toBeNull();
    expect(resolveClientEmail({})).toBeNull();
  });
});

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
    expect(draft.body).toContain("ご返信");
  });

  it("有効期限とワンクリック承諾リンクのプレースホルダを含む", () => {
    const draft = buildEstimateMailDraft({
      clientName: "テスト太郎",
      title: "立ち絵一式",
      amount: 12000,
    });
    expect(draft.body).toContain(`${QUOTE_VALID_DAYS}日間`);
    expect(draft.body).toContain(ACCEPT_LINK_PLACEHOLDER);
    // 返信での承諾も案内している（ボタンを使わない依頼者向け）
    expect(draft.body).toContain("ご返信でご承諾");
  });
});

describe("injectAcceptLink", () => {
  it("プレースホルダを実URLに差し替え、消えていたら末尾に追記する", () => {
    const url = "https://www.me-ish.art/natori/quote/tok123";
    expect(injectAcceptLink(`前\n${ACCEPT_LINK_PLACEHOLDER}\n後`, url)).toBe(
      `前\n${url}\n後`
    );
    const appended = injectAcceptLink("プレースホルダ無し本文", url);
    expect(appended).toContain(url);
    expect(appended).toContain("ご承諾ページ");
  });
});

describe("buildPaidConfirmationMail", () => {
  it("入金確認と制作開始の案内を含む", () => {
    const mail = buildPaidConfirmationMail({
      clientName: "テスト太郎",
      title: "立ち絵一式",
      amount: 12000,
    });
    expect(mail.subject).toContain("ご入金確認");
    expect(mail.body).toContain("テスト太郎 様");
    expect(mail.body).toContain(formatYen(12000));
    expect(mail.body).toContain("制作を開始いたします");
    expect(mail.body).toContain("ご返信ください");
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

  it("リンクの性質（1回限り・旧リンク無効）を明記している", () => {
    const draft = buildPaymentMailDraft({
      clientName: "テスト太郎",
      title: "立ち絵一式",
      amount: 12000,
    });
    expect(draft.body).toContain("1回限り有効");
    expect(draft.body).toContain("そちらは無効");
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

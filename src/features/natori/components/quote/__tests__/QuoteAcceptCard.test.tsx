// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuoteAcceptCard from "@/features/natori/components/quote/QuoteAcceptCard";
import { formatYen } from "@/features/natori/lib/pricing";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCard() {
  return render(
    <QuoteAcceptCard
      token="token-12345678901234567890"
      title="一枚絵"
      clientName="テスト太郎"
      amount={12000}
      acceptedAt={null}
      expiresAt="2026-10-01T16:00:00.000Z"
    />
  );
}

describe("QuoteAcceptCard", () => {
  it("契約条件と法務リンクを最終確認として表示する", () => {
    renderCard();

    expect(screen.getByRole("heading", { name: "お申込み内容の最終確認" })).toBeTruthy();
    expect(screen.getByText("上記内容のイラスト制作 1案件")).toBeTruthy();
    expect(screen.getByText(formatYen(12000))).toBeTruthy();
    expect(screen.getByText("支払い案内メール送信日から7日以内")).toBeTruthy();
    expect(screen.getByText(/入金確認後に制作を開始し/)).toBeTruthy();
    expect(screen.getByText(/実施済み作業相当の費用をご負担いただく場合があります/)).toBeTruthy();
    expect(screen.getByText("2026年10月2日まで")).toBeTruthy();

    const terms = screen.getByRole("link", { name: "ご依頼規約" });
    const tokushoho = screen.getByRole("link", { name: "特定商取引法に基づく表記" });
    expect(terms.getAttribute("href")).toBe("/natori/legal/terms");
    expect(tokushoho.getAttribute("href")).toBe("/natori/legal/tokushoho");
  });

  it("規約確認前は確定できず、確認後だけ termsAccepted=true で送信する", async () => {
    renderCard();
    const button = screen.getByRole("button", { name: "この内容で依頼を確定する" });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /ご依頼規約.*特定商取引法に基づく表記.*および上記のお見積もり内容を確認しました/,
      })
    );
    expect((button as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/natori/quote/accept");
    expect(JSON.parse(String(init.body))).toEqual({
      token: "token-12345678901234567890",
      termsAccepted: true,
    });
    await screen.findByText("ご依頼の確定ありがとうございます!");
  });
});

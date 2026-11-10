// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import PortfolioStructuredCommissionForm from "@/features/natori/components/portfolio/PortfolioStructuredCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PORTFOLIO_DRAFT_STORAGE_KEY, serializePortfolioDraft } from "@/features/natori/lib/portfolioDraft";
import { buildNatoriRequestDataV1, createInitialPortfolioRequestFormState, portfolioOptionChoices } from "@/features/natori/lib/portfolioRequestForm";
import { createFrozenIntakeOperation, saveFrozenIntakeOperation } from "@/features/natori/data/intakeOperationClient";

function renderForm(props: Partial<Parameters<typeof PortfolioStructuredCommissionForm>[0]> = {}) {
  return render(<PortfolioStructuredCommissionForm content={defaultPortfolioContent} commissionOpen onSuccess={() => {}} {...props} />);
}

function storeDraft(message: string, extra: Partial<ReturnType<typeof createInitialPortfolioRequestFormState>> = {}, hadImages = false) {
  localStorage.setItem(PORTFOLIO_DRAFT_STORAGE_KEY, serializePortfolioDraft({
    state: { ...createInitialPortfolioRequestFormState(), message, ...extra }, step: 0, savedAt: Date.now() - 1000, hadImages,
  }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("下書き保存", () => {
  it("入力が止まってから、お名前・メールを除いて端末に保存する", () => {
    vi.useFakeTimers();
    renderForm();
    fireEvent.change(screen.getByLabelText(/ご相談・ご依頼の内容/), { target: { value: "水色の髪の子を描いてほしい" } });
    fireEvent.change(screen.getByLabelText(/お名前/), { target: { value: "テスト太郎" } });
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "taro@example.com" } });
    expect(localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(600); });
    const saved = localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY) ?? "";
    expect(saved).toContain("水色の髪の子を描いてほしい");
    expect(saved).not.toContain("テスト太郎");
    expect(saved).not.toContain("taro@example.com");
  });

  it("開き直すと下書きを戻し、消すボタンで入力ごと消せる", async () => {
    storeDraft("前回の続き", { inquiryMode: "quote", commissionScope: "bust_up", requestType: "illustration" }, true);
    renderForm();
    expect((await screen.findByText(/前回の下書きを復元しました/)).textContent).toBe("前回の下書きを復元しました。参考画像は選び直してください。");
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("前回の続き");
    expect((screen.getByRole("radio", { name: "見積もりを希望" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "下書きを消す" }));
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText(/前回の下書きを復元しました/)).toBeNull();
    expect(localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("送信を始めたら下書きを消す（内容は送信の記録が持つ）", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderForm();
    fireEvent.change(screen.getByLabelText(/ご相談・ご依頼の内容/), { target: { value: "送る本文" } });
    fireEvent.change(screen.getByLabelText(/お名前/), { target: { value: "テスト太郎" } });
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "taro@example.com" } });
    await waitFor(() => expect(localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY)).toContain("送る本文"));
    fireEvent.click(screen.getByRole("button", { name: "内容を確認する" }));
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY)).toBeNull());
  });

  it("壊れた下書きは読まずに消す", () => {
    localStorage.setItem(PORTFOLIO_DRAFT_STORAGE_KEY, "{broken");
    renderForm();
    expect(screen.queryByText(/前回の下書きを復元しました/)).toBeNull();
    expect(localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("料金表や作品から来たとき・デモでは下書きを読まない", () => {
    storeDraft("前回の続き");
    const { unmount } = renderForm({ initialPlan: "bust_up", fromPlan: true });
    expect(screen.queryByText(/前回の下書きを復元しました/)).toBeNull();
    unmount();
    storeDraft("前回の続き");
    renderForm({ initialMessage: "この雰囲気で" });
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("この雰囲気で");
    cleanup();
    storeDraft("前回の続き");
    renderForm({ demoMode: true });
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("");
  });

  it("送信の復元があるときは、下書きより送信内容を優先する", async () => {
    storeDraft("下書きの本文");
    const state = { ...createInitialPortfolioRequestFormState(), message: "送信した本文" };
    const fields = { name: "Synthetic", email: "synthetic@example.invalid", formVersion: "etorie-request-v1",
      requestData: JSON.stringify(buildNatoriRequestDataV1(state, portfolioOptionChoices(defaultPortfolioContent))), referenceLinks: "[]" };
    saveFrozenIntakeOperation("natori-intake-operation-v1", await createFrozenIntakeOperation(fields, []));
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderForm();
    await waitFor(() => expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("送信した本文"));
    expect(screen.queryByText(/前回の下書きを復元しました/)).toBeNull();
  });

  it("localStorage が使えなくても入力できる", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    vi.useFakeTimers();
    renderForm();
    fireEvent.change(screen.getByLabelText(/ご相談・ご依頼の内容/), { target: { value: "書けます" } });
    act(() => { vi.advanceTimersByTime(600); });
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("書けます");
    vi.restoreAllMocks();
  });
});

describe("メールの打ち間違い案内", () => {
  it("欄を離れたら候補を出し、押したときだけ書き換える", () => {
    renderForm();
    const email = screen.getByLabelText(/メールアドレス/) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "taro@gmial.com" } });
    expect(screen.queryByText(/もしかして/)).toBeNull();
    fireEvent.blur(email);
    expect(screen.getByText(/もしかして/).textContent).toBe("もしかして taro@gmail.com ですか？");
    expect(email.value).toBe("taro@gmial.com");
    fireEvent.click(screen.getByRole("button", { name: "この住所にする" }));
    expect(email.value).toBe("taro@gmail.com");
    expect(screen.queryByText(/もしかして/)).toBeNull();
  });

  it("正しいドメインや書き直し中は出さない", () => {
    renderForm();
    const email = screen.getByLabelText(/メールアドレス/) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "taro@gmail.com" } });
    fireEvent.blur(email);
    expect(screen.queryByText(/もしかして/)).toBeNull();
    fireEvent.change(email, { target: { value: "taro@gmial.com" } });
    fireEvent.blur(email);
    fireEvent.change(email, { target: { value: "taro@gmial.co" } });
    expect(screen.queryByText(/もしかして/)).toBeNull();
  });
});

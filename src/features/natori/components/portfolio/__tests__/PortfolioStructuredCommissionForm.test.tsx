// @vitest-environment jsdom
// 構造化ご依頼フォームの DOM テスト。label 関連付け、条件付き表示、
// 二重 submit 防止、server field error 表示、送信 payload の形を固定する。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));

import PortfolioCommissionForm from "@/features/natori/components/portfolio/PortfolioCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

const fetchMock = vi.fn();

function renderForm() {
  return render(
    <PortfolioCommissionForm content={defaultPortfolioContent} structuredIntake />
  );
}

function submittedForm(): FormData {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return init.body as FormData;
}

function submittedRequestData(): Record<string, never> & Record<string, unknown> {
  return JSON.parse(submittedForm().get("requestData") as string);
}

function submittedLinks(): Array<{ url: string; label: string }> {
  return JSON.parse(submittedForm().get("referenceLinks") as string);
}

function okResponse(body: Record<string, unknown> = { ok: true, autoReplied: true }) {
  return { ok: true, status: 201, json: async () => body } as Response;
}

async function fillMinimum(message = "ご相談させてください。") {
  await userEvent.type(screen.getByLabelText(/お名前/), "テスト太郎");
  await userEvent.type(screen.getByLabelText(/メールアドレス/), "client@example.com");
  await userEvent.type(screen.getByLabelText(/ご相談・ご依頼の内容/), message);
}

function formElement(): HTMLFormElement {
  return document.querySelector("form") as HTMLFormElement;
}

function detailsBySummary(text: string): HTMLDetailsElement {
  const details = Array.from(document.querySelectorAll("details")).find((element) =>
    element.querySelector("summary")?.textContent?.includes(text)
  );
  if (!details) throw new Error(`details not found: ${text}`);
  return details;
}

function submit() {
  fireEvent.submit(formElement());
}

let objectUrlCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  objectUrlCounter = 0;
  fetchMock.mockResolvedValue(okResponse());
  vi.stubGlobal("fetch", fetchMock);
  // jsdom には objectURL が無い
  Object.defineProperty(URL, "createObjectURL", {
    value: () => `blob:preview-${(objectUrlCounter += 1)}`,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("最低入力と送信", () => {
  it("consultation は氏名・メール・相談内容だけで送信できる", async () => {
    renderForm();
    await fillMinimum();
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const form = submittedForm();
    expect(form.get("formVersion")).toBe("etorie-request-v1");
    expect(form.get("name")).toBe("テスト太郎");
    expect(form.get("email")).toBe("client@example.com");
    const data = submittedRequestData();
    expect(data).toMatchObject({
      schemaVersion: 1,
      formVersion: "etorie-request-v1",
      inquiryMode: "consultation",
      requestType: "undecided",
      commissionScope: "undecided",
      legacySource: null,
      message: "ご相談させてください。",
    });
    await screen.findByText("送信ありがとうございます!");
  });

  it("quote に切り替えても type / scope は未定のまま送信できる", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText("見積もりを希望"));
    await fillMinimum("見積もりをお願いします。");
    submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData()).toMatchObject({
      inquiryMode: "quote",
      requestType: "undecided",
      commissionScope: "undecided",
    });
  });

  it("送信中は二重 submit を実行しない", async () => {
    let release: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        release = resolve;
      })
    );
    renderForm();
    await fillMinimum();

    submit();
    submit();
    submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: "送信中…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    release(okResponse());
    await screen.findByText("送信ありがとうございます!");
    expect(
      trackNatoriPageEvent.mock.calls.filter(
        ([event]) => event === "portfolio_form_submit"
      )
    ).toHaveLength(1);
  });
});

describe("PF-09 analytics", () => {
  it("最初の実入力だけを form_start として記録する", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/お名前/), "テスト太郎");
    await userEvent.type(screen.getByLabelText(/メールアドレス/), "client@example.com");

    expect(
      trackNatoriPageEvent.mock.calls.filter(
        ([event]) => event === "portfolio_form_start"
      )
    ).toEqual([["portfolio_form_start", "form"]]);
  });

  it("利用者が選んだフォームモードを記録する", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText("見積もりを希望"));
    await userEvent.click(screen.getByLabelText("まず相談したい"));

    expect(
      trackNatoriPageEvent.mock.calls.filter(
        ([event]) => event === "portfolio_form_mode_select"
      )
    ).toEqual([
      ["portfolio_form_mode_select", "quote"],
      ["portfolio_form_mode_select", "consultation"],
    ]);
  });
});

describe("条件付き入力", () => {
  it("その他を選んだときだけ補足欄が現れ、戻すと値を送らない", async () => {
    renderForm();
    expect(screen.queryByLabelText(/ご依頼の種類（その他の内容）/)).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("ご依頼の種類"), "other");
    const otherInput = screen.getByLabelText(/ご依頼の種類（その他の内容）/);
    await userEvent.type(otherInput, "アクリルスタンド");

    await userEvent.selectOptions(screen.getByLabelText("ご依頼の種類"), "icon");
    expect(screen.queryByLabelText(/ご依頼の種類（その他の内容）/)).toBeNull();

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData().requestTypeOther).toBeNull();
  });

  it("使用目的の その他 で補足欄が出る", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText("その他"));
    await userEvent.type(screen.getByLabelText(/使用目的（その他の内容）/), "社内資料");
    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData()).toMatchObject({
      usageTypes: ["other"],
      usageTypeOther: "社内資料",
    });
  });

  it("使用目的は複数選択できる", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText("SNSアイコン"));
    await userEvent.click(screen.getByLabelText("配信で使用"));
    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData().usageTypes).toEqual(["social_icon", "streaming"]);
  });

  it("一定期間後に公開可を選ぶと公開可能日を送る", async () => {
    renderForm();
    const publicationPolicy = screen.getByLabelText("作品の公開可否");
    expect(screen.queryByLabelText("公開可能日＊")).toBeNull();

    await userEvent.selectOptions(publicationPolicy, "delayed");
    fireEvent.change(screen.getByLabelText("公開可能日必須"), {
      target: { value: "2026-10-15" },
    });

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData()).toMatchObject({
      publicationPolicy: "delayed",
      publicationAllowedFrom: "2026-10-15",
    });
  });

  it("公開条件を変更すると公開可能日を送らない", async () => {
    renderForm();
    const publicationPolicy = screen.getByLabelText("作品の公開可否");
    await userEvent.selectOptions(publicationPolicy, "delayed");
    fireEvent.change(screen.getByLabelText("公開可能日必須"), {
      target: { value: "2026-10-15" },
    });
    await userEvent.selectOptions(publicationPolicy, "allowed");
    expect(screen.queryByLabelText("公開可能日＊")).toBeNull();

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData()).toMatchObject({
      publicationPolicy: "allowed",
      publicationAllowedFrom: null,
    });
  });

  it("予算は kind に応じて入力欄が切り替わり、隠れた値は送らない", async () => {
    renderForm();
    const budgetKind = screen.getByLabelText("ご予算");

    await userEvent.selectOptions(budgetKind, "range");
    await userEvent.type(screen.getByLabelText("下限（円）"), "5000");
    await userEvent.type(screen.getByLabelText("上限（円・任意）"), "9000");

    await userEvent.selectOptions(budgetKind, "fixed");
    // 上限は kind 切替で非表示になり、送信対象からも外れる
    expect(screen.queryByLabelText("上限（円・任意）")).toBeNull();
    const fixedAmount = screen.getByLabelText("ご予算（円）");
    await userEvent.clear(fixedAmount);
    await userEvent.type(fixedAmount, "8000");

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData().budget).toEqual({
      kind: "fixed",
      min: 8000,
      max: 8000,
      currency: "JPY",
    });
  });

  it("納期は4種類を選べ、日付欄は該当 kind のときだけ現れる", async () => {
    renderForm();
    const deadlineKind = screen.getByLabelText("希望納期");

    await userEvent.selectOptions(deadlineKind, "standard");
    expect(screen.queryByLabelText(/希望日/)).toBeNull();

    await userEvent.selectOptions(deadlineKind, "preferred_date");
    fireEvent.change(screen.getByLabelText(/希望日/), { target: { value: "2026-09-01" } });

    await userEvent.selectOptions(deadlineKind, "rush_consultation");
    await userEvent.type(screen.getByLabelText("納期の補足（任意）"), "急ぎです");

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData().deadline).toEqual({
      kind: "rush_consultation",
      date: "2026-09-01",
      note: "急ぎです",
    });
  });
});

describe("オプション", () => {
  it("固定オプションには数量欄を表示しない", async () => {
    renderForm();
    const detailedBackground = screen.getByRole("checkbox", { name: /しっかり背景/ });
    await userEvent.click(detailedBackground);
    expect(screen.queryByLabelText("数量")).toBeNull();
    expect(screen.getByLabelText("補足（任意）")).toBeTruthy();

    await userEvent.click(detailedBackground);
    await userEvent.click(screen.getByLabelText(/表情差分/));
    expect(screen.getByLabelText("数量")).toBeTruthy();
  });

  it("商用利用と公開可否は専用項目だけに表示する", () => {
    renderForm();
    expect(screen.queryByRole("checkbox", { name: /商用利用/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /サンプル使用不可/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /完全非公開/ })).toBeNull();
    expect(screen.getByLabelText("商用利用")).toBeTruthy();
    expect(screen.getByLabelText("作品の公開可否")).toBeTruthy();
  });

  it("stable ID・label snapshot・数量・補足を送る", async () => {
    renderForm();
    await userEvent.click(screen.getByLabelText(/表情差分/));
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "3" } });
    await userEvent.type(screen.getByLabelText("補足（任意）"), "笑顔と泣き顔");

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedRequestData().options).toEqual([
      { id: "expression_variation", label: "表情差分", quantity: 3, notes: "笑顔と泣き顔" },
    ]);
  });
});

describe("資料", () => {
  it("参考URLは最大5行まで追加できる", async () => {
    renderForm();
    const addButton = screen.getByRole("button", { name: "＋ 参考URLを追加" });
    for (let i = 0; i < 4; i++) await userEvent.click(addButton);

    expect(screen.getAllByLabelText(/^参考URL \d$/)).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "＋ 参考URLを追加" })).toBeNull();
  });

  it("重複URLを client 側で field error にし、送信しない", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "＋ 参考URLを追加" }));
    await userEvent.type(screen.getByLabelText("参考URL 1"), "https://example.com/a");
    await userEvent.type(screen.getByLabelText("参考URL 2"), "https://EXAMPLE.com/a");

    await fillMinimum();
    submit();

    expect(await screen.findByText("1行目と同じURLです。")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("入力済みURLだけを順序どおり送る", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("参考URL 1"), "https://example.com/first");
    const urlDescription = screen.getByLabelText("このURLの内容（任意）");
    expect(urlDescription.getAttribute("placeholder")).toBe(
      "例：キャラクター設定資料、衣装の参考"
    );
    await userEvent.type(urlDescription, "一つ目");

    await fillMinimum();
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(submittedLinks()).toEqual([{ url: "https://example.com/first", label: "一つ目" }]);
  });

  it("画像は最大5枚までで、6枚目は追加できない", async () => {
    renderForm();
    const input = screen.getByLabelText("キャラクター資料の画像を選択");
    const files = Array.from(
      { length: 6 },
      (_, i) => new File([new Uint8Array(4)], `ref-${i}.png`, { type: "image/png" })
    );
    fireEvent.change(input, { target: { files } });

    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "＋ 画像を追加" })).toBeNull();
  });

  it("1枚が上限超過なら error を表示して追加しない", async () => {
    renderForm();
    const input = screen.getByLabelText("キャラクター資料の画像を選択");
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [big] } });

    expect(screen.getByText("1枚10MBまで（png / jpg / webp / gif）です。")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("server error の表示", () => {
  it("field error を該当項目のそばに出す", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        ok: false,
        error: "invalid_request",
        fields: [
          { path: "requestData.message", message: "依頼内容を入力してください" },
          { path: "clientEmail", message: "メールアドレスの形式が不正です" },
        ],
      }),
    } as Response);

    renderForm();
    await fillMinimum();
    submit();

    // field 直下の inline error と、最終セクションの一覧の両方に出る
    await waitFor(() =>
      expect(document.getElementById("pf-message-error")?.textContent).toBe(
        "依頼内容を入力してください"
      )
    );
    expect(document.getElementById("pf-email-error")?.textContent).toBe(
      "メールアドレスの形式が不正です"
    );
    expect(screen.getAllByText("依頼内容を入力してください").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/ご相談・ご依頼の内容/).getAttribute("aria-describedby")).toBe(
      "pf-message-error"
    );
    expect(screen.queryByText("送信ありがとうございます!")).toBeNull();
  });

  it("通信失敗では一般的な error を出し、成功表示にしない", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderForm();
    await fillMinimum();
    submit();

    expect(
      await screen.findByText(
        "送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。"
      )
    ).toBeTruthy();
    expect(screen.queryByText("送信ありがとうございます!")).toBeNull();
    expect(
      trackNatoriPageEvent.mock.calls.some(
        ([event]) => event === "portfolio_form_submit"
      )
    ).toBe(false);
  });
});

describe("アクセシビリティ / モバイル想定 DOM", () => {
  it("consultation は任意セクションを閉じ、quote は必要な入力を展開する", async () => {
    renderForm();

    for (const title of [
      "依頼の種類",
      "用途・条件",
      "予算・納期",
      "キャラクター・イメージの詳細",
      "資料",
    ]) {
      expect(detailsBySummary(title).open).toBe(false);
    }

    await userEvent.click(screen.getByLabelText("見積もりを希望"));

    for (const title of [
      "依頼の種類",
      "用途・条件",
      "予算・納期",
      "キャラクター・イメージの詳細",
      "資料",
    ]) {
      expect(detailsBySummary(title).open).toBe(true);
    }
  });

  it("primary fields は desktop でも1列で、必須を文字で示す", () => {
    renderForm();

    for (const label of [/お名前/, /メールアドレス/, "ご依頼の種類", "商用利用"]) {
      const control = screen.getByLabelText(label);
      expect(control.parentElement?.parentElement?.className).not.toContain("sm:grid-cols-2");
    }

    expect(screen.getAllByText("必須")).toHaveLength(3);
    expect(screen.getByLabelText(/お名前/).closest("div")?.textContent).toContain("必須");
    expect(screen.getByLabelText(/メールアドレス/).closest("div")?.textContent).toContain("必須");
    expect(screen.getByLabelText(/ご相談・ご依頼の内容/).closest("div")?.textContent).toContain(
      "必須"
    );
  });

  it("主要入力が label と関連付いている", () => {
    renderForm();
    for (const labelText of [
      /お名前/,
      /メールアドレス/,
      "ご依頼の種類",
      "制作範囲",
      "ご予算",
      "希望納期",
      /ご相談・ご依頼の内容/,
      "参考URL 1",
    ]) {
      expect(screen.getByLabelText(labelText)).toBeTruthy();
    }
  });

  it("入力は幅指定なしの w-full で、横スクロールを起こす固定幅を持たない", () => {
    renderForm();
    const message = screen.getByLabelText(/ご相談・ご依頼の内容/);
    expect(message.className).toContain("w-full");
    expect(message.getAttribute("style") ?? "").not.toMatch(/width:\s*\d+px/);
  });

  it("セクションは見出し付きで分割されている", () => {
    renderForm();
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.length).toBeGreaterThanOrEqual(3);
    const firstStepNumber = headings[0].querySelector("span[aria-hidden='true']") as HTMLElement;
    expect(firstStepNumber.className).toContain("h-7 w-7");
    expect(firstStepNumber.className).toContain("text-sm font-black");
    expect(firstStepNumber.className).toContain("border-2");
    expect(firstStepNumber.style.background).toBe("rgb(248, 195, 208)");
    expect(firstStepNumber.style.borderColor).toBe("rgb(180, 90, 115)");
    expect(firstStepNumber.style.color).toBe("rgb(122, 51, 74)");

    const submitButton = screen.getByRole("button", { name: "この内容で送信する" });
    expect(submitButton.className).toContain("text-base font-black");
    expect(submitButton.className).toContain("border-2");
    expect(submitButton.style.background).toBe("rgb(248, 195, 208)");
    expect(submitButton.style.borderColor).toBe("rgb(180, 90, 115)");
    expect(submitButton.style.color).toBe("rgb(122, 51, 74)");
  });
});

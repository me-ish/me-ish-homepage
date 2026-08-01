// 入力 state → RequestData V1 変換の純関数テスト。
// 変換結果が共有 schema を必ず通ること、非表示 field の残留値が出ないことを固定する。
import { describe, expect, it } from "vitest";
import {
  NATORI_MAX_REFERENCE_LINKS,
  applyPortfolioPlanSelection,
  buildNatoriRequestDataV1,
  buildSelectedOptions,
  collectPortfolioReferenceLinkErrors,
  createInitialPortfolioRequestFormState,
  portfolioOptionChoices,
  pruneHiddenPortfolioRequestFields,
  submittedPortfolioReferenceLinks,
  type PortfolioOptionChoice,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import { validateNatoriRequestDataV1 } from "@/features/natori/lib/requestSchema";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

function state(overrides: Partial<PortfolioRequestFormState> = {}): PortfolioRequestFormState {
  return { ...createInitialPortfolioRequestFormState(), ...overrides };
}

const choices = portfolioOptionChoices(defaultPortfolioContent);

describe("buildNatoriRequestDataV1", () => {
  it("consultation の最低入力が共有 schema を通る", () => {
    const data = buildNatoriRequestDataV1(state({ message: "ご相談したいです。" }), choices);
    expect(data).toMatchObject({
      schemaVersion: 1,
      formVersion: "etorie-request-v1",
      inquiryMode: "consultation",
      requestType: "undecided",
      commissionScope: "undecided",
      legacySource: null,
    });
    expect(validateNatoriRequestDataV1(data).success).toBe(true);
  });

  it("quote でも type / scope を undecided のまま送れる", () => {
    const data = buildNatoriRequestDataV1(
      state({ inquiryMode: "quote", message: "見積もりをお願いします。" }),
      choices
    );
    expect(data.inquiryMode).toBe("quote");
    expect(data.requestType).toBe("undecided");
    expect(validateNatoriRequestDataV1(data).success).toBe(true);
  });

  it("other 補足は該当時だけ入り、それ以外は null になる", () => {
    const withOther = buildNatoriRequestDataV1(
      state({
        requestType: "other",
        requestTypeOther: "アクリルスタンド",
        commissionScope: "other",
        commissionScopeOther: "特殊構図",
        usageTypes: ["other"],
        usageTypeOther: "社内資料",
        message: "相談",
      }),
      choices
    );
    expect(withOther.requestTypeOther).toBe("アクリルスタンド");
    expect(withOther.commissionScopeOther).toBe("特殊構図");
    expect(withOther.usageTypeOther).toBe("社内資料");
    expect(validateNatoriRequestDataV1(withOther).success).toBe(true);

    // 種別を戻すと補足は送信されない（残留値を出さない）
    const reverted = buildNatoriRequestDataV1(
      state({
        requestType: "icon",
        requestTypeOther: "アクリルスタンド",
        commissionScope: "bust_up",
        commissionScopeOther: "特殊構図",
        usageTypes: ["social_icon"],
        usageTypeOther: "社内資料",
        message: "相談",
      }),
      choices
    );
    expect(reverted.requestTypeOther).toBeNull();
    expect(reverted.commissionScopeOther).toBeNull();
    expect(reverted.usageTypeOther).toBeNull();
    expect(validateNatoriRequestDataV1(reverted).success).toBe(true);
  });

  it("budget は kind に応じた形になり、非表示入力は無視される", () => {
    const undecided = buildNatoriRequestDataV1(
      state({ budgetKind: "undecided", budgetMin: "5000", budgetMax: "9000", message: "x" }),
      choices
    );
    expect(undecided.budget).toEqual({
      kind: "undecided",
      min: null,
      max: null,
      currency: "JPY",
    });

    const range = buildNatoriRequestDataV1(
      state({ budgetKind: "range", budgetMin: "5000", budgetMax: "9000", message: "x" }),
      choices
    );
    expect(range.budget).toEqual({ kind: "range", min: 5000, max: 9000, currency: "JPY" });

    const openRange = buildNatoriRequestDataV1(
      state({ budgetKind: "range", budgetMin: "5000", budgetMax: "", message: "x" }),
      choices
    );
    expect(openRange.budget).toEqual({ kind: "range", min: 5000, max: null, currency: "JPY" });

    const fixed = buildNatoriRequestDataV1(
      state({ budgetKind: "fixed", budgetMin: "8000", budgetMax: "9999", message: "x" }),
      choices
    );
    expect(fixed.budget).toEqual({ kind: "fixed", min: 8000, max: 8000, currency: "JPY" });
    expect(validateNatoriRequestDataV1(fixed).success).toBe(true);
  });

  it("金額が数値でなければ共有 schema が field error にする", () => {
    const data = buildNatoriRequestDataV1(
      state({ budgetKind: "range", budgetMin: "たくさん", message: "x" }),
      choices
    );
    const result = validateNatoriRequestDataV1(data);
    expect(result.success).toBe(false);
  });

  it("deadline は4種類とも schema を通り、非表示の日付は落ちる", () => {
    const undecided = buildNatoriRequestDataV1(
      state({ deadlineKind: "undecided", deadlineDate: "2026-09-01", message: "x" }),
      choices
    );
    expect(undecided.deadline).toEqual({ kind: "undecided", date: null, note: "" });

    const standard = buildNatoriRequestDataV1(
      state({ deadlineKind: "standard", deadlineDate: "2026-09-01", message: "x" }),
      choices
    );
    expect(standard.deadline).toEqual({ kind: "standard", date: null, note: "" });

    const preferred = buildNatoriRequestDataV1(
      state({ deadlineKind: "preferred_date", deadlineDate: "2026-09-01", message: "x" }),
      choices
    );
    expect(preferred.deadline).toEqual({
      kind: "preferred_date",
      date: "2026-09-01",
      note: "",
    });

    const rush = buildNatoriRequestDataV1(
      state({ deadlineKind: "rush_consultation", deadlineNote: "急ぎです", message: "x" }),
      choices
    );
    expect(rush.deadline).toEqual({
      kind: "rush_consultation",
      date: null,
      note: "急ぎです",
    });

    for (const data of [undecided, standard, preferred, rush]) {
      expect(validateNatoriRequestDataV1(data).success).toBe(true);
    }
  });

  it("usage は重複を排除する", () => {
    const data = buildNatoriRequestDataV1(
      state({ usageTypes: ["social_icon", "streaming", "social_icon"], message: "x" }),
      choices
    );
    expect(data.usageTypes).toEqual(["social_icon", "streaming"]);
    expect(validateNatoriRequestDataV1(data).success).toBe(true);
  });
});

describe("buildSelectedOptions", () => {
  it("stable ID・label snapshot・quantity・notes を保存する", () => {
    const options = buildSelectedOptions(
      state({
        optionSelections: {
          expression_variation: { selected: true, quantity: 3, notes: "笑顔と泣き顔" },
          commercial_use: { selected: false, quantity: 1, notes: "" },
        },
      }),
      choices
    );
    expect(options).toEqual([
      {
        id: "expression_variation",
        label: "表情差分",
        quantity: 3,
        notes: "笑顔と泣き顔",
      },
    ]);
  });

  it("stable ID の無い legacy 項目は label から ID を推定せず「その他」へ集約する", () => {
    const legacyChoices: PortfolioOptionChoice[] = [
      { key: "legacy-option-0", stableId: null, label: "旧オプションA", price: "+100円" },
      { key: "legacy-option-1", stableId: null, label: "旧オプションB", price: "+200円" },
    ];
    const options = buildSelectedOptions(
      state({
        optionSelections: {
          "legacy-option-0": { selected: true, quantity: 1, notes: "" },
          "legacy-option-1": { selected: true, quantity: 1, notes: "" },
        },
      }),
      legacyChoices
    );
    expect(options).toEqual([
      {
        id: "other",
        label: "その他のオプション",
        quantity: 1,
        notes: "旧オプションA / 旧オプションB",
      },
    ]);
  });
});

describe("applyPortfolioPlanSelection", () => {
  it("sd プランは request type、体の範囲プランは commission scope に反映する", () => {
    expect(applyPortfolioPlanSelection(state(), "sd").requestType).toBe("sd");
    expect(applyPortfolioPlanSelection(state(), "bust_up").commissionScope).toBe("bust_up");
    expect(applyPortfolioPlanSelection(state(), "full_body").commissionScope).toBe("full_body");
  });

  it("未知 / ID なしのプランでは何も変更しない", () => {
    const base = state();
    expect(applyPortfolioPlanSelection(base, null)).toBe(base);
    expect(applyPortfolioPlanSelection(base, "custom-plan-xyz")).toBe(base);
  });
});

describe("pruneHiddenPortfolioRequestFields", () => {
  it("非表示になった入力の残留値を state から落とす", () => {
    const pruned = pruneHiddenPortfolioRequestFields(
      state({
        requestType: "icon",
        requestTypeOther: "残留",
        commissionScope: "bust_up",
        commissionScopeOther: "残留",
        usageTypes: [],
        usageTypeOther: "残留",
        budgetKind: "undecided",
        budgetMin: "1000",
        budgetMax: "2000",
        deadlineKind: "standard",
        deadlineDate: "2026-09-01",
      })
    );
    expect(pruned).toMatchObject({
      requestTypeOther: "",
      commissionScopeOther: "",
      usageTypeOther: "",
      budgetMin: "",
      budgetMax: "",
      deadlineDate: "",
    });
  });
});

describe("reference links", () => {
  it("HTTPS 以外・credentials 付きを client でも弾く", () => {
    const errors = collectPortfolioReferenceLinkErrors([
      { url: "http://example.com/a", label: "" },
      { url: "https://user:pass@example.com/a", label: "" },
    ]);
    expect(errors.map((error) => error.index)).toEqual([0, 1]);
  });

  it("normalize 後に重複する行へ error を出す", () => {
    const errors = collectPortfolioReferenceLinkErrors([
      { url: "https://example.com/a#one", label: "" },
      { url: "https://EXAMPLE.com:443/a#two", label: "" },
    ]);
    expect(errors).toEqual([{ index: 1, message: "1行目と同じURLです。" }]);
  });

  it("/a と /a/ は別 URL として扱う", () => {
    expect(
      collectPortfolioReferenceLinkErrors([
        { url: "https://example.com/a", label: "" },
        { url: "https://example.com/a/", label: "" },
      ])
    ).toEqual([]);
  });

  it("空行を除き、順序を保って送信対象にする", () => {
    expect(
      submittedPortfolioReferenceLinks([
        { url: " https://example.com/1 ", label: " 一つ目 " },
        { url: "   ", label: "空" },
        { url: "https://example.com/2", label: "" },
      ])
    ).toEqual([
      { url: "https://example.com/1", label: "一つ目" },
      { url: "https://example.com/2", label: "" },
    ]);
  });

  it("6件目には件数 error を出す", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/${i}`,
      label: "",
    }));
    const errors = collectPortfolioReferenceLinkErrors(rows);
    expect(errors.some((error) => error.index === NATORI_MAX_REFERENCE_LINKS)).toBe(true);
  });
});

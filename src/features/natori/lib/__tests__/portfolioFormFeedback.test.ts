import { describe, expect, it } from "vitest";
import { portfolioErrorTarget, portfolioRetryAfterSeconds, portfolioValidationMessage } from "../portfolioFormFeedback";
import { applyPortfolioRequestTypeSelection, buildNatoriRequestDataV1, createInitialPortfolioRequestFormState, NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE } from "../portfolioRequestForm";
import { natoriRequestSubmissionV1Schema } from "../requestSchema";

describe("フォームエラーの表示先", () => {
  it("固定金額はmin/max両方のエラーを同じ入力欄へ誘導する", () => {
    const state = { ...createInitialPortfolioRequestFormState(), budgetKind: "fixed" as const };
    for (const field of ["min", "max"]) {
      expect(portfolioErrorTarget(`requestData.budget.${field}`, state, [])).toEqual({ id: "pf-budget-fixed", section: "budget" });
    }
  });
  it("量産の表情指定は閉じた一般詳細へ誘導しない", () => {
    const state = applyPortfolioRequestTypeSelection(createInitialPortfolioRequestFormState(), NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE);
    expect(portfolioErrorTarget("requestData.expressionMood", state, [])).toEqual({ id: "pf-mass-expression", section: "requestType" });
  });
  it("未知のパスはフォームのエラー案内へ誘導する", () => {
    expect(portfolioErrorTarget("unrecognized", createInitialPortfolioRequestFormState(), []).id).toBe("pf-submit-errors");
  });
  it("共通スキーマのメールエラーを日本語で表示する", () => {
    const result = natoriRequestSubmissionV1Schema.safeParse({ clientName: "", clientEmail: "invalid",
      requestData: buildNatoriRequestDataV1({ ...createInitialPortfolioRequestFormState(), message: "相談です" }, []),
    });
    if (result.success) throw new Error("invalid fixture");
    const issue = result.error.issues.find((item) => item.path[0] === "clientEmail");
    if (!issue) throw new Error("missing email issue");
    expect(portfolioValidationMessage(issue)).toContain("メールアドレス");
  });
  it("空欄なだけのときは、形式や文字数の話をしない", () => {
    const issues = (name: string, email: string) => {
      const result = natoriRequestSubmissionV1Schema.safeParse({ clientName: name, clientEmail: email, requestData: buildNatoriRequestDataV1(createInitialPortfolioRequestFormState(), []) });
      if (result.success) throw new Error("invalid fixture");
      return result.error.issues;
    };
    const message = (name: string, email: string, field: string) => {
      const issue = issues(name, email).find((item) => item.path.at(-1) === field);
      if (!issue) throw new Error(`missing ${field} issue`);
      return portfolioValidationMessage(issue, { clientEmail: email });
    };
    expect(message("", "", "clientName")).toBe("お名前をご記入ください。");
    expect(message("", "", "clientEmail")).toBe("メールアドレスをご記入ください。");
    expect(message("", "abc", "clientEmail")).toBe("メールアドレスの形をご確認ください（例：name@example.com）。");
    expect(message("", "", "message")).toBe("ご相談の内容をひとことご記入ください。");
    expect(message("あ".repeat(101), "", "clientName")).toBe("100文字以内で入力してください。");
  });
});

describe("Retry-After", () => {
  it.each([["600", 600], ["0", 0], ["", null], [null, null], ["invalid", null]])("%s", (value, expected) => {
    expect(portfolioRetryAfterSeconds(value)).toBe(expected);
  });
  it("HTTP日付も処理し、過去の日付では待機しない", () => {
    const now = Date.parse("2026-09-13T00:00:00Z");
    expect(portfolioRetryAfterSeconds("Sun, 13 Sep 2026 00:02:00 GMT", now)).toBe(120);
    expect(portfolioRetryAfterSeconds("Sun, 13 Sep 2026 00:00:00 GMT", now + 1000)).toBe(0);
  });
});

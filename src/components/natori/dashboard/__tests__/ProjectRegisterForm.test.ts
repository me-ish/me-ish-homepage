import { describe, expect, it } from "vitest";
import {
  NATORI_REGISTER_STATUS_OPTIONS,
  getDefaultStatusForMode,
} from "@/components/natori/dashboard/ProjectRegisterForm";

describe("getDefaultStatusForMode", () => {
  it("defaults estimate-tool registrations to 見積もり提示済み (quoted)", () => {
    // 見積もりツール内では金額・納期がすでに出ているので「提示済み」想定が自然。
    expect(getDefaultStatusForMode("estimate")).toBe("quoted");
  });

  it("defaults manual registrations to 依頼受付 (inquiry)", () => {
    // 案件管理から直接登録する場合は依頼が来た直後の想定。
    expect(getDefaultStatusForMode("manual")).toBe("inquiry");
  });
});

describe("NATORI_REGISTER_STATUS_OPTIONS", () => {
  const values = NATORI_REGISTER_STATUS_OPTIONS.map((option) => option.value);

  it("exposes the four pre-rough statuses in flow order", () => {
    expect(values).toEqual(["inquiry", "estimating", "quoted", "awaiting_payment"]);
  });

  it("never offers rough or later — those are reached via the dashboard payment flow", () => {
    for (const blocked of [
      "rough",
      "lineart",
      "coloring",
      "waiting",
      "delivery_prep",
      "delivered",
      "completed",
    ]) {
      expect(values).not.toContain(blocked);
    }
  });

  it("pairs each status with a human-readable Japanese label", () => {
    const byValue = Object.fromEntries(
      NATORI_REGISTER_STATUS_OPTIONS.map((option) => [option.value, option.label])
    );
    expect(byValue.inquiry).toBe("依頼受付");
    expect(byValue.estimating).toBe("見積もり中");
    expect(byValue.quoted).toBe("見積もり提示済み");
    expect(byValue.awaiting_payment).toBe("入金待ち");
  });
});

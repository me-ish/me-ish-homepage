import { describe, expect, it } from "vitest";
import {
  NatoriProjectDetailsValidationError,
  normalizeNatoriProjectDetailsPatch,
} from "@/features/natori/data/supabaseProjects";

describe("normalizeNatoriProjectDetailsPatch", () => {
  it("maps the editable fields to their natori_projects column names", () => {
    const patch = normalizeNatoriProjectDetailsPatch({
      clientName: "月乃さん",
      title: "立ち絵",
      type: "standing",
      amount: 18500,
      deliveryPlan: "rush_14_days",
      startDate: "2026-05-24",
      dueDate: "2026-06-07",
      note: "依頼内容メモ",
    });
    expect(patch).toEqual({
      client_name: "月乃さん",
      title: "立ち絵",
      type: "standing",
      amount: 18500,
      delivery_plan: "rush_14_days",
      start_date: "2026-05-24",
      due_date: "2026-06-07",
      note: "依頼内容メモ",
    });
  });

  it("never emits status, next_action, or payment_confirmed_at, even if smuggled in", () => {
    // Cast through unknown so we can simulate a stray caller that tries to
    // sneak status/next_action/payment_confirmed_at into the patch.
    const smuggled = {
      clientName: "月乃さん",
      title: "立ち絵",
      status: "rough",
      nextAction: "勝手に書き換え",
      paymentConfirmedAt: "2026-05-24T00:00:00Z",
    } as unknown as Parameters<typeof normalizeNatoriProjectDetailsPatch>[0];
    const patch = normalizeNatoriProjectDetailsPatch(smuggled);
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("next_action");
    expect(patch).not.toHaveProperty("payment_confirmed_at");
    expect(patch.client_name).toBe("月乃さん");
    expect(patch.title).toBe("立ち絵");
  });

  it("trims whitespace from client name / title", () => {
    const patch = normalizeNatoriProjectDetailsPatch({
      clientName: "  月乃さん  ",
      title: "  立ち絵  ",
    });
    expect(patch.client_name).toBe("月乃さん");
    expect(patch.title).toBe("立ち絵");
  });

  it("rejects empty client name", () => {
    expect(() =>
      normalizeNatoriProjectDetailsPatch({ clientName: "   " })
    ).toThrow(NatoriProjectDetailsValidationError);
  });

  it("rejects empty title", () => {
    expect(() =>
      normalizeNatoriProjectDetailsPatch({ title: "" })
    ).toThrow(NatoriProjectDetailsValidationError);
  });

  it("rejects negative or non-finite amount", () => {
    expect(() => normalizeNatoriProjectDetailsPatch({ amount: -1 })).toThrow(
      NatoriProjectDetailsValidationError
    );
    expect(() => normalizeNatoriProjectDetailsPatch({ amount: NaN })).toThrow(
      NatoriProjectDetailsValidationError
    );
  });

  // P1-07: 金額は 未確定(null) / 無料(0) / 有料(正の安全整数) の3状態を厳密に扱う。
  // 小数の暗黙丸めは、依頼者提示額とのズレを生むため拒否に変更した。
  it("rejects non-integer amounts instead of rounding them", () => {
    expect(() => normalizeNatoriProjectDetailsPatch({ amount: 1234.7 })).toThrow(
      NatoriProjectDetailsValidationError
    );
  });

  it("keeps null as undecided and 0 as free", () => {
    expect(normalizeNatoriProjectDetailsPatch({ amount: null }).amount).toBeNull();
    expect(normalizeNatoriProjectDetailsPatch({ amount: 0 }).amount).toBe(0);
    expect(normalizeNatoriProjectDetailsPatch({ amount: 8000 }).amount).toBe(8000);
  });

  it("rejects negative and unsafe amounts", () => {
    for (const amount of [-1, Number.NaN, Number.MAX_SAFE_INTEGER + 2, Infinity]) {
      expect(() => normalizeNatoriProjectDetailsPatch({ amount })).toThrow(
        NatoriProjectDetailsValidationError
      );
    }
  });

  it("keeps a blank or null due date as undecided", () => {
    expect(normalizeNatoriProjectDetailsPatch({ dueDate: null }).due_date).toBeNull();
    expect(normalizeNatoriProjectDetailsPatch({ dueDate: "" }).due_date).toBeNull();
    expect(normalizeNatoriProjectDetailsPatch({ dueDate: "2026-09-01" }).due_date).toBe(
      "2026-09-01"
    );
    expect(() => normalizeNatoriProjectDetailsPatch({ dueDate: "2026-02-30" })).toThrow(
      NatoriProjectDetailsValidationError
    );
  });

  it("accepts a blank start date and stores it as null", () => {
    const blank = normalizeNatoriProjectDetailsPatch({ startDate: "" });
    expect(blank.start_date).toBeNull();
    const nulled = normalizeNatoriProjectDetailsPatch({ startDate: null });
    expect(nulled.start_date).toBeNull();
  });

  it("rejects malformed due date", () => {
    expect(() =>
      normalizeNatoriProjectDetailsPatch({ dueDate: "2026-13-99" })
    ).toThrow(NatoriProjectDetailsValidationError);
    expect(() =>
      normalizeNatoriProjectDetailsPatch({ dueDate: "not a date" })
    ).toThrow(NatoriProjectDetailsValidationError);
  });

  it("rejects an unknown project type", () => {
    expect(() =>
      // @ts-expect-error — intentionally invalid
      normalizeNatoriProjectDetailsPatch({ type: "comic" })
    ).toThrow(NatoriProjectDetailsValidationError);
  });

  it("rejects an unknown delivery plan", () => {
    expect(() =>
      // @ts-expect-error — intentionally invalid
      normalizeNatoriProjectDetailsPatch({ deliveryPlan: "rush_1_day" })
    ).toThrow(NatoriProjectDetailsValidationError);
  });

  it("treats an all-whitespace note as null (clears the column)", () => {
    const patch = normalizeNatoriProjectDetailsPatch({ note: "   \n  " });
    expect(patch.note).toBeNull();
  });

  it("returns a sparse patch — fields the caller did not pass are omitted", () => {
    const patch = normalizeNatoriProjectDetailsPatch({ title: "新タイトル" });
    expect(patch).toEqual({ title: "新タイトル" });
  });
});

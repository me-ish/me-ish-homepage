import { describe, expect, it } from "vitest";
import {
  NatoriProjectDetailsValidationError,
  normalizeNatoriProjectDetailsPatch,
} from "@/lib/natori/supabaseProjects";

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

  it("rounds non-integer amounts and clamps the type to number", () => {
    const patch = normalizeNatoriProjectDetailsPatch({ amount: 1234.7 });
    expect(patch.amount).toBe(1235);
    expect(typeof patch.amount).toBe("number");
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

import { describe, expect, it } from "vitest";
import { buildTalkMenu, type TalkMenuInput } from "../talkMenu";

const base: TalkMenuInput = { status: "inquiry", paymentConfirmedAt: undefined, hasEstimateLink: true, readOnly: false };
const item = (input: Partial<TalkMenuInput>, key: "estimate" | "payment" | "delivery") =>
  buildTalkMenu({ ...base, ...input }).items.find(i => i.key === key)!;

describe("staff talk menu", () => {
  it("recommends the quote first, and allows only the quote before one exists", () => {
    const menu = buildTalkMenu(base);
    expect(menu.recommended).toBe("estimate");
    expect(menu.tip).toContain("参考ラフを送ってもOK");
    expect(item({}, "estimate")).toMatchObject({ label: "見積もりを作る", reason: null });
    expect(item({}, "payment").reason).toBe("見積もりの承認後に送れます。");
    expect(item({}, "delivery").reason).toBe("お支払いの確認後に送れます。");
  });

  it("treats the legacy consulting status like an inquiry", () => {
    expect(buildTalkMenu({ ...base, status: "consulting" }).recommended).toBe("estimate");
    expect(item({ status: "estimating" }, "payment").reason).toBe("見積もりの承認後に送れます。");
  });

  it("after the quote is sent, offers a re-send and the payment link with the approval caveat", () => {
    expect(item({ status: "quoted" }, "estimate")).toMatchObject({ label: "見積りを開く・再送", reason: null });
    expect(item({ status: "quoted" }, "payment")).toMatchObject({ label: "支払いリンクを送る", reason: null, hint: "依頼者が見積もりを承認する前は送信できません。" });
    expect(buildTalkMenu({ ...base, status: "quoted" }).recommended).toBeNull();
  });

  it("recommends the payment link while waiting for payment and offers a re-send", () => {
    const menu = buildTalkMenu({ ...base, status: "awaiting_payment" });
    expect(menu.recommended).toBe("payment");
    expect(item({ status: "awaiting_payment" }, "payment").label).toBe("支払いリンクを再送");
    expect(item({ status: "awaiting_payment" }, "estimate").reason).toBe("見積もりはすでに承認されています。");
  });

  it("opens delivery only after payment is confirmed", () => {
    const paid = { status: "rough" as const, paymentConfirmedAt: "2026-10-12T00:00:00Z" };
    expect(item(paid, "delivery")).toMatchObject({ label: "納品する", reason: null });
    expect(item(paid, "payment").reason).toBe("お支払いは確認済みです。");
    expect(buildTalkMenu({ ...base, ...paid, status: "delivery_prep" }).recommended).toBe("delivery");
    expect(item({ ...paid, status: "delivered" }, "delivery").label).toBe("納品を確認・再送");
    expect(item({ status: "rough" }, "delivery").reason).toBe("お支払いの確認後に送れます。");
  });

  it("locks everything for a closed or archived project", () => {
    const menu = buildTalkMenu({ ...base, status: "closed", readOnly: true });
    expect(menu.recommended).toBeNull();
    expect(menu.items.map(i => i.reason)).toEqual(Array(3).fill("終了した案件のため、操作できません。"));
  });

  it("explains a missing estimate link (demo)", () => {
    expect(item({ hasEstimateLink: false }, "estimate").reason).toContain("デモ");
  });
});

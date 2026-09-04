// ステータス遷移表のテスト。許可 / 不許可のマトリクスを固定する。
// ここが natori の全ステータス書き込み経路（projectsService / orderMailService /
// Stripe webhook）の唯一のルールなので、変更時はこのマトリクスを先に直すこと。
import { describe, expect, it } from "vitest";
import {
  assertNatoriStatusTransition,
  canTransitionNatoriStatus,
} from "@/features/natori/lib/statusTransitions";
import type { NatoriProjectStatus } from "@/features/natori/types/projects";

const PREWORK: NatoriProjectStatus[] = ["inquiry", "estimating", "quoted", "awaiting_payment"];
const WORK: NatoriProjectStatus[] = [
  "rough",
  "lineart",
  "coloring",
  "waiting",
  "delivery_prep",
  "delivered",
  "completed",
];

describe("canTransitionNatoriStatus (manual)", () => {
  it("受注前は前進のみ許可、逆行は弾く", () => {
    expect(canTransitionNatoriStatus("inquiry", "estimating")).toBe(true);
    expect(canTransitionNatoriStatus("inquiry", "quoted")).toBe(true);
    expect(canTransitionNatoriStatus("estimating", "awaiting_payment")).toBe(true);
    expect(canTransitionNatoriStatus("quoted", "awaiting_payment")).toBe(true);

    expect(canTransitionNatoriStatus("quoted", "inquiry")).toBe(false);
    expect(canTransitionNatoriStatus("awaiting_payment", "quoted")).toBe(false);
    expect(canTransitionNatoriStatus("estimating", "inquiry")).toBe(false);
  });

  it("legacy の consulting は inquiry と同じ扱い", () => {
    expect(canTransitionNatoriStatus("consulting", "quoted")).toBe(true);
    expect(canTransitionNatoriStatus("consulting", "inquiry")).toBe(true); // 同一扱い = no-op
    expect(canTransitionNatoriStatus("quoted", "consulting")).toBe(false); // 逆行
  });

  it("受注前 → 制作工程はどこへでも入れる（タスク駆動の開始・飛び越し）", () => {
    for (const from of PREWORK) {
      for (const to of WORK) {
        expect(canTransitionNatoriStatus(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
  });

  it("制作工程どうしは双方向可（タスクのチェック / 解除で前後する）", () => {
    expect(canTransitionNatoriStatus("rough", "lineart")).toBe(true);
    expect(canTransitionNatoriStatus("lineart", "rough")).toBe(true);
    expect(canTransitionNatoriStatus("rough", "completed")).toBe(true);
    expect(canTransitionNatoriStatus("completed", "rough")).toBe(true);
    expect(canTransitionNatoriStatus("delivered", "coloring")).toBe(true);
  });

  it("制作工程 → 受注前の逆行は全て弾く", () => {
    for (const from of WORK) {
      for (const to of PREWORK) {
        expect(canTransitionNatoriStatus(from, to), `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("見送り（closed）へは受注前からのみ、出口は inquiry（再開）のみ", () => {
    for (const from of PREWORK) {
      expect(canTransitionNatoriStatus(from, "closed"), `${from} -> closed`).toBe(true);
    }
    for (const from of WORK) {
      expect(canTransitionNatoriStatus(from, "closed"), `${from} -> closed`).toBe(false);
    }
    expect(canTransitionNatoriStatus("closed", "inquiry")).toBe(true);
    expect(canTransitionNatoriStatus("closed", "quoted")).toBe(false);
    expect(canTransitionNatoriStatus("closed", "rough")).toBe(false);
    expect(canTransitionNatoriStatus("closed", "completed")).toBe(false);
  });

  it("同一ステータスへの更新は常に no-op として許可", () => {
    for (const status of [...PREWORK, ...WORK, "closed" as const]) {
      expect(canTransitionNatoriStatus(status, status), `${status} -> ${status}`).toBe(true);
    }
  });
});

describe("canTransitionNatoriStatus (payment-confirmed)", () => {
  it("入金確認は受注前のどこからでも rough へ進める（webhook/手動の競合許容）", () => {
    for (const from of [...PREWORK, "consulting" as const]) {
      expect(
        canTransitionNatoriStatus(from, "rough", "payment-confirmed"),
        `${from} -> rough`
      ).toBe(true);
    }
  });

  it("入金確認でも制作中・完了・見送りの案件は rough に巻き戻さない", () => {
    for (const from of ["lineart", "coloring", "delivered", "completed", "closed"] as const) {
      expect(
        canTransitionNatoriStatus(from, "rough", "payment-confirmed"),
        `${from} -> rough`
      ).toBe(false);
    }
  });

  it("入金確認で rough 以外へは進めない", () => {
    expect(canTransitionNatoriStatus("awaiting_payment", "lineart", "payment-confirmed")).toBe(false);
    expect(canTransitionNatoriStatus("awaiting_payment", "completed", "payment-confirmed")).toBe(false);
  });
});

describe("assertNatoriStatusTransition", () => {
  it("許可された遷移は throw しない / 不許可は throw する", () => {
    expect(() => assertNatoriStatusTransition("inquiry", "quoted")).not.toThrow();
    expect(() => assertNatoriStatusTransition("rough", "inquiry")).toThrow(
      /invalid natori status transition/
    );
  });
});

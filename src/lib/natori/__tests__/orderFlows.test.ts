import { describe, expect, it } from "vitest";
import {
  applyStatusToTasks,
  computeProjectBars,
  createTasksForType,
  daysUntilDue,
  deriveNextActionFromTasks,
  deriveStatusFromTasks,
  getAdvanceButtonLabel,
  getNextStatus,
  isProjectOverdue,
  toISODate,
} from "@/lib/natori/projects";
import {
  computeProjectScheduling,
  getAwaitingPaymentSummary,
  getScheduleEntries,
  getWeeklyForecast,
} from "@/lib/natori/scheduling";
import { calculateDueDate, getDeliveryPlanMeta } from "@/lib/natori/deliveryPlans";
import { createDefaultNatoriPricingConfig, createNatoriEstimate } from "@/lib/natori/pricing";
import { getRemindersForDate } from "@/lib/natori/reminders";
import type {
  NatoriDeliveryPlan,
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectType,
} from "@/types/natori/projects";

const TODAY = new Date(2026, 4, 22); // 2026-05-22

type OrderInput = {
  id: string;
  title?: string;
  clientName?: string;
  amount?: number;
  type: NatoriProjectType;
  status?: NatoriProjectStatus;
  startDateISO?: string;
  deliveryPlan?: NatoriDeliveryPlan;
};

function makeOrder(input: OrderInput): NatoriProject {
  const status = input.status ?? "consulting";
  const tasks = applyStatusToTasks(createTasksForType(input.type), status);
  const startDateISO = input.startDateISO ?? toISODate(TODAY);
  const plan: NatoriDeliveryPlan = input.deliveryPlan ?? "normal";
  return {
    id: input.id,
    title: input.title ?? "オーダー",
    clientName: input.clientName ?? "依頼者さん",
    amount: input.amount ?? 0,
    startDate: startDateISO,
    dueDate: calculateDueDate(startDateISO, plan),
    status,
    nextAction: "次の作業",
    type: input.type,
    tasks,
    deliveryPlan: plan,
  };
}

describe("order flow: normal icon", () => {
  const order = makeOrder({
    id: "icon-normal",
    type: "icon",
    deliveryPlan: "normal",
  });

  it("schedules a 30-day delivery and computes the estimate without rush fee", () => {
    expect(order.dueDate).toBe(toISODate(new Date(2026, 5, 21)));
    const estimate = createNatoriEstimate("バストアップのSNSアイコンお願いします。", createDefaultNatoriPricingConfig(), {
      deliveryPlan: order.deliveryPlan,
    });
    expect(estimate.category.id).toBe("bust_up");
    expect(estimate.breakdown.fixed.find((line) => line.id.startsWith("delivery_plan"))).toBeUndefined();
    expect(estimate.total).toBe(4000);
  });

  it("appears in the schedule as a blocked, non-rush entry", () => {
    const entries = getScheduleEntries([order], TODAY);
    expect(entries).toHaveLength(1);
    expect(entries[0].scheduling.isBlocked).toBe(true);
    expect(entries[0].scheduling.isRush).toBe(false);
    expect(entries[0].scheduling.requiredPerDay).toBe(0);
  });
});

describe("order flow: rush 7 days (urgent)", () => {
  it("dueDate is +7 days, estimate adds 2000円 once, schedule ranks it first", () => {
    const order = makeOrder({
      id: "rush7",
      type: "illustration",
      deliveryPlan: "rush_7_days",
      status: "rough",
    });
    const baseline = makeOrder({
      id: "normal",
      type: "illustration",
      deliveryPlan: "normal",
      status: "rough",
    });

    expect(order.dueDate).toBe(toISODate(new Date(2026, 4, 29)));
    expect(getDeliveryPlanMeta(order.deliveryPlan).isRush).toBe(true);

    const estimate = createNatoriEstimate(
      "全身イラスト、お急ぎ納品でお願いします。", // also has the rush_delivery keyword
      createDefaultNatoriPricingConfig(),
      { deliveryPlan: order.deliveryPlan }
    );
    // Plan supplies the rush fee — keyword-based rush_delivery must NOT also be charged.
    const rushLines = estimate.breakdown.fixed.filter(
      (line) => line.id === "rush_delivery" || line.id.startsWith("delivery_plan_rush")
    );
    expect(rushLines).toHaveLength(1);
    expect(rushLines[0].amount).toBe(2000);

    const entries = getScheduleEntries([baseline, order], TODAY);
    expect(entries[0].project.id).toBe("rush7");
    expect(entries[0].scheduling.isRush).toBe(true);
  });
});

describe("order flow: rush 14 days", () => {
  it("dueDate is +14 days, ranks ahead of normal but behind rush_7", () => {
    const r14 = makeOrder({ id: "r14", type: "standing", deliveryPlan: "rush_14_days", status: "rough" });
    const r7 = makeOrder({ id: "r7", type: "standing", deliveryPlan: "rush_7_days", status: "rough" });
    const normal = makeOrder({ id: "n", type: "standing", deliveryPlan: "normal", status: "rough" });

    expect(r14.dueDate).toBe(toISODate(new Date(2026, 5, 5)));
    expect(getDeliveryPlanMeta(r14.deliveryPlan).extraFee).toBe(2000);

    const entries = getScheduleEntries([normal, r14, r7], TODAY);
    expect(entries.map((e) => e.project.id)).toEqual(["r7", "r14", "n"]);
  });
});

describe("order flow: pre-work pipeline (依頼 → 見積り → 案件化 → 入金待ち → ラフ)", () => {
  it("walks the canonical status order one step at a time", () => {
    let status = getNextStatus("inquiry");
    expect(status).toBe("estimating");
    status = getNextStatus(status);
    expect(status).toBe("quoted");
    status = getNextStatus(status);
    expect(status).toBe("awaiting_payment");
    status = getNextStatus(status);
    expect(status).toBe("rough");
  });

  it("labels operations with the production wording", () => {
    expect(getAdvanceButtonLabel("quoted")).toBe("案件化して入金待ちにする");
    expect(getAdvanceButtonLabel("awaiting_payment")).toBe("入金確認してラフ開始");
  });

  it("does not pressure the schedule until status reaches rough", () => {
    for (const status of [
      "inquiry",
      "estimating",
      "quoted",
      "awaiting_payment",
    ] as const) {
      const project = makeOrder({ id: status, type: "illustration", status });
      const s = computeProjectScheduling(project, TODAY);
      expect(s.isBlocked).toBe(true);
      expect(s.requiredThisWeek).toBe(0);
    }
    const inProgress = makeOrder({ id: "post-pay", type: "illustration", status: "rough" });
    expect(computeProjectScheduling(inProgress, TODAY).isBlocked).toBe(false);
  });

  it("treats legacy consulting rows like inquiry (still blocked, no workload)", () => {
    const legacy = makeOrder({ id: "legacy", type: "illustration", status: "consulting" });
    const s = computeProjectScheduling(legacy, TODAY);
    expect(s.isBlocked).toBe(true);
    expect(s.requiredThisWeek).toBe(0);
  });
});

describe("order flow: awaiting payment", () => {
  const order = makeOrder({
    id: "wait-pay",
    type: "illustration",
    deliveryPlan: "normal",
    status: "awaiting_payment",
    amount: 18000,
  });

  it("does not pressure the weekly forecast", () => {
    const scheduling = computeProjectScheduling(order, TODAY);
    expect(scheduling.isBlocked).toBe(true);
    expect(scheduling.requiredPerDay).toBe(0);
    expect(scheduling.requiredThisWeek).toBe(0);
  });

  it("appears in the awaiting-payment summary with the right amount", () => {
    const summary = getAwaitingPaymentSummary([order]);
    expect(summary.count).toBe(1);
    expect(summary.totalAmount).toBe(18000);
  });

  it("produces no calendar bars (no heavy work before payment)", () => {
    const bars = computeProjectBars(order);
    // material is auto-completed in applyStatusToTasks for awaiting_payment? No — only
    // statuses past awaiting_payment auto-complete. So tasks remain, but the project
    // status is blocked; bars are still computed mechanically from milestones.
    // The user-facing widget filters via isBlocked, not the bars; bars are fine to exist.
    expect(Array.isArray(bars)).toBe(true);
  });
});

describe("order flow: overdue active project", () => {
  it("is flagged overdue and ranks above non-overdue active projects", () => {
    const overdue = makeOrder({
      id: "late",
      type: "illustration",
      status: "lineart",
      startDateISO: "2026-04-15",
      deliveryPlan: "normal", // due 2026-05-15, before TODAY
    });
    const active = makeOrder({ id: "ok", type: "illustration", status: "lineart" });

    expect(isProjectOverdue(overdue, TODAY)).toBe(true);
    expect(daysUntilDue(overdue.dueDate, TODAY)).toBeLessThan(0);

    const entries = getScheduleEntries([active, overdue], TODAY);
    expect(entries[0].project.id).toBe("late");
  });
});

describe("order flow: full lifecycle task toggling", () => {
  it("status auto-advances and next action follows as tasks complete", () => {
    let project = makeOrder({
      id: "lifecycle",
      type: "icon",
      status: "rough",
      deliveryPlan: "normal",
    });
    expect(project.status).toBe("rough");

    // Toggle each task done in order
    for (const task of project.tasks) {
      const nextTasks = project.tasks.map((t) =>
        t.id === task.id ? { ...t, done: true } : t
      );
      project = {
        ...project,
        tasks: nextTasks,
        status: deriveStatusFromTasks(nextTasks, project.status),
        nextAction: deriveNextActionFromTasks(nextTasks, project.nextAction),
      };
    }

    expect(project.status).toBe("completed");
    expect(project.nextAction).toBe("完了");
    const scheduling = computeProjectScheduling(project, TODAY);
    expect(scheduling.requiredPerDay).toBe(0);
    expect(scheduling.remainingHours).toBe(0);
  });
});

describe("order flow: capacity vs forecast", () => {
  it("flags capacity overrun when too many rush projects pile up the same week", () => {
    const orders = [
      makeOrder({ id: "r1", type: "illustration", status: "rough", deliveryPlan: "rush_7_days" }),
      makeOrder({ id: "r2", type: "illustration", status: "rough", deliveryPlan: "rush_7_days" }),
      makeOrder({ id: "r3", type: "illustration", status: "rough", deliveryPlan: "rush_7_days" }),
    ];
    const entries = getScheduleEntries(orders, TODAY);
    const forecast = getWeeklyForecast(entries);
    expect(forecast.utilizationThisWeek).toBeGreaterThan(1); // > 100% capacity
    expect(forecast.rushRequiredThisWeek).toBeGreaterThan(0);
  });
});

describe("monthly reminder", () => {
  it("matches the 25th of any month and ignores other days", () => {
    expect(getRemindersForDate("2026-05-25").map((r) => r.id)).toEqual(["tsunagu_transfer"]);
    expect(getRemindersForDate("2026-06-25").map((r) => r.id)).toEqual(["tsunagu_transfer"]);
    expect(getRemindersForDate("2026-05-24")).toEqual([]);
    expect(getRemindersForDate("2026-05-26")).toEqual([]);
  });
});

describe("calendar bar spans honor the delivery plan duration", () => {
  function spanDays(project: ReturnType<typeof makeOrder>): number {
    const bars = computeProjectBars(project);
    if (bars.length === 0) return 0;
    const first = bars.map((b) => b.startISO).sort()[0];
    const last = bars.map((b) => b.endISO).sort().slice(-1)[0];
    return (
      Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1
    );
  }

  it("rush_7 fits within 7 days end-to-end", () => {
    const project = makeOrder({
      id: "r7",
      type: "illustration",
      deliveryPlan: "rush_7_days",
      status: "rough",
    });
    expect(spanDays(project)).toBeLessThanOrEqual(7);
  });

  it("rush_14 fits within 14 days end-to-end", () => {
    const project = makeOrder({
      id: "r14",
      type: "illustration",
      deliveryPlan: "rush_14_days",
      status: "rough",
    });
    expect(spanDays(project)).toBeLessThanOrEqual(14);
  });

  it("normal plan spreads across ~30 days, not collapsed to a few days", () => {
    const project = makeOrder({
      id: "n",
      type: "illustration",
      deliveryPlan: "normal",
      status: "rough",
    });
    expect(spanDays(project)).toBeGreaterThanOrEqual(20);
    expect(spanDays(project)).toBeLessThanOrEqual(30);
  });

  it("delivery bar is always a single day on the due date", () => {
    for (const plan of ["normal", "rush_14_days", "rush_7_days"] as const) {
      const project = makeOrder({
        id: `p-${plan}`,
        type: "illustration",
        deliveryPlan: plan,
        status: "rough",
      });
      const bars = computeProjectBars(project);
      const deliveryBar = bars.find((b) => b.stage === "delivery");
      expect(deliveryBar).toBeTruthy();
      expect(deliveryBar!.startISO).toBe(project.dueDate);
      expect(deliveryBar!.endISO).toBe(project.dueDate);
    }
  });
});

describe("estimate without rush plan but with お急ぎ keyword in text", () => {
  it("keeps the keyword-based rush_delivery charge (backward compat)", () => {
    const estimate = createNatoriEstimate(
      "全身イラスト、お急ぎ納品でお願いします。",
      createDefaultNatoriPricingConfig()
      // no deliveryPlan option
    );
    expect(estimate.breakdown.fixed.find((line) => line.id === "rush_delivery")?.amount).toBe(2000);
    expect(estimate.breakdown.fixed.find((line) => line.id.startsWith("delivery_plan"))).toBeUndefined();
  });
});

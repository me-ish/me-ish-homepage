import type {
  NatoriConcreteProjectType,
  NatoriProject,
} from "@/features/natori/types/projects";
import {
  isActiveNatoriProject,
  isNatoriConcreteProjectType,
  NATORI_PROJECT_TYPE_LABELS,
} from "@/features/natori/lib/projectReadModel";

/**
 * 実績ページ用の集計ロジック。「納品済み」「対応完了」の案件を実績として
 * 数える。売上は入金記録があり、かつ対応完了した案件だけを対象にする。
 * 時期は completedAt（未設定時は paidAt / paymentConfirmedAt）を使う。
 */

export type NatoriMonthlyResult = {
  /** "2026-05" 形式 */
  ym: string;
  /** "2026年5月" 形式 */
  label: string;
  count: number;
  amount: number;
  refundedAmount: number | null;
  netAmount: number | null;
};

export type NatoriTypeResult = {
  type: NatoriConcreteProjectType;
  count: number;
  amount: number;
  refundedAmount: number | null;
  netAmount: number | null;
};

export type NatoriResultsSummary = {
  totalCount: number;
  totalAmount: number;
  totalRefundedAmount: number | null;
  totalNetAmount: number | null;
  refundPendingCount: number;
  refundReviewCount: number;
  /** 金額未定の実績件数。0円案件とは区別する。 */
  undecidedAmountCount: number;
  /** 実績0件のときは 0 */
  averageAmount: number;
  thisYearCount: number;
  thisYearAmount: number;
  thisYearRefundedAmount: number | null;
  thisYearNetAmount: number | null;
  /** 新しい月が先頭。実績のある月のみ */
  monthly: NatoriMonthlyResult[];
  /** 金額の大きい順。実績のあるタイプのみ */
  byType: NatoriTypeResult[];
  /** 納期の新しい順 */
  completed: NatoriProject[];
};

export function isNatoriCompletedProject(project: NatoriProject): boolean {
  return (
    project.status === "completed" &&
    isActiveNatoriProject(project) &&
    Boolean(project.paidAt ?? project.paymentConfirmedAt)
  );
}

export function getNatoriResultDateISO(project: NatoriProject): string {
  const value =
    project.completedAt ??
    project.paidAt ??
    project.paymentConfirmedAt ??
    project.dueDate ??
    project.createdAt;
  return value?.slice(0, 10) ?? "";
}

export function getNatoriResultAmount(project: NatoriProject): number | null {
  return project.paidAmount ?? project.amount;
}

/** Original gross remains immutable. Unavailable enabled ledger never masquerades as zero. */
export function getNatoriResultFinancials(project: NatoriProject): {
  gross: number | null; refunded: number | null; net: number | null;
  state: "none" | "partial" | "full" | "unavailable" | "unverified"; pendingCount: number; reviewCount: number;
} {
  const gross = getNatoriResultAmount(project);
  const refunded = project.refunds?.confirmedAmount ?? null;
  return { gross, refunded, net: gross === null || refunded === null ? null : gross - refunded,
    state: refunded === null ? (project.refunds ? "unverified" : "unavailable") : refunded === 0 ? "none" : gross !== null && refunded === gross ? "full" : "partial",
    pendingCount: project.refunds?.pendingCount ?? 0, reviewCount: project.refunds?.reviewCount ?? 0 };
}

export function getNatoriRefundStatusText(project: NatoriProject): string {
  const value = getNatoriResultFinancials(project);
  const status = value.gross === null && value.refunded !== null && value.refunded > 0
    ? "確定返金あり（元の入金額は未確認）" : value.state === "unavailable" ? "返金記録未取得" : value.state === "unverified" ? "過去の返金履歴未確認" : value.state === "full" ? "全額返金" : value.state === "partial" ? "一部返金" : "確定返金なし";
  return [status, ...(value.pendingCount ? [`返金処理中 ${value.pendingCount}件`] : []),
    ...(value.reviewCount ? [`返金要確認 ${value.reviewCount}件`] : [])].join(" / ");
}

function summarizeFinancials(projects: NatoriProject[]): { refunded: number | null; net: number | null } {
  if (projects.some(project => project.refunds?.confirmedAmount == null)) return { refunded: null, net: null };
  let refunded = 0;
  let net: number | null = 0;
  for (const project of projects) {
    const value = getNatoriResultFinancials(project);
    refunded += value.refunded ?? 0;
    // Confirmed refunds remain known; an unknown original makes the full net unknown.
    net = net === null || value.net === null ? null : net + value.net;
  }
  return { refunded, net };
}

/* ------------------------------------------------------------------
   CSV 出力（確定申告・売上管理用）
------------------------------------------------------------------- */

const CSV_STATUS_LABELS: Record<string, string> = {
  delivered: "納品済み",
  completed: "対応完了",
};

/** カンマ・引用符・改行を含むセルを Excel 互換にエスケープする */
function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * 実績一覧の CSV を組み立てる（納期の新しい順）。
 * 先頭に BOM を付けて Excel で文字化けしないようにする。
 * 対象は呼び出し側が絞り込んだ一覧（画面に表示中の実績と同じもの）。
 */
export function buildNatoriResultsCsv(projects: NatoriProject[]): string {
  const header = ["完了日", "依頼者", "件名", "種類", "入金額(円)", "ステータス", "確定返金額(円)", "純入金額(円)", "返金状況（未確定・要確認は返金額に含まない）"];
  const rows = projects
    .filter(isNatoriCompletedProject)
    .sort((a, b) => getNatoriResultDateISO(b).localeCompare(getNatoriResultDateISO(a)))
    .map((project) =>
      [
        getNatoriResultDateISO(project),
        project.clientName,
        project.title,
        NATORI_PROJECT_TYPE_LABELS[project.type],
        getNatoriResultAmount(project) ?? "未定",
        CSV_STATUS_LABELS[project.status] ?? project.status,
        getNatoriResultFinancials(project).refunded ?? "",
        getNatoriResultFinancials(project).net ?? "",
        getNatoriRefundStatusText(project),
      ]
        .map(csvCell)
        .join(",")
    );
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";
}

/** 実績（完了案件）が存在する年の一覧。新しい年が先頭 */
export function listNatoriResultYears(projects: NatoriProject[]): number[] {
  const years = new Set<number>();
  for (const project of projects) {
    if (!isNatoriCompletedProject(project)) continue;
    const year = Number(getNatoriResultDateISO(project).slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** 年で実績を絞り込む（year が null なら全期間） */
export function filterProjectsByYear(
  projects: NatoriProject[],
  year: number | null
): NatoriProject[] {
  const completed = projects.filter(isNatoriCompletedProject);
  if (year === null) return completed;
  const prefix = `${year}-`;
  return completed.filter((project) => getNatoriResultDateISO(project).startsWith(prefix));
}

/** 年月（"2026-05" 形式）で実績を絞り込む（ym が null なら全期間） */
export function filterProjectsByMonth(
  projects: NatoriProject[],
  ym: string | null
): NatoriProject[] {
  const completed = projects.filter(isNatoriCompletedProject);
  if (ym === null) return completed;
  return completed.filter((project) => getNatoriResultDateISO(project).startsWith(ym));
}

/** 案件タイプで実績を絞り込む（type が null なら絞り込まない） */
export function filterProjectsByType(
  projects: NatoriProject[],
  type: NatoriConcreteProjectType | null
): NatoriProject[] {
  if (type === null) return projects;
  return projects.filter((project) => project.type === type);
}

function toMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const monthNumber = Number(month);
  if (!year || !Number.isFinite(monthNumber)) return ym;
  return `${year}年${monthNumber}月`;
}

export function summarizeNatoriResults(
  projects: NatoriProject[],
  now: Date
): NatoriResultsSummary {
  const completed = projects
    .filter(isNatoriCompletedProject)
    .slice()
    .sort((a, b) =>
      getNatoriResultDateISO(b).localeCompare(getNatoriResultDateISO(a))
    );

  const totalCount = completed.length;
  const knownAmounts = completed
    .map(getNatoriResultAmount)
    .filter((amount): amount is number => amount !== null);
  const totalAmount = completed.reduce(
    (sum, project) => {
      const amount = getNatoriResultAmount(project);
      return amount === null ? sum : sum + amount;
    },
    0
  );
  const undecidedAmountCount = totalCount - knownAmounts.length;
  const averageAmount =
    knownAmounts.length > 0 ? Math.round(totalAmount / knownAmounts.length) : 0;

  const thisYearPrefix = `${now.getFullYear()}-`;
  const thisYear = completed.filter((project) =>
    getNatoriResultDateISO(project).startsWith(thisYearPrefix)
  );
  const thisYearCount = thisYear.length;
  const thisYearAmount = thisYear.reduce(
    (sum, project) => {
      const amount = getNatoriResultAmount(project);
      return amount === null ? sum : sum + amount;
    },
    0
  );

  const monthlyMap = new Map<string, NatoriMonthlyResult>();
  for (const project of completed) {
    const ym = getNatoriResultDateISO(project).slice(0, 7);
    const entry = monthlyMap.get(ym) ?? {
      ym,
      label: toMonthLabel(ym),
      count: 0,
      amount: 0,
      refundedAmount: 0,
      netAmount: 0,
    };
    entry.count += 1;
    const amount = getNatoriResultAmount(project);
    if (amount !== null) entry.amount += amount;
    const financials = getNatoriResultFinancials(project);
    entry.refundedAmount = entry.refundedAmount === null || financials.refunded === null ? null : entry.refundedAmount + financials.refunded;
    entry.netAmount = entry.netAmount === null || financials.net === null ? null : entry.netAmount + financials.net;
    monthlyMap.set(ym, entry);
  }
  const monthly = Array.from(monthlyMap.values()).sort((a, b) =>
    a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : 0
  );

  const typeMap = new Map<NatoriConcreteProjectType, NatoriTypeResult>();
  for (const project of completed) {
    if (!isNatoriConcreteProjectType(project.type)) continue;
    const entry = typeMap.get(project.type) ?? {
      type: project.type,
      count: 0,
      amount: 0,
      refundedAmount: 0,
      netAmount: 0,
    };
    entry.count += 1;
    const amount = getNatoriResultAmount(project);
    if (amount !== null) entry.amount += amount;
    const financials = getNatoriResultFinancials(project);
    entry.refundedAmount = entry.refundedAmount === null || financials.refunded === null ? null : entry.refundedAmount + financials.refunded;
    entry.netAmount = entry.netAmount === null || financials.net === null ? null : entry.netAmount + financials.net;
    typeMap.set(project.type, entry);
  }
  const byType = Array.from(typeMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    totalCount,
    totalAmount,
    totalRefundedAmount: summarizeFinancials(completed).refunded,
    totalNetAmount: summarizeFinancials(completed).net,
    refundPendingCount: completed.reduce((sum, project) => sum + (project.refunds?.pendingCount ?? 0), 0),
    refundReviewCount: completed.reduce((sum, project) => sum + (project.refunds?.reviewCount ?? 0), 0),
    undecidedAmountCount,
    averageAmount,
    thisYearCount,
    thisYearAmount,
    thisYearRefundedAmount: summarizeFinancials(thisYear).refunded,
    thisYearNetAmount: summarizeFinancials(thisYear).net,
    monthly,
    byType,
    completed,
  };
}

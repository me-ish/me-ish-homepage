import type {
  NatoriProject,
  NatoriProjectType,
} from "@/features/natori/types/projects";

/**
 * 実績ページ用の集計ロジック。「納品済み」「対応完了」の案件を実績として
 * 数える。時期のグルーピングは納期（dueDate）ベース（完了日時のカラムが
 * 無いため、納期を完了時期の近似として使う）。
 */

export type NatoriMonthlyResult = {
  /** "2026-05" 形式 */
  ym: string;
  /** "2026年5月" 形式 */
  label: string;
  count: number;
  amount: number;
};

export type NatoriTypeResult = {
  type: NatoriProjectType;
  count: number;
  amount: number;
};

export type NatoriResultsSummary = {
  totalCount: number;
  totalAmount: number;
  /** 実績0件のときは 0 */
  averageAmount: number;
  thisYearCount: number;
  thisYearAmount: number;
  /** 新しい月が先頭。実績のある月のみ */
  monthly: NatoriMonthlyResult[];
  /** 金額の大きい順。実績のあるタイプのみ */
  byType: NatoriTypeResult[];
  /** 納期の新しい順 */
  completed: NatoriProject[];
};

const COMPLETED_STATUSES: ReadonlySet<string> = new Set(["delivered", "completed"]);

export function isNatoriCompletedProject(project: NatoriProject): boolean {
  return COMPLETED_STATUSES.has(project.status);
}

/** 実績（完了案件）が存在する年の一覧。新しい年が先頭 */
export function listNatoriResultYears(projects: NatoriProject[]): number[] {
  const years = new Set<number>();
  for (const project of projects) {
    if (!isNatoriCompletedProject(project)) continue;
    const year = Number(project.dueDate.slice(0, 4));
    if (Number.isFinite(year)) years.add(year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** 年で実績を絞り込む（year が null なら全期間） */
export function filterProjectsByYear(
  projects: NatoriProject[],
  year: number | null
): NatoriProject[] {
  if (year === null) return projects;
  const prefix = `${year}-`;
  return projects.filter((project) => project.dueDate.startsWith(prefix));
}

/** 年月（"2026-05" 形式）で実績を絞り込む（ym が null なら全期間） */
export function filterProjectsByMonth(
  projects: NatoriProject[],
  ym: string | null
): NatoriProject[] {
  if (ym === null) return projects;
  return projects.filter((project) => project.dueDate.startsWith(ym));
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
    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0));

  const totalCount = completed.length;
  const totalAmount = completed.reduce((sum, project) => sum + project.amount, 0);
  const averageAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

  const thisYearPrefix = `${now.getFullYear()}-`;
  const thisYear = completed.filter((project) => project.dueDate.startsWith(thisYearPrefix));
  const thisYearCount = thisYear.length;
  const thisYearAmount = thisYear.reduce((sum, project) => sum + project.amount, 0);

  const monthlyMap = new Map<string, NatoriMonthlyResult>();
  for (const project of completed) {
    const ym = project.dueDate.slice(0, 7);
    const entry = monthlyMap.get(ym) ?? {
      ym,
      label: toMonthLabel(ym),
      count: 0,
      amount: 0,
    };
    entry.count += 1;
    entry.amount += project.amount;
    monthlyMap.set(ym, entry);
  }
  const monthly = Array.from(monthlyMap.values()).sort((a, b) =>
    a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : 0
  );

  const typeMap = new Map<NatoriProjectType, NatoriTypeResult>();
  for (const project of completed) {
    const entry = typeMap.get(project.type) ?? {
      type: project.type,
      count: 0,
      amount: 0,
    };
    entry.count += 1;
    entry.amount += project.amount;
    typeMap.set(project.type, entry);
  }
  const byType = Array.from(typeMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    totalCount,
    totalAmount,
    averageAmount,
    thisYearCount,
    thisYearAmount,
    monthly,
    byType,
    completed,
  };
}

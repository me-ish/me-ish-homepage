import { formatYen } from "@/features/natori/lib/pricing";
import type {
  NatoriConcreteProjectType,
  NatoriProject,
  NatoriProjectType,
} from "@/features/natori/types/projects";

export const NATORI_CONCRETE_PROJECT_TYPES: readonly NatoriConcreteProjectType[] = [
  "icon",
  "sd",
  "standing",
  "illustration",
];

export const NATORI_PROJECT_TYPE_LABELS: Record<NatoriProjectType, string> = {
  icon: "アイコン",
  sd: "SD",
  standing: "立ち絵",
  illustration: "イラスト",
  undecided: "未定",
};

export function isNatoriConcreteProjectType(
  value: string
): value is NatoriConcreteProjectType {
  return NATORI_CONCRETE_PROJECT_TYPES.includes(value as NatoriConcreteProjectType);
}

export function readNatoriProjectType(value: string): NatoriProjectType {
  return isNatoriConcreteProjectType(value) ? value : "undecided";
}

export function formatNatoriProjectAmount(amount: number | null): string {
  if (amount === null) return "未定";
  if (amount === 0) return "無料";
  return formatYen(amount);
}

export function formatNatoriProjectDueDate(
  dueDate: string | null,
  formatter: (value: string) => string
): string {
  return dueDate === null ? "未定" : formatter(dueDate);
}

export function toNatoriAmountInputValue(amount: number | null): string {
  return amount === null ? "" : String(amount);
}

export function toNatoriDueDateInputValue(dueDate: string | null): string {
  return dueDate === null ? "" : dueDate;
}

export type NatoriNullableEditChanges = {
  type?: NatoriConcreteProjectType;
  amount?: number;
  dueDate?: string;
};

/**
 * P1-02 does not write nullable values. Empty compatibility fields are omitted
 * so editing another field cannot turn null into 0/today or send undecided.
 */
export function getNatoriNullableEditChanges(
  project: Pick<NatoriProject, "type" | "amount" | "dueDate">,
  values: { type: NatoriProjectType; amount: string; dueDate: string }
): NatoriNullableEditChanges {
  const changes: NatoriNullableEditChanges = {};
  if (
    isNatoriConcreteProjectType(values.type) &&
    values.type !== project.type
  ) {
    changes.type = values.type;
  }
  if (values.amount.trim()) {
    const amount = Number(values.amount);
    if (amount !== project.amount) changes.amount = amount;
  }
  if (values.dueDate && values.dueDate !== project.dueDate) {
    changes.dueDate = values.dueDate;
  }
  return changes;
}

/**
 * 問い合わせ受付日は DB の created_at を正とする。古いデモ fixture だけは
 * startDate を互換フォールバックに使い、納期を受付日として扱わない。
 */
export function getNatoriInquiryReceivedISO(project: NatoriProject): string {
  return project.createdAt?.slice(0, 10) ?? project.startDate ?? "";
}

export function compareNatoriInquiriesByReceivedAt(
  a: NatoriProject,
  b: NatoriProject
): number {
  return getNatoriInquiryReceivedISO(a).localeCompare(
    getNatoriInquiryReceivedISO(b)
  );
}

export function isActiveNatoriProject(project: NatoriProject): boolean {
  return !project.deletedAt;
}

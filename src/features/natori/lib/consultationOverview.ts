import type { NatoriProject } from "@/features/natori/types/projects";

export function consultationReplyState(project: NatoriProject): "unknown" | "new" | "staff" | "client" | "none" {
  if (!project.consultation) return "unknown";
  if (project.consultation.latestSender === "client") return "staff";
  if (project.consultation.latestSender === "staff") return "client";
  return ["inquiry", "consulting"].includes(project.status) && !project.deletedAt ? "new" : "none";
}

export function consultationReplyLabel(project: NatoriProject): string {
  const state = consultationReplyState(project);
  if (project.deletedAt || project.status === "closed") {
    return state === "unknown" ? "返信状況を取得できません" : "相談終了・履歴のみ";
  }
  return { unknown: "返信状況を取得できません", new: "新規・未対応", staff: "ナトリの返信待ち", client: "依頼者の返信待ち", none: "やり取りなし" }[state];
}

export function consultationNeedsAttention(project: NatoriProject): boolean {
  const state = consultationReplyState(project);
  return state === "unknown" || ((!project.deletedAt && project.status !== "closed") && (state === "new" || state === "staff"))
    || Boolean(project.consultation && (project.consultation.notificationFailed || project.consultation.notificationPending));
}

export function consultationActivityAt(project: NatoriProject): string {
  return project.consultation?.latestMessageAt ?? project.createdAt ?? "";
}

export function consultationActivityDay(project: NatoriProject): string {
  const value = consultationActivityAt(project);
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

/** Oldest conversation/receipt first. ID makes equal timestamps deterministic. */
export function compareConsultationActivity(a: NatoriProject, b: NatoriProject): number {
  const at = (project: NatoriProject) => Date.parse(consultationActivityAt(project)) || 0;
  return at(a) - at(b) || a.id.localeCompare(b.id);
}

export function staffConsultationHref(projectId: string): string {
  return `/natori/inquiries?project=${encodeURIComponent(projectId)}&view=conversation`;
}

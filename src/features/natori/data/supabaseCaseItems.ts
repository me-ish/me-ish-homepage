// 案件の品目を管理用 API 経由で読み書きする（ブラウザから呼ぶ）。
import { z } from "zod";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { CaseItemFields } from "../lib/caseItems";
import type { NatoriCaseItem, NatoriLinkableCaseItem } from "../types/caseItems";

const item = z.object({
  id: z.string(), projectId: z.string(), position: z.number().int(), title: z.string(),
  projectType: z.enum(["icon", "sd", "standing", "illustration"]).nullable(), amount: z.number().nullable(),
  dueDate: z.string().nullable(), progress: z.enum(["not_started", "in_progress", "done"]),
  publicationPolicy: z.enum(["allowed", "delayed", "work_private", "fully_private", "unknown"]),
  publicationAllowedFrom: z.string().nullable(), note: z.string().nullable(),
  handedOverAt: z.string().nullable(), updatedAt: z.string(),
});
const listResponse = z.object({ items: z.array(item) });

export type CaseItemsLoad = { kind: "ok"; items: NatoriCaseItem[] } | { kind: "unavailable" };

/** 読めないとき（表がまだ無い・一時的な不具合）は unavailable。画面は品目なしとして動く。 */
export async function loadCaseItems(projectId: string): Promise<CaseItemsLoad> {
  try {
    const response = await fetch(`/api/natori/admin/case-items?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!response.ok) return { kind: "unavailable" };
    return { kind: "ok", items: listResponse.parse(await response.json()).items };
  } catch {
    return { kind: "unavailable" };
  }
}

const countsResponse = z.object({ counts: z.record(z.string(), z.number().int().nonnegative()) });

/** 一覧の「N点」用。読めなければ空（数を出さないだけ）。 */
export async function loadCaseItemCounts(signal?: AbortSignal): Promise<Record<string, number>> {
  try {
    const response = await fetch("/api/natori/admin/case-items?counts=1", { cache: "no-store", signal });
    if (!response.ok) return {};
    return countsResponse.parse(await response.json()).counts;
  } catch {
    return {};
  }
}

const linkableResponse = z.object({
  items: z.array(z.object({
    id: z.string(), caseTitle: z.string(), position: z.number().int(), title: z.string(),
    publicationPolicy: item.shape.publicationPolicy, publicationAllowedFrom: z.string().nullable(),
  })),
});

/** ポートフォリオの作品に結ぶ候補。読めなければ null。 */
export async function loadLinkableCaseItems(): Promise<NatoriLinkableCaseItem[] | null> {
  try {
    const response = await fetch("/api/natori/admin/case-items?linkable=1", { cache: "no-store" });
    if (!response.ok) return null;
    return linkableResponse.parse(await response.json()).items;
  } catch {
    return null;
  }
}

export type CaseItemsWrite = { kind: "ok"; items: NatoriCaseItem[] } | { kind: "error"; message: string };

const messages: Record<string, string> = {
  conflict: "ほかの画面で品目が変わりました。読み込み直してから、もう一度試してください。",
  item_limit_exceeded: "品目は20個までです。",
  project_archived: "しまった案件の品目は直せません。",
  unauthorized: "ログインが切れました。もう一度ログインしてください。",
  invalid_request: "入力に足りないところがあります。",
};

async function write(method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<CaseItemsWrite> {
  try {
    const response = await fetch("/api/natori/admin/case-items", {
      method,
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) return { kind: "ok", items: listResponse.parse(data).items };
    const code = (data as { error?: string } | null)?.error ?? "";
    return { kind: "error", message: messages[code] ?? "保存できませんでした。少し待ってから、もう一度試してください。" };
  } catch {
    return { kind: "error", message: "保存できたか分かりません。読み込み直して確かめてください。" };
  }
}

export const addCaseItem = (projectId: string, fields: CaseItemFields) => write("POST", { projectId, item: fields });
export const updateCaseItem = (projectId: string, target: NatoriCaseItem, fields: CaseItemFields) =>
  write("PATCH", { projectId, itemId: target.id, expectedUpdatedAt: target.updatedAt, item: fields });
export const deleteCaseItem = (projectId: string, target: NatoriCaseItem) =>
  write("DELETE", { projectId, itemId: target.id, expectedUpdatedAt: target.updatedAt });

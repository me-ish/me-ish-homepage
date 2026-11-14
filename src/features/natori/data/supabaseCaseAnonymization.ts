// 案件の依頼者情報の匿名化を管理用 API 経由で読む・行う（ブラウザから呼ぶ）。
import { z } from "zod";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { CaseAnonymizationStatus } from "../lib/caseAnonymization";

const status = z.discriminatedUnion("state", [
  z.object({ state: z.literal("done"), label: z.string(), anonymizedAt: z.string(), filesRemoved: z.boolean() }),
  z.object({ state: z.literal("not-yet"), eligible: z.boolean(), scheduledFrom: z.string().nullable() }),
]);

/** 読めないとき（表がまだ無い・一時的な不具合）は null。画面はこの欄を出さないだけ。 */
export async function loadCaseAnonymization(projectId: string): Promise<CaseAnonymizationStatus | null> {
  try {
    const response = await fetch(`/api/natori/admin/case-anonymize?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return z.object({ status }).parse(await response.json()).status;
  } catch {
    return null;
  }
}

const messages: Record<string, string> = {
  "not-eligible": "完了か見送りにした案件だけ匿名化できます。",
  busy: "送信の途中のメールがあります。少し待ってから、もう一度試してください。",
  unauthorized: "ログインが切れました。もう一度ログインしてください。",
  not_found: "案件が見つかりません。",
};

export async function anonymizeCaseNow(projectId: string): Promise<{ kind: "ok"; label: string; filesRemoved: boolean } | { kind: "error"; message: string }> {
  try {
    const response = await fetch("/api/natori/admin/case-anonymize", {
      method: "POST",
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, confirm: "anonymize" }),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const ok = z.object({ label: z.string(), filesRemoved: z.boolean() }).parse(data);
      return { kind: "ok", ...ok };
    }
    const code = (data as { error?: string } | null)?.error ?? "";
    return { kind: "error", message: messages[code] ?? "匿名化できませんでした。少し待ってから、もう一度試してください。" };
  } catch {
    return { kind: "error", message: "匿名化できたか分かりません。読み込み直して確かめてください。" };
  }
}

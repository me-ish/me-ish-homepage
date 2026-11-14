// 案件ごとの「振り返り用の記録」を管理用 API 経由で読み書きする（ブラウザから呼ぶ）。
import { z } from "zod";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { caseInsightsShape, type CaseInsights } from "../lib/caseInsights";

const response = z.object({ insights: caseInsightsShape });

export type CaseInsightsLoad = { kind: "ok"; insights: CaseInsights } | { kind: "unavailable" };

/** 読めないとき（表がまだ無い・一時的な不具合）は unavailable。画面はこの欄を出さないだけ。 */
export async function loadCaseInsights(projectId: string): Promise<CaseInsightsLoad> {
  try {
    const result = await fetch(`/api/natori/admin/case-insights?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!result.ok) return { kind: "unavailable" };
    return { kind: "ok", insights: response.parse(await result.json()).insights };
  } catch {
    return { kind: "unavailable" };
  }
}

export type CaseInsightsWrite = { kind: "ok"; insights: CaseInsights } | { kind: "error"; message: string };

export async function saveCaseInsights(projectId: string, patch: Partial<CaseInsights>): Promise<CaseInsightsWrite> {
  try {
    const result = await fetch("/api/natori/admin/case-insights", {
      method: "PATCH",
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, patch }),
    });
    const data: unknown = await result.json().catch(() => null);
    if (result.ok) return { kind: "ok", insights: response.parse(data).insights };
    const code = (data as { error?: string } | null)?.error ?? "";
    return { kind: "error", message: code === "unauthorized" ? "ログインが切れました。もう一度ログインしてください。" : "保存できませんでした。少し待ってから、もう一度試してください。" };
  } catch {
    return { kind: "error", message: "保存できたか分かりません。読み込み直して確かめてください。" };
  }
}

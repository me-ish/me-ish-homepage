// 依頼者情報の匿名化：結果の形と、画面に出す言葉。DB に触らない。
import { z } from "zod";

/** 完了（または見送り）からこの日数がたつと、毎日の処理で自動で匿名化する。DB の関数と同じ値。 */
export const NATORI_ANONYMIZE_AFTER_DAYS = 90;

export const anonymizeStorageObject = z.object({ bucket: z.string().min(1), path: z.string().min(1) });
export type AnonymizeStorageObject = z.infer<typeof anonymizeStorageObject>;

/** natori_case_anonymize_v1 の返り値。 */
export const anonymizeRpcResult = z.discriminatedUnion("result", [
  z.object({ result: z.literal("applied"), label: z.string(), storage: z.array(anonymizeStorageObject), storagePurged: z.boolean() }),
  z.object({ result: z.literal("already"), label: z.string(), storage: z.array(anonymizeStorageObject), storagePurged: z.boolean() }),
  z.object({ result: z.enum(["invalid", "not-found", "not-eligible", "too-early", "busy"]) }),
]);
export type AnonymizeRpcResult = z.infer<typeof anonymizeRpcResult>;

export type CaseAnonymizationStatus =
  | { state: "done"; label: string; anonymizedAt: string; filesRemoved: boolean }
  | { state: "not-yet"; eligible: boolean; scheduledFrom: string | null };

/** 自動で匿名化される日（東京の日付）。終わっていない案件は null。 */
export function scheduledAnonymizeDate(status: string, completedAt: string | null, updatedAt: string): string | null {
  if (status !== "completed" && status !== "closed") return null;
  const base = Date.parse(completedAt ?? updatedAt);
  if (!Number.isFinite(base)) return null;
  const at = new Date(base + NATORI_ANONYMIZE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(at);
}

/** ファイルをバケットごとに、一度に消せる数ずつに分ける。 */
export function groupStorageObjects(objects: AnonymizeStorageObject[], chunk = 100): { bucket: string; paths: string[] }[] {
  const byBucket = new Map<string, string[]>();
  for (const o of objects) {
    const list = byBucket.get(o.bucket) ?? [];
    if (!list.includes(o.path)) list.push(o.path);
    byBucket.set(o.bucket, list);
  }
  const out: { bucket: string; paths: string[] }[] = [];
  for (const [bucket, paths] of byBucket) for (let i = 0; i < paths.length; i += chunk) out.push({ bucket, paths: paths.slice(i, i + chunk) });
  return out;
}

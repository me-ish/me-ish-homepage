import { z } from "zod";
import type { NatoriProject } from "@/features/natori/types/projects";
import type { NatoriQuoteSnapshotItemV1 } from "@/features/natori/types/quoteSnapshot";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import { describeNatoriUsageTypes } from "@/features/natori/lib/requestPresentation";

const money = z.number().int().min(0).max(2147483647);
export const agreedTermsSchema = z.strictObject({
  scope: z.enum(["undecided", "bust_up", "waist_up", "full_body", "sd", "other"]),
  scopeNote: z.string().max(300),
  deliverables: z.string().max(1000),
  usage: z.string().max(300),
  commercialUse: z.enum(["unknown", "yes", "no"]),
  publication: z.string().max(300),
  dueDate: z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/),
  memo: z.string().max(2000),
});
export type NatoriAgreedTerms = z.infer<typeof agreedTermsSchema>;

export const estimateDraftItemSchema = z.strictObject({
  id: z.string().min(1).max(100),
  presetItemId: z.string().nullable(),
  kind: z.enum(["base", "fixed", "percentage", "manual"]),
  labelSnapshot: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(100),
  unitAmount: money,
  amount: money,
  automatic: z.boolean(),
  sourceFields: z.array(z.string().min(1).max(200)).max(20),
  ruleId: z.string().nullable(),
  note: z.string().nullable(),
}).refine((item) => item.amount === item.quantity * item.unitAmount, "明細の金額が一致しません");

export const estimateDraftSchema = z.strictObject({
  agreedTerms: agreedTermsSchema,
  items: z.array(estimateDraftItemSchema).max(30),
});

export type NatoriEstimateDraftData = {
  agreedTerms: NatoriAgreedTerms;
  items: NatoriQuoteSnapshotItemV1[];
};
export type NatoriEstimateDraft = NatoriEstimateDraftData & { revision: number };

export function defaultEstimateTerms(project: NatoriProject): NatoriAgreedTerms {
  const parsed = readNatoriRequestData(project.requestData);
  const request = parsed.success ? parsed.data : null;
  const originalScope = request?.commissionScope;
  return {
    scope: originalScope === "bust_up" || originalScope === "waist_up" || originalScope === "full_body"
      ? originalScope : request?.requestType === "sd" ? "sd" : "undecided",
    scopeNote: "",
    deliverables: "",
    usage: request?.usageTypes.length ? describeNatoriUsageTypes(request) : "",
    commercialUse: request?.commercialUse === "yes" ? "yes" : request?.commercialUse === "none" ? "no" : "unknown",
    publication: "",
    dueDate: request ? project.dueDate ?? "" : "",
    memo: "",
  };
}

export function validateEstimateTermsForIssue(terms: NatoriAgreedTerms): string[] {
  const missing: string[] = [];
  if (terms.scope === "undecided" || (terms.scope === "other" && !terms.scopeNote.trim())) missing.push("制作範囲");
  if (!terms.deliverables.trim()) missing.push("制作するもの");
  if (!terms.usage.trim()) missing.push("用途");
  if (terms.commercialUse === "unknown") missing.push("商用利用の有無");
  if (!terms.publication.trim()) missing.push("公開条件");
  const date = terms.dueDate;
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) missing.push("納品日");
  else if (date < new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) missing.push("納品日（過去の日付）");
  return missing;
}

export function estimateTotal(items: NatoriQuoteSnapshotItemV1[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

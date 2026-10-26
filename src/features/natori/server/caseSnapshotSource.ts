import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isPaymentTimestamp } from "../lib/clientPayment";
import type { CaseFact, CaseObservation } from "../types/caseReadModel";

export const CASE_SOURCE_LIMIT = 200;
export const sourceId = z.string().min(1);
export const sourceTime = z.string().refine(isPaymentTimestamp);
export const sourceMoney = z.number().int().nonnegative().safe();
export const sourceProjectSchema = z.object({
  id: sourceId,
  user_id: sourceId,
  title: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => isPaymentTimestamp(`${value}T00:00:00Z`)).nullable().optional(),
  status: z.enum(["inquiry", "estimating", "consulting", "quoted", "awaiting_payment", "rough", "lineart",
    "coloring", "waiting", "delivery_prep", "delivered", "completed", "closed"]),
  type: z.enum(["icon", "sd", "standing", "illustration", "undecided"]),
  amount: sourceMoney.nullable(),
  active_quote_id: sourceId.nullable(),
  quote_accepted_at: sourceTime.nullable(),
  quote_accepted_amount: sourceMoney.nullable(),
  payment_confirmed_at: sourceTime.nullable(),
  paid_amount: sourceMoney.nullable(),
  paid_at: sourceTime.nullable(),
  delivery_accepted_at: sourceTime.nullable(),
  completed_at: sourceTime.nullable(),
  delivered_mail_at: sourceTime.nullable(),
  has_legacy_payment_link: z.boolean(),
  payment_link_status: z.string().nullable(),
  deleted_at: sourceTime.nullable(),
  created_at: sourceTime,
  updated_at: sourceTime,
});
export type CaseSourceProject = z.infer<typeof sourceProjectSchema>;

export type CaseSourceContext = {
  project: CaseSourceProject;
  snapshotId: string;
  observedAt: string;
  /** Raw sections are parsed independently, never cast to business facts. */
  sections: Readonly<Record<string, unknown>>;
};

/** Fixed SELECT fragments authored in code, never assembled from request input. */
export type CaseRelation = { name: string; select: string };
export type CaseSourceRows<T> =
  | { state: "ready"; rows: readonly T[] }
  | { state: "not_requested" }
  | { state: "unavailable"; reason: "read_failed" | "unsupported" | "incomplete" };

const unavailableSectionSchema=z.object({state:z.literal("unavailable"),reason:z.enum(["read_failed","unsupported","incomplete"])});
const sectionIdentitySchema=z.object({id:sourceId,project_id:sourceId});
// Cache validator definitions by their exact schema object, never parsed rows,
// owners, permissions, observations or business decisions.
const sectionSchemas=new WeakMap<z.ZodType,z.ZodType<{total:number;rows:unknown[]}>>();
function sectionSchema<T>(schema:z.ZodType<T>):z.ZodType<{total:number;rows:T[]}>{
 const previous=sectionSchemas.get(schema);
 // The key is the same validator instance that defines the rows' output type T.
 if(previous)return previous as z.ZodType<{total:number;rows:T[]}>;
 const value=z.object({total:z.number().int().nonnegative().safe(),rows:z.array(schema).max(CASE_SOURCE_LIMIT)});
 sectionSchemas.set(schema,value);return value;
}

export function sourceRows<T>(
  context: CaseSourceContext,
  name: string,
  schema: z.ZodType<T>,
): CaseSourceRows<T> {
  const section = context.sections[name];
  if (section === undefined) return { state: "not_requested" };
  if(section!==null&&typeof section==="object"&&"state" in section){
    const unavailable=unavailableSectionSchema.safeParse(section);
    if(unavailable.success)return unavailable.data;
  }
  const parsed=sectionSchema(schema).safeParse(section);
  if (!parsed.success || parsed.data.total > CASE_SOURCE_LIMIT || parsed.data.total !== parsed.data.rows.length) {
    return { state: "unavailable", reason: "incomplete" };
  }
  const identities = new Set<string>();
  for (const row of parsed.data.rows) {
    const identity = sectionIdentitySchema.safeParse(row);
    if (!identity.success || identity.data.project_id !== context.project.id || identities.has(identity.data.id)) {
      return { state: "unavailable", reason: "incomplete" };
    }
    identities.add(identity.data.id);
  }
  return { state: "ready", rows: parsed.data.rows };
}

function canonicalSource(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalSource).sort().join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalSource(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Opaque revision of selected fields, never raw source JSON or a DB sequence. */
export function sourceRevision(value: unknown): string {
  return `case-source-v1:${createHash("sha256").update(canonicalSource(value)).digest("hex")}`;
}

export function readySource<T>(context: CaseSourceContext, value: T): CaseObservation<T> {
  return { state: "ready", snapshotId: context.snapshotId, observedAt: context.observedAt,
    revision: sourceRevision(value), value };
}

export function absentSource(context: CaseSourceContext): CaseObservation<never> {
  return { state: "absent", snapshotId: context.snapshotId, observedAt: context.observedAt, revision: "absent" };
}

export function incompleteSource(): { state: "unavailable"; reason: "incomplete" } {
  return { state: "unavailable", reason: "incomplete" };
}

export function sourceFailure(result: Exclude<CaseSourceRows<unknown>, { state: "ready" }>): CaseObservation<never> {
  return result;
}

export function sourceFact(
  context: CaseSourceContext, id: string, recordedAt: string, value: unknown,
  source: CaseFact["source"] = "ledger",
): CaseFact {
  return { id, projectId: context.project.id, recordedAt, revision: sourceRevision(value), source };
}

export function sourceOccurred(context: CaseSourceContext, value: string): boolean {
  return isPaymentTimestamp(value) && isPaymentTimestamp(context.observedAt)
    && compareSourceTimes(value, context.observedAt) <= 0;
}

function instantParts(value: string): { second: number; fraction: string } {
  if (!isPaymentTimestamp(value)) throw new Error("Invalid case source timestamp");
  const match = /^(.{19})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value)!;
  return { second: Date.parse(`${match[1]}${match[3]}`), fraction: (match[2] ?? "").replace(/0+$/, "") };
}

/** Preserve PostgreSQL sub-millisecond precision in condition identities. */
export function sourceTimestamp(value: string): string {
  const { second, fraction } = instantParts(value);
  return `${new Date(second).toISOString().slice(0, -5)}.${fraction.padEnd(3, "0")}Z`;
}

export function compareSourceTimes(left: string, right: string): number {
  const a = instantParts(left), b = instantParts(right);
  if (a.second !== b.second) return a.second < b.second ? -1 : 1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(length, "0"), bf = b.fraction.padEnd(length, "0");
  return af < bf ? -1 : af > bf ? 1 : 0;
}

export function sameSourceTime(left: string, right: string): boolean {
  return isPaymentTimestamp(left) && isPaymentTimestamp(right) && compareSourceTimes(left, right) === 0;
}

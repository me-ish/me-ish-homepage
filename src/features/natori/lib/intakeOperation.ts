// Shared canonical request contract. No DB, runtime API, secret or client owner input.
import { z } from "zod";
import { natoriRequestSubmissionV1Schema } from "./requestSchema";
import { normalizeNatoriReferenceUrl } from "./referenceLinks";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL } from "./requestPresentation";
import type { NatoriRequestSubmissionV1 } from "../types/request";

export const intakeOperationIdSchema = z.uuid({ version: "v4" }).transform(value => value.toLowerCase());
export const intakeHashSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const intakeManifestSchema = z.array(z.strictObject({
  digest: intakeHashSchema,
  size: z.number().int().min(1).max(4 * 1024 * 1024),
  type: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
})).max(5).refine(files => files.reduce((total, file) => total + file.size, 0) <= 4 * 1024 * 1024);
export type IntakeManifest = z.infer<typeof intakeManifestSchema>;

export const legacyIntakeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254).pipe(z.email()),
  requestType: z.string().trim().min(1).max(50),
  plan: z.string().trim().max(50).default(""),
  options: z.array(z.string().trim().max(50)).max(20).default([]),
  budget: z.string().trim().max(30).default(""),
  deadline: z.string().trim().max(60).default(""),
  refUrls: z.string().trim().max(2000).default(""),
  details: z.string().trim().min(1).max(4000),
  message: z.string().trim().max(2000).default(""),
});

export type CanonicalIntake = {
  submission: NatoriRequestSubmissionV1;
  referenceLinks: Array<{ url: string; normalized_url: string; label: string | null; provider: null; sort_order: number }>;
  manifest: IntakeManifest;
};
export type IntakeTextFields = Record<string, string | string[]>;

export function canonicalizeIntake(fields: IntakeTextFields, manifest: IntakeManifest): CanonicalIntake {
  const text = (key: string) => typeof fields[key] === "string" ? fields[key] as string : "";
  let submission: NatoriRequestSubmissionV1;
  const links: CanonicalIntake["referenceLinks"] = [];
  if (text("formVersion") === "etorie-request-v1") {
    const decoded: unknown = JSON.parse(text("requestData"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("invalid_request");
    submission = natoriRequestSubmissionV1Schema.parse({
      clientName: text("name"), clientEmail: text("email"),
      requestData: { ...decoded, schemaVersion: 1, formVersion: "etorie-request-v1", legacySource: null },
    });
    const decodedLinks: unknown = JSON.parse(text("referenceLinks") || "[]");
    const parsedLinks = z.array(z.strictObject({ url: z.string().trim().max(2048), label: z.string().trim().max(100).nullable().optional() })).max(5).parse(decodedLinks);
    const seen = new Set<string>();
    for (const link of parsedLinks) {
      if (!link.url) continue;
      const normalized = normalizeNatoriReferenceUrl(link.url);
      if (!normalized || seen.has(normalized)) throw new Error("invalid_reference_links");
      seen.add(normalized);
      links.push({ url: normalized, normalized_url: normalized, label: link.label || null, provider: null, sort_order: links.length });
    }
  } else {
    const legacy = legacyIntakeSchema.parse({ ...fields, options: fields.options ?? [] });
    // Old labels remain verbatim in legacySource. Unknown terms are never inferred as consent.
    submission = natoriRequestSubmissionV1Schema.parse({
      clientName: legacy.name, clientEmail: legacy.email,
      requestData: {
        schemaVersion: 1, formVersion: "natori-portfolio-v1", inquiryMode: "consultation",
        requestType: "undecided", requestTypeOther: null, commissionScope: "undecided", commissionScopeOther: null,
        options: [], usageTypes: [], usageTypeOther: null, commercialUse: "unknown", publicationPolicy: "unknown",
        budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
        deadline: { kind: "undecided", date: null, note: "" },
        characterFeatures: "", expressionMood: "", composition: "", colorDirection: "", referenceNotes: "",
        message: legacy.message || legacy.details.slice(0, 2000),
        legacySource: {
          formVersion: "natori-portfolio-v1", requestTypeLabel: legacy.requestType, planLabel: legacy.plan,
          optionLabels: legacy.options, budgetLabel: legacy.budget, deadlineLabel: legacy.deadline,
          referenceUrlsText: legacy.refUrls, details: legacy.details, message: legacy.message,
        },
      },
    });
  }
  return { submission, referenceLinks: links, manifest: intakeManifestSchema.parse(manifest) };
}

/** Recursive key ordering, retaining array order, is identical in browser and Node. */
export function canonicalIntakeJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIntakeJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalIntakeJson(entry)}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("invalid_request");
  return encoded;
}

export function isMassProductionIntake(input: CanonicalIntake): boolean {
  const request = input.submission.requestData;
  return (request.requestType === "other" && request.requestTypeOther === NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL)
    || request.legacySource?.requestTypeLabel === NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL;
}

export function intakeTextFields(form: FormData): IntakeTextFields {
  const fields: IntakeTextFields = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") {
    if (key === "options") {
      const current = fields[key];
      fields[key] = [...(Array.isArray(current) ? current : []), value];
    } else {
      if (key in fields) throw new Error("duplicate_field");
      fields[key] = value;
    }
  }
  return fields;
}

// features/natori/lib/requestSchema.ts
// RequestData V1 の UI / server 共用 validation。DB・fetch・process.env には依存しない。
import { z } from "zod";
import {
  NATORI_COMMISSION_SCOPES_V1,
  NATORI_CONCRETE_COMMISSION_SCOPES_V1,
  NATORI_CONCRETE_REQUEST_TYPES_V1,
  NATORI_REQUEST_SCHEMA_VERSION,
  NATORI_REQUEST_TYPES_V1,
  NATORI_USAGE_TYPES_V1,
  type NatoriRequestDataV1,
  type NatoriRequestSubmissionV1,
  type NatoriVersionedRequestData,
} from "@/features/natori/types/request";

export const NATORI_REQUEST_DATA_MAX_BYTES = 64 * 1024;

const unsafeControlCharacter = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const stableIdPattern = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u;

function text(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((value) => !unsafeControlCharacter.test(value), {
      message: "制御文字は使用できません",
    });
}

const nullableText = (max: number) => text(max).nullable();
const nonNegativeInteger = z.number().int().min(0);

const optionSchema = z.strictObject({
  id: text(64).min(1).regex(stableIdPattern, "stable ID の形式が不正です"),
  label: text(100).min(1),
  quantity: z.number().int().min(1).max(10),
  notes: text(300),
});

const budgetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("undecided"),
    min: z.null(),
    max: z.null(),
    currency: z.literal("JPY"),
  }),
  z
    .strictObject({
      kind: z.literal("range"),
      min: nonNegativeInteger,
      max: nonNegativeInteger.nullable(),
      currency: z.literal("JPY"),
    })
    .refine((value) => value.max === null || value.max >= value.min, {
      path: ["max"],
      message: "上限は下限以上にしてください",
    }),
  z
    .strictObject({
      kind: z.literal("fixed"),
      min: nonNegativeInteger,
      max: nonNegativeInteger,
      currency: z.literal("JPY"),
    })
    .refine((value) => value.min === value.max, {
      path: ["max"],
      message: "固定金額では min と max を一致させてください",
    }),
]);

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isoDateSchema = z.string().refine(isValidIsoDate, {
  message: "実在する日付を YYYY-MM-DD 形式で指定してください",
});

const deadlineSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["undecided", "standard"]),
    date: z.null(),
    note: text(500),
  }),
  z.strictObject({
    kind: z.literal("preferred_date"),
    date: isoDateSchema,
    note: text(500),
  }),
  z.strictObject({
    kind: z.literal("rush_consultation"),
    date: isoDateSchema.nullable(),
    note: text(500),
  }),
]);

const legacySourceSchema = z.strictObject({
  formVersion: z.literal("natori-portfolio-v1"),
  requestTypeLabel: text(100),
  planLabel: text(100),
  optionLabels: z.array(text(100)).max(20),
  budgetLabel: text(100),
  deadlineLabel: text(100),
  referenceUrlsText: text(5000),
  details: text(4000),
  message: text(2000),
});

const requestTypeSchema = z.enum(NATORI_REQUEST_TYPES_V1);
const concreteRequestTypeSchema = z.enum(NATORI_CONCRETE_REQUEST_TYPES_V1);
const commissionScopeSchema = z.enum(NATORI_COMMISSION_SCOPES_V1);
const concreteCommissionScopeSchema = z.enum(NATORI_CONCRETE_COMMISSION_SCOPES_V1);
const usageTypeSchema = z.enum(NATORI_USAGE_TYPES_V1);

const sharedRequestFields = {
  schemaVersion: z.literal(NATORI_REQUEST_SCHEMA_VERSION),
  formVersion: z.enum(["etorie-request-v1", "natori-portfolio-v1"]),
  requestTypeOther: nullableText(100),
  commissionScopeOther: nullableText(100),
  options: z.array(optionSchema).max(20),
  usageTypes: z.array(usageTypeSchema).max(10),
  usageTypeOther: nullableText(200),
  commercialUse: z.enum(["none", "yes", "unknown"]),
  publicationPolicy: z.enum([
    "allowed",
    "delayed",
    "work_private",
    "fully_private",
    "unknown",
  ]),
  budget: budgetSchema,
  deadline: deadlineSchema,
  characterFeatures: text(1000),
  expressionMood: text(1000),
  composition: text(1000),
  colorDirection: text(1000),
  referenceNotes: text(2000),
  message: text(2000),
  legacySource: legacySourceSchema.nullable(),
} as const;

const consultationRequestSchema = z.strictObject({
  ...sharedRequestFields,
  inquiryMode: z.literal("consultation"),
  requestType: requestTypeSchema,
  commissionScope: commissionScopeSchema,
});

const quoteRequestSchema = z.strictObject({
  ...sharedRequestFields,
  inquiryMode: z.literal("quote"),
  requestType: concreteRequestTypeSchema,
  commissionScope: concreteCommissionScopeSchema,
});

function addRequestCrossFieldIssues(
  value: z.infer<typeof consultationRequestSchema> | z.infer<typeof quoteRequestSchema>,
  ctx: z.RefinementCtx
) {
  const hasRequestTypeOther = (value.requestTypeOther?.length ?? 0) > 0;
  if (value.requestType === "other" && !hasRequestTypeOther) {
    ctx.addIssue({
      code: "custom",
      path: ["requestTypeOther"],
      message: "「その他」の依頼種別を入力してください",
    });
  } else if (value.requestType !== "other" && value.requestTypeOther !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["requestTypeOther"],
      message: "依頼種別が「その他」でない場合は null にしてください",
    });
  }

  const hasScopeOther = (value.commissionScopeOther?.length ?? 0) > 0;
  if (value.commissionScope === "other" && !hasScopeOther) {
    ctx.addIssue({
      code: "custom",
      path: ["commissionScopeOther"],
      message: "「その他」の制作範囲を入力してください",
    });
  } else if (value.commissionScope !== "other" && value.commissionScopeOther !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["commissionScopeOther"],
      message: "制作範囲が「その他」でない場合は null にしてください",
    });
  }

  const hasUsageOther = (value.usageTypeOther?.length ?? 0) > 0;
  if (value.usageTypes.includes("other") && !hasUsageOther) {
    ctx.addIssue({
      code: "custom",
      path: ["usageTypeOther"],
      message: "「その他」の使用目的を入力してください",
    });
  } else if (!value.usageTypes.includes("other") && value.usageTypeOther !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["usageTypeOther"],
      message: "使用目的に「その他」がない場合は null にしてください",
    });
  }

  if (new Set(value.usageTypes).size !== value.usageTypes.length) {
    ctx.addIssue({
      code: "custom",
      path: ["usageTypes"],
      message: "使用目的を重複して指定できません",
    });
  }

  const optionIds = value.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "同じオプション ID を重複して指定できません",
    });
  }
  value.options.forEach((option, index) => {
    if (option.id === "other" && option.notes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options", index, "notes"],
        message: "「その他」のオプション内容を入力してください",
      });
    }
  });

  const detailFields = [
    value.characterFeatures,
    value.expressionMood,
    value.composition,
    value.colorDirection,
    value.referenceNotes,
    value.message,
  ];
  if (!detailFields.some((field) => field.length > 0)) {
    ctx.addIssue({
      code: "custom",
      path: ["message"],
      message: "依頼内容または相談内容を1項目以上入力してください",
    });
  }
}

const requestDataUnionSchema = z
  .discriminatedUnion("inquiryMode", [consultationRequestSchema, quoteRequestSchema])
  .superRefine(addRequestCrossFieldIssues);

function jsonByteLength(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : new TextEncoder().encode(serialized).byteLength;
  } catch {
    return null;
  }
}

const requestDataSizeSchema = z.unknown().refine(
  (value) => {
    const bytes = jsonByteLength(value);
    return bytes !== null && bytes <= NATORI_REQUEST_DATA_MAX_BYTES;
  },
  { message: "request_data は64KiB以下にしてください" }
);

export const natoriRequestDataV1Schema: z.ZodType<NatoriRequestDataV1> =
  requestDataSizeSchema.pipe(requestDataUnionSchema);

export const natoriRequestSubmissionV1Schema: z.ZodType<NatoriRequestSubmissionV1> =
  z.strictObject({
    clientName: text(100).min(1),
    clientEmail: text(254).pipe(z.email()),
    requestData: natoriRequestDataV1Schema,
  });

export type NatoriRequestFieldError = {
  path: string;
  message: string;
};

export type NatoriRequestValidationResult =
  | { success: true; data: NatoriRequestDataV1 }
  | { success: false; errors: NatoriRequestFieldError[] };

/** UI と server の双方で同じ field-level error を得るための入口。 */
export function validateNatoriRequestDataV1(value: unknown): NatoriRequestValidationResult {
  const result = natoriRequestDataV1Schema.safeParse(value);
  if (result.success) return result;
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

export type NatoriRequestReaderResult =
  | { success: true; data: NatoriVersionedRequestData }
  | { success: false; reason: "invalid" | "unsupported_version"; errors: NatoriRequestFieldError[] };

/** schemaVersion を先に判別し、未知versionをV1として誤読しない互換reader。 */
export function readNatoriRequestData(value: unknown): NatoriRequestReaderResult {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== NATORI_REQUEST_SCHEMA_VERSION
  ) {
    return { success: false, reason: "unsupported_version", errors: [] };
  }
  const result = validateNatoriRequestDataV1(value);
  return result.success
    ? result
    : { success: false, reason: "invalid", errors: result.errors };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported request schema version: ${String(value)}`);
}

/** V2追加時に未対応のswitchをコンパイルエラーにするためのexhaustive helper。 */
export function requestSchemaVersionOf(value: NatoriVersionedRequestData): number {
  const version = value.schemaVersion;
  switch (version) {
    case 1:
      return version;
    default:
      return assertNever(version);
  }
}

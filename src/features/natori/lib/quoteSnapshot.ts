import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import {
  NATORI_QUOTE_PRICING_SNAPSHOT_SCHEMA_VERSION,
  type NatoriQuoteIssuePayloadV1,
  type NatoriQuotePricingSnapshotV1,
  type NatoriQuoteSnapshotItemV1,
  type NatoriQuoteSnapshotValidationIssue,
  type NatoriQuoteSnapshotValidationResult,
} from "@/features/natori/types/quoteSnapshot";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PROJECT_TYPES = new Set(["icon", "sd", "standing", "illustration"]);
const ITEM_KINDS = new Set(["base", "fixed", "percentage", "manual"]);
const RESOLUTIONS = new Set(["accepted", "overridden", "not_applicable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function push(
  issues: NatoriQuoteSnapshotValidationIssue[],
  path: string,
  code: string,
  message: string
) {
  issues.push({ path, code, message });
}

function isSafeMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function readItem(
  value: unknown,
  index: number,
  issues: NatoriQuoteSnapshotValidationIssue[]
): NatoriQuoteSnapshotItemV1 | null {
  const path = `pricingSnapshot.items.${index}`;
  if (!isRecord(value)) {
    push(issues, path, "item_invalid", "明細はobjectである必要があります。");
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const labelSnapshot = typeof value.labelSnapshot === "string" ? value.labelSnapshot.trim() : "";
  const quantity = value.quantity;
  const unitAmount = value.unitAmount;
  const amount = value.amount;
  const sourceFields = value.sourceFields;

  if (!id || id.length > 100) push(issues, `${path}.id`, "item_id_invalid", "明細IDが不正です。");
  if (!ITEM_KINDS.has(String(value.kind))) push(issues, `${path}.kind`, "item_kind_invalid", "明細種別が不正です。");
  if (!labelSnapshot || labelSnapshot.length > 200) push(issues, `${path}.labelSnapshot`, "item_label_invalid", "明細名が不正です。");
  if (!Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 100) {
    push(issues, `${path}.quantity`, "item_quantity_invalid", "数量は1〜100の整数である必要があります。");
  }
  if (!isSafeMoney(unitAmount)) push(issues, `${path}.unitAmount`, "item_unit_amount_invalid", "単価が不正です。");
  if (!isSafeMoney(amount)) push(issues, `${path}.amount`, "item_amount_invalid", "金額が不正です。");
  if (isSafeMoney(unitAmount) && Number.isSafeInteger(quantity) && isSafeMoney(amount) && amount !== unitAmount * quantity) {
    push(issues, `${path}.amount`, "item_amount_mismatch", "金額が単価×数量と一致しません。");
  }
  if (typeof value.automatic !== "boolean") push(issues, `${path}.automatic`, "item_automatic_invalid", "automaticが不正です。");
  if (!Array.isArray(sourceFields) || sourceFields.some((field) => typeof field !== "string" || field.length === 0 || field.length > 200)) {
    push(issues, `${path}.sourceFields`, "item_source_fields_invalid", "根拠フィールドが不正です。");
  }

  if (issues.some((issue) => issue.path === path || issue.path.startsWith(`${path}.`))) return null;

  return {
    id,
    presetItemId: typeof value.presetItemId === "string" ? value.presetItemId : null,
    kind: value.kind as NatoriQuoteSnapshotItemV1["kind"],
    labelSnapshot,
    quantity: quantity as number,
    unitAmount: unitAmount as number,
    amount: amount as number,
    automatic: value.automatic as boolean,
    sourceFields: sourceFields as string[],
    ruleId: typeof value.ruleId === "string" ? value.ruleId : null,
    note: typeof value.note === "string" ? value.note : null,
  };
}

export function validateNatoriQuoteIssuePayloadV1(
  value: unknown
): NatoriQuoteSnapshotValidationResult {
  const issues: NatoriQuoteSnapshotValidationIssue[] = [];
  if (!isRecord(value)) {
    return { success: false, issues: [{ path: "", code: "payload_invalid", message: "発行payloadが不正です。" }] };
  }

  const projectId = typeof value.projectId === "string" ? value.projectId : "";
  const toEmail = typeof value.toEmail === "string" ? value.toEmail.trim() : "";
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const bodySnapshot = typeof value.bodySnapshot === "string" ? value.bodySnapshot : "";
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey : "";

  if (!UUID_RE.test(projectId)) push(issues, "projectId", "project_id_invalid", "案件IDが不正です。");
  if (!EMAIL_RE.test(toEmail) || toEmail.length > 320) push(issues, "toEmail", "email_invalid", "宛先メールアドレスが不正です。");
  if (!subject || subject.length > 200) push(issues, "subject", "subject_invalid", "件名が不正です。");
  if (!bodySnapshot.trim() || bodySnapshot.length > 100_000) push(issues, "bodySnapshot", "body_invalid", "本文snapshotが不正です。");
  if (!IDEMPOTENCY_RE.test(idempotencyKey)) push(issues, "idempotencyKey", "idempotency_key_invalid", "冪等キーが不正です。");

  let requestSnapshot = null;
  if (value.requestSnapshot !== null) {
    const parsed = readNatoriRequestData(value.requestSnapshot);
    if (!parsed.success) push(issues, "requestSnapshot", "request_snapshot_invalid", "依頼snapshotが共有schemaに適合しません。");
    else requestSnapshot = parsed.data;
  }

  const pricing = value.pricingSnapshot;
  let pricingSnapshot: NatoriQuotePricingSnapshotV1 | null = null;
  if (!isRecord(pricing)) {
    push(issues, "pricingSnapshot", "pricing_snapshot_invalid", "料金snapshotが不正です。");
  } else {
    if (pricing.schemaVersion !== NATORI_QUOTE_PRICING_SNAPSHOT_SCHEMA_VERSION) push(issues, "pricingSnapshot.schemaVersion", "schema_version_invalid", "schemaVersionが不正です。");
    if (typeof pricing.mappingVersion !== "string" || !pricing.mappingVersion) push(issues, "pricingSnapshot.mappingVersion", "mapping_version_invalid", "mappingVersionが不正です。");
    if (!Number.isSafeInteger(pricing.pricingConfigVersion) || Number(pricing.pricingConfigVersion) < 1) push(issues, "pricingSnapshot.pricingConfigVersion", "pricing_config_version_invalid", "pricingConfigVersionが不正です。");
    if (typeof pricing.pricingPresetNameSnapshot !== "string" || !pricing.pricingPresetNameSnapshot.trim()) push(issues, "pricingSnapshot.pricingPresetNameSnapshot", "preset_name_invalid", "料金プリセット名が不正です。");
    if (!PROJECT_TYPES.has(String(pricing.projectTypeSnapshot))) push(issues, "pricingSnapshot.projectTypeSnapshot", "project_type_invalid", "商品種別が未確定または不正です。");
    if (pricing.currency !== "JPY") push(issues, "pricingSnapshot.currency", "currency_invalid", "通貨はJPYである必要があります。");
    if (!ISO_DATE_RE.test(String(pricing.issuedAt)) || Number.isNaN(Date.parse(String(pricing.issuedAt)))) push(issues, "pricingSnapshot.issuedAt", "issued_at_invalid", "発行時刻が不正です。");

    const items = Array.isArray(pricing.items)
      ? pricing.items.map((item, index) => readItem(item, index, issues)).filter((item): item is NatoriQuoteSnapshotItemV1 => item !== null)
      : [];
    if (!Array.isArray(pricing.items) || pricing.items.length === 0) push(issues, "pricingSnapshot.items", "items_required", "正式明細が1件以上必要です。");

    const seenIds = new Set<string>();
    for (const item of items) {
      if (seenIds.has(item.id)) push(issues, "pricingSnapshot.items", "duplicate_item_id", `明細ID ${item.id} が重複しています。`);
      seenIds.add(item.id);
    }

    if (!Array.isArray(pricing.reviewResolutions)) {
      push(issues, "pricingSnapshot.reviewResolutions", "review_resolutions_invalid", "確認結果が不正です。");
    } else {
      pricing.reviewResolutions.forEach((resolution, index) => {
        const path = `pricingSnapshot.reviewResolutions.${index}`;
        if (!isRecord(resolution)) return push(issues, path, "review_resolution_invalid", "確認結果が不正です。");
        if (typeof resolution.code !== "string" || !resolution.code) push(issues, `${path}.code`, "review_code_invalid", "warning codeが不正です。");
        if (typeof resolution.ruleId !== "string" || !resolution.ruleId) push(issues, `${path}.ruleId`, "review_rule_id_invalid", "ruleIdが不正です。");
        if (!RESOLUTIONS.has(String(resolution.resolution))) push(issues, `${path}.resolution`, "review_resolution_value_invalid", "解決区分が不正です。");
        if (typeof resolution.note !== "string" || resolution.note.length > 1000) push(issues, `${path}.note`, "review_note_invalid", "確認メモが不正です。");
        if (!ISO_DATE_RE.test(String(resolution.resolvedAt)) || Number.isNaN(Date.parse(String(resolution.resolvedAt)))) push(issues, `${path}.resolvedAt`, "review_resolved_at_invalid", "確認時刻が不正です。");
      });
    }

    const subtotal = pricing.subtotalBeforePercentage;
    const total = pricing.total;
    if (!isSafeMoney(subtotal)) push(issues, "pricingSnapshot.subtotalBeforePercentage", "subtotal_invalid", "小計が不正です。");
    if (!Number.isSafeInteger(total) || Number(total) <= 0) push(issues, "pricingSnapshot.total", "total_invalid", "合計は正の安全整数である必要があります。");
    if (isSafeMoney(total)) {
      const itemTotal = items.reduce((sum, item) => sum + item.amount, 0);
      if (!Number.isSafeInteger(itemTotal) || itemTotal !== total) push(issues, "pricingSnapshot.total", "total_mismatch", "明細合計とtotalが一致しません。");
    }

    if (!issues.some((issue) => issue.path === "pricingSnapshot" || issue.path.startsWith("pricingSnapshot."))) {
      pricingSnapshot = pricing as unknown as NatoriQuotePricingSnapshotV1;
    }
  }

  if (issues.length > 0 || !pricingSnapshot) return { success: false, issues };

  const data: NatoriQuoteIssuePayloadV1 = {
    projectId,
    toEmail,
    subject,
    bodySnapshot,
    idempotencyKey,
    requestSnapshot,
    pricingSnapshot,
  };
  return { success: true, data };
}

import { QUOTE_VALID_DAYS } from "@/features/natori/lib/orderMail";

const TOKEN_RE = /^[0-9a-f]{64}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export type StructuredQuoteDeliveryAttempt = {
  acceptToken: string;
  expiresAt: string;
};

export type StructuredQuoteOperationAttempt = StructuredQuoteDeliveryAttempt & {
  idempotencyKey: string;
  issuedAt: string;
};

export function validateStructuredQuoteDeliveryAttempt(
  value: unknown,
  nowMs = Date.now(),
): { success: true; data: StructuredQuoteDeliveryAttempt } | { success: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { success: false };
  }
  const record = value as Record<string, unknown>;
  const acceptToken = typeof record.acceptToken === "string" ? record.acceptToken : "";
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : "";
  const expiresAtMs = Date.parse(expiresAt);
  const maxExpiryMs = nowMs + (QUOTE_VALID_DAYS + 1) * 24 * 60 * 60 * 1000;

  if (
    !TOKEN_RE.test(acceptToken) ||
    !ISO_DATE_RE.test(expiresAt) ||
    Number.isNaN(expiresAtMs) ||
    expiresAtMs <= nowMs ||
    expiresAtMs > maxExpiryMs
  ) {
    return { success: false };
  }

  return { success: true, data: { acceptToken, expiresAt } };
}

export function createStructuredQuoteOperationAttempt(
  projectId: string,
  options?: {
    now?: Date;
    randomUUID?: () => string;
  },
): StructuredQuoteOperationAttempt {
  const now = options?.now ?? new Date();
  const randomUUID = options?.randomUUID ?? (() => crypto.randomUUID());
  const issuedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + QUOTE_VALID_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const acceptToken = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");

  if (!TOKEN_RE.test(acceptToken)) {
    throw new Error("quote_accept_token_generation_failed");
  }

  return {
    idempotencyKey: `quote:${projectId}:${randomUUID()}`,
    acceptToken,
    issuedAt,
    expiresAt,
  };
}

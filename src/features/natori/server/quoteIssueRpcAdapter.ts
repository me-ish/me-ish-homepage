import "server-only";

import { z } from "zod";
import { validateNatoriQuoteIssuePayloadV1 } from "@/features/natori/lib/quoteSnapshot";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { NatoriQuoteIssuePayloadV1 } from "@/features/natori/types/quoteSnapshot";

export type IssueNatoriQuoteRpcInput = NatoriQuoteIssuePayloadV1 & {
  ownerId: string;
  title: string;
  clientName: string;
  tokenHash: string;
  expiresAt: string;
};

export type IssueNatoriQuoteRpcResult =
  | { kind: "issued" | "reused"; quoteId: string; version: number }
  | { kind: "rejected"; reason: string }
  | { kind: "db-error" };

const issueResultSchema = z.strictObject({
  quote_id: z.uuid(),
  version: z.number().int().positive(),
  reused: z.boolean(),
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function validateIssueNatoriQuoteRpcInput(
  input: IssueNatoriQuoteRpcInput,
): { success: true; data: IssueNatoriQuoteRpcInput } | { success: false; reason: string } {
  if (!input.ownerId || !input.title.trim() || !input.clientName.trim()) {
    return { success: false, reason: "quote_identity_invalid" };
  }
  if (!input.tokenHash.trim()) {
    return { success: false, reason: "quote_token_invalid" };
  }
  if (!ISO_DATE_RE.test(input.expiresAt) || Number.isNaN(Date.parse(input.expiresAt))) {
    return { success: false, reason: "quote_expiry_invalid" };
  }
  if (Date.parse(input.expiresAt) <= Date.now()) {
    return { success: false, reason: "quote_expiry_invalid" };
  }

  const payload = validateNatoriQuoteIssuePayloadV1(input);
  if (!payload.success) {
    return {
      success: false,
      reason: payload.issues[0]?.code ?? "quote_payload_invalid",
    };
  }

  return { success: true, data: input };
}

export function readIssueNatoriQuoteRpcResult(
  data: unknown,
): { quoteId: string; version: number; reused: boolean } | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const parsed = issueResultSchema.safeParse(data[0]);
  if (!parsed.success) return null;
  return {
    quoteId: parsed.data.quote_id,
    version: parsed.data.version,
    reused: parsed.data.reused,
  };
}

function readRpcErrorReason(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const knownReasons = [
    "project_not_found",
    "project_archived",
    "project_already_paid",
    "project_type_undecided",
    "invalid_quote_state",
    "project_type_snapshot_mismatch",
    "request_snapshot_mismatch",
    "quote_total_mismatch",
    "quote_item_total_mismatch",
    "invalid_quote_item",
    "unresolved_review_item",
    "orphan_review_resolution",
    "idempotency_conflict",
  ];
  return knownReasons.find((reason) => message.includes(reason)) ?? null;
}

export async function issueNatoriQuoteViaRpc(
  input: IssueNatoriQuoteRpcInput,
): Promise<IssueNatoriQuoteRpcResult> {
  const validated = validateIssueNatoriQuoteRpcInput(input);
  if (!validated.success) {
    return { kind: "rejected", reason: validated.reason };
  }

  try {
    const { data, error, status } = await supabaseAdmin().rpc(
      "natori_issue_quote_v1",
      {
        p_user_id: input.ownerId,
        p_project_id: input.projectId,
        p_title: input.title,
        p_client_name: input.clientName,
        p_to_email: input.toEmail,
        p_amount: input.pricingSnapshot.total,
        p_subject: input.subject,
        p_body_snapshot: input.bodySnapshot,
        p_token_hash: input.tokenHash,
        p_expires_at: input.expiresAt,
        p_request_snapshot: input.requestSnapshot,
        p_pricing_snapshot: input.pricingSnapshot,
        p_idempotency_key: input.idempotencyKey,
      },
    );

    if (error) {
      const reason = readRpcErrorReason(error);
      if (reason || (typeof status === "number" && status >= 400 && status < 500)) {
        return { kind: "rejected", reason: reason ?? "quote_issue_rejected" };
      }
      console.error("[natori-quote-issue-rpc] issue failed");
      return { kind: "db-error" };
    }

    const result = readIssueNatoriQuoteRpcResult(data);
    if (!result) return { kind: "db-error" };
    return {
      kind: result.reused ? "reused" : "issued",
      quoteId: result.quoteId,
      version: result.version,
    };
  } catch {
    console.error("[natori-quote-issue-rpc] issue threw");
    return { kind: "db-error" };
  }
}

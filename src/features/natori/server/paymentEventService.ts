import "server-only";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import { dispatchAcceptanceNotifications } from "./acceptanceNotifications";
import { normalizeNatoriPaymentEvent } from "../lib/paymentEvent";

export const paymentIntegrityEnabled = () => process.env.NATORI_PAYMENT_INTEGRITY_ENABLED === "1";
export const refundLedgerEnabled = () => process.env.NATORI_REFUND_LEDGER_ENABLED === "1";
/** Preserve confirmed ledger projections when the refund writer is rolled back. */
export const refundLedgerReadEnabled = () => refundLedgerEnabled() || process.env.NATORI_REFUND_LEDGER_READ_ENABLED === "1";

/** Called only after the shared route has verified Stripe's raw-body signature. */
export async function receiveNatoriPaymentEvent(event: Stripe.Event): Promise<{ status: 200 | 503; result: string }> {
  const owner = resolveTrustedNatoriOwnerId();
  const mode = process.env.NATORI_STRIPE_MODE;
  if (owner.kind !== "ok" || (mode !== "test" && mode !== "live")) return { status: 503, result: "payment_configuration" };
  if (event.livemode !== (mode === "live")) return { status: 503, result: "stripe_mode_mismatch" };
  const refundWrites = refundLedgerEnabled();
  const input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: refundWrites });
  const db = supabaseAdmin(), token = randomUUID();
  try {
    const claim = await db.rpc("natori_stripe_event_claim_v1", {
      p_owner_id: owner.ownerId, p_account: input.account, p_live: event.livemode, p_event_id: event.id, p_type: event.type,
      p_request: input.request, p_claim_token: token,
    });
    const row = claim.data?.[0];
    if (claim.error || !row) return { status: 503, result: "inbox_unavailable" };
    if (row.result === "completed" || row.result === "needs_review") {
      await dispatchAcceptanceNotifications(row.notification_ids);
      return { status: 200, result: row.result };
    }
    if (row.result !== "claimed") return { status: 503, result: "processing" };
    const complete = await db.rpc(refundWrites ? "natori_stripe_event_complete_v2" : "natori_stripe_event_complete_v1", {
      p_owner_id: owner.ownerId, p_account: input.account, p_live: event.livemode,
      p_event_id: event.id, p_claim_token: token, p_generation: row.generation,
    });
    const completed = complete.data?.[0];
    if (complete.error || !completed || !["completed", "needs_review"].includes(completed.result)) {
      return { status: 503, result: "payment_retry_required" };
    }
    // Payment and notification intent are already durable. Notification failure cannot roll them back.
    await dispatchAcceptanceNotifications(completed.notification_ids);
    return { status: 200, result: completed.result };
  } catch { return { status: 503, result: "payment_retry_required" }; }
}

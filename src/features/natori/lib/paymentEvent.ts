import type Stripe from "stripe";
import type { Json } from "@/types/supabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionalId = (value: unknown) => typeof value === "string" && value.length >= 1 && value.length <= 200 ? value : null;
const optionalUuid = (value: unknown) => typeof value === "string" && uuid.test(value) ? value : null;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const providerId = (value: unknown) => optionalId(typeof value === "string" ? value : record(value).id);
const money = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const currency = (value: unknown) => typeof value === "string" && /^[a-z]{3}$/i.test(value) ? value.toLowerCase() : null;

export function isNatoriRefundEventType(type: string): boolean {
  return ["refund.created", "refund.updated", "refund.failed", "charge.refund.updated", "charge.refunded"].includes(type);
}

/** Explicit metadata can exclude another product; absent metadata never proves Natori ownership. */
export function isExplicitOtherProductRefund(event: Stripe.Event): boolean {
  const object = record(event.data.object);
  const kinds = [record(object.metadata).kind, record(record(object.charge).metadata).kind,
    record(record(object.payment_intent).metadata).kind];
  return kinds.some(kind => typeof kind === "string" && kind.length > 0 && kind !== "natori_commission");
}

/** Stable financial identity only: never persist raw events, email, address or credentials. */
export function normalizeNatoriPaymentEvent(event: Stripe.Event, options: { includeRefundMapping?: boolean } = {}): { account: string; request: Json } {
  const account = optionalId(event.account) ?? "platform";
  if (isNatoriRefundEventType(event.type)) {
    const object = record(event.data.object), list = record(object.refunds);
    const refundObjects = event.type === "charge.refunded" ? (Array.isArray(list.data) ? list.data : []) : [object];
    const refunds: Json[] = refundObjects.map(value => {
      const refund = record(value);
      const charge = event.type === "charge.refunded" ? object : record(refund.charge);
      const intent = record(refund.payment_intent);
      const metadata = [record(refund.metadata), record(charge.metadata), record(intent.metadata)]
        .find(candidate => candidate.kind === "natori_commission");
      return { refundId: optionalId(refund.id), projectId: optionalUuid(metadata?.projectId),
        paymentIntentId: providerId(refund.payment_intent) ?? providerId(charge.payment_intent),
        chargeId: providerId(refund.charge) ?? optionalId(charge.id), amount: money(refund.amount), currency: currency(refund.currency),
        providerStatus: typeof refund.status === "string" ? refund.status : null };
    }).sort((a, b) => String(record(a).refundId).localeCompare(String(record(b).refundId)));
    return { account, request: { kind: "refund", projectId: null,
      eventCreated: money(event.created), snapshotIncomplete: event.type === "charge.refunded" && list.has_more === true, refunds } };
  }
  const session = event.data.object as Stripe.Checkout.Session;
  // Keep the frozen Phase 2B request shape when refund writes are disabled.
  const chargeId = options.includeRefundMapping ? providerId(record(session.payment_intent).latest_charge) : null;
  return { account, request: {
    sessionId: optionalId(session.id), projectId: optionalUuid(session.metadata?.projectId),
    quoteId: optionalUuid(session.metadata?.quoteId), paymentStatus: session.payment_status ?? null,
    currency: options.includeRefundMapping ? currency(session.currency) : typeof session.currency === "string" ? session.currency.toLowerCase() : null, amount: money(session.amount_total),
    paymentIntentId: providerId(session.payment_intent), ...(chargeId ? { chargeId } : {}),
  } };
}

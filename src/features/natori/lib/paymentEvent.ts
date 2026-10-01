import type Stripe from "stripe";
import type { Json } from "@/types/supabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionalId = (value: unknown) => typeof value === "string" && value.length >= 1 && value.length <= 200 ? value : null;
const optionalUuid = (value: unknown) => typeof value === "string" && uuid.test(value) ? value : null;

/** Stable payment identity only: never persist the raw event, email, address or credentials. */
export function normalizeNatoriPaymentEvent(event: Stripe.Event): { account: string; request: Json } {
  const session = event.data.object as Stripe.Checkout.Session;
  return { account: optionalId(event.account) ?? "platform", request: {
    sessionId: optionalId(session.id), projectId: optionalUuid(session.metadata?.projectId),
    quoteId: optionalUuid(session.metadata?.quoteId), paymentStatus: session.payment_status ?? null,
    currency: typeof session.currency === "string" ? session.currency.toLowerCase() : null,
    amount: typeof session.amount_total === "number" && Number.isSafeInteger(session.amount_total) && session.amount_total >= 0 ? session.amount_total : null,
    paymentIntentId: optionalId(typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id),
  } };
}

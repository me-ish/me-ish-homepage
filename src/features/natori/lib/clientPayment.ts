import type { NatoriClientPaymentFacts } from "../types/payment";

export const PAYMENT_LINK_STATES = ["absent", "active", "needs_review", "legacy_review", "creating", "inactive", "stop_required", "deactivating", "expired", "terminal"] as const;

export function isPaymentTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60
    && Number.isFinite(Date.parse(value));
}

/** Only a credential-free Stripe-hosted HTTPS page may become an action. */
export function isStripePaymentUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"));
  } catch { return false; }
}

export type ClientPaymentState = {
  status: "paid" | "review" | "processing" | "terminal" | "stopped" | "creating" | "expired" | "unavailable" | "active" | "waiting";
  confirmedAt: string | null;
  requiresReview: boolean;
  url: string | null;
  deadline: string | null;
};

/** Shared quote/talk precedence. A failure or conflicting projection never revives a URL. */
export function resolveClientPayment(facts: NatoriClientPaymentFacts, now: Date, linksAllowed = true): ClientPaymentState {
  const { overview, link } = facts;
  const result = (status: ClientPaymentState["status"], requiresReview = false): ClientPaymentState =>
    ({ status, confirmedAt: null, requiresReview, url: null, deadline: null });
  const validOverview = overview === undefined || (overview !== null && typeof overview === "object" && !Array.isArray(overview) && typeof overview.available === "boolean"
    && typeof overview.requiresReview === "boolean" && typeof overview.processing === "boolean"
    && (overview.confirmedAt === null || isPaymentTimestamp(overview.confirmedAt)));
  if (!validOverview) return result("unavailable");
  const review = overview?.requiresReview === true || ["needs_review", "legacy_review"].includes(overview?.linkState ?? "")
    || (link?.kind === "generation" && ["needs_review", "legacy_review"].includes(link.state));
  // Non-null confirmation is an established fact even if a later link read failed.
  const confirmedAt = overview?.confirmedAt ?? (isPaymentTimestamp(facts.confirmedAt) ? facts.confirmedAt : null);
  if (confirmedAt) return { ...result("paid", review), confirmedAt };
  if (facts.confirmedAt !== null && facts.confirmedAt !== undefined && !isPaymentTimestamp(facts.confirmedAt)) return result("unavailable", review);
  if (overview?.available === false) return result("unavailable", review);
  if (review) return result("review", true);
  if (overview?.processing) return result("processing");
  if (!linksAllowed || overview?.linkState === "terminal") return result("terminal");

  const state = overview?.linkState;
  if (state !== undefined && !PAYMENT_LINK_STATES.includes(state as typeof PAYMENT_LINK_STATES[number])) return result("unavailable");
  const directState = link?.kind === "generation" ? link.state : undefined;
  if (directState !== undefined && !PAYMENT_LINK_STATES.includes(directState as typeof PAYMENT_LINK_STATES[number])) return result("unavailable");
  for (const value of [state, directState]) {
    if (["inactive", "stop_required", "deactivating"].includes(value ?? "")) return result("stopped");
    if (value === "creating") return result("creating");
    if (value === "terminal") return result("terminal");
    if (value === "expired") return result("expired");
  }
  if (link?.kind === "unavailable") return result("unavailable");
  const deadline = state === "active" ? overview?.linkDeadline : link?.kind === "generation" ? link.deadline : null;
  for (const value of [deadline, link?.kind === "generation" ? link.deadline : null]) {
    if (value !== null && value !== undefined) {
      if (!isPaymentTimestamp(value)) return result("unavailable");
      if (Date.parse(value) <= now.getTime()) return result("expired");
    }
  }
  if (state === "active" && !isPaymentTimestamp(deadline)) return result("unavailable");
  if (link?.kind === "generation" && (!isPaymentTimestamp(link.deadline) || !isStripePaymentUrl(link.url))) return result("unavailable");
  if (state !== undefined && state !== "active" && link && link.kind !== "absent") return result("unavailable");
  if (state === "active" && link) {
    if (link.kind !== "generation" || link.state !== "active" || link.url !== overview?.linkUrl
      || Date.parse(link.deadline ?? "") !== Date.parse(deadline ?? "")) return result("unavailable");
  }
  const url = state === "active" ? overview?.linkUrl : link?.kind === "generation" || link?.kind === "legacy" ? link.url : null;
  if (state === "active" && !isStripePaymentUrl(url)) return result("unavailable");
  if (link?.kind === "legacy" && !isStripePaymentUrl(url)) return result("unavailable");
  if (state === "active" || (link?.kind === "generation" && link.state === "active") || link?.kind === "legacy") {
    return { ...result("active"), url: isStripePaymentUrl(url) ? url : null, deadline: deadline ?? null };
  }
  return result("waiting");
}

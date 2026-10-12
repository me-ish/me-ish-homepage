import { describe, expect, it } from "vitest";
import { isPaymentTimestamp, resolveClientPayment } from "../clientPayment";
import type { NatoriClientPaymentFacts, NatoriPaymentOverview } from "../../types/payment";

const now = new Date("2026-10-12T03:00:00Z");
const url = "https://buy.stripe.com/synthetic";
const deadline = "2026-10-13T03:00:00Z";
const overview = (over: Partial<NatoriPaymentOverview> = {}): NatoriPaymentOverview => ({ available: true, confirmedAt: null, requiresReview: false, processing: false, linkState: "active", linkUrl: url, linkDeadline: deadline, ...over });
const facts = (over: Partial<NatoriClientPaymentFacts> = {}): NatoriClientPaymentFacts => ({ confirmedAt: null, overview: overview(), link: { kind: "generation", state: "active", url, deadline }, ...over });

describe("client payment decision", () => {
  it("exposes only the coherent active Stripe page before its deadline", () => {
    expect(resolveClientPayment(facts(), now)).toMatchObject({ status: "active", url, deadline });
    expect(resolveClientPayment(facts({ overview: undefined }), now).url).toBe(url);
  });

  it.each(["needs_review", "legacy_review", "processing", "terminal", "inactive", "stop_required", "deactivating", "creating", "expired", "absent", "unknown"])("blocks %s even when the generation is active", state => {
    const payment = overview(state === "processing" ? { processing: true } : { linkState: state });
    const view = resolveClientPayment(facts({ overview: payment }), now);
    expect(view.status).not.toBe("active"); expect(view.url).toBeNull();
  });

  it.each(["needs_review", "legacy_review", "inactive", "stop_required", "deactivating", "creating", "expired", "terminal", "absent", "unknown"])("blocks an earlier generation in %s despite a later active overview", state => {
    expect(resolveClientPayment(facts({ link: { kind: "generation", state, url, deadline } }), now).url).toBeNull();
  });

  it("makes inbox review and processing suppress payment and retains paid plus review facts", () => {
    expect(resolveClientPayment(facts({ overview: overview({ requiresReview: true }) }), now)).toMatchObject({ status: "review", url: null });
    expect(resolveClientPayment(facts({ overview: overview({ processing: true }) }), now)).toMatchObject({ status: "processing", url: null });
    expect(resolveClientPayment(facts({ overview: overview({ confirmedAt: "2026-10-12T02:00:00Z", requiresReview: true, processing: true }) }), now)).toMatchObject({ status: "paid", confirmedAt: "2026-10-12T02:00:00Z", requiresReview: true, url: null });
  });

  it("preserves verified payment when the subsequent link read is unavailable", () => {
    expect(resolveClientPayment(facts({ overview: overview({ available: false, confirmedAt: "2026-10-12T02:00:00Z", requiresReview: true }) }), now)).toMatchObject({ status: "paid", requiresReview: true, url: null });
    expect(resolveClientPayment(facts({ overview: overview({ available: false }) }), now)).toMatchObject({ status: "unavailable", confirmedAt: null, url: null });
  });

  it.each(["2026-10-12T03:00:00Z", "2026-10-12T02:59:59Z"])("expires at or after the exact deadline %s", linkDeadline => {
    expect(resolveClientPayment(facts({ overview: overview({ linkDeadline }), link: { kind: "generation", state: "active", url, deadline: linkDeadline } }), now)).toMatchObject({ status: "expired", url: null });
  });

  it("rejects missing/invalid deadlines, URLs, and disagreements between reads", () => {
    for (const linkDeadline of [null, "invalid", "2026-02-30T00:00:00Z"]) expect(resolveClientPayment(facts({ overview: overview({ linkDeadline }) }), now).url).toBeNull();
    for (const linkUrl of [null, "javascript:alert(1)", "https://evil.example/", "https://buy.stripe.com@evil.example/", "https://user:secret@buy.stripe.com/"]) expect(resolveClientPayment(facts({ overview: overview({ linkUrl }) }), now).url).toBeNull();
    expect(resolveClientPayment(facts({ overview: overview({ linkUrl: "https://buy.stripe.com/new" }) }), now).url).toBeNull();
    expect(resolveClientPayment(facts({ overview: overview({ linkDeadline: "2026-10-14T03:00:00Z" }) }), now).url).toBeNull();
    expect(resolveClientPayment(facts({ overview: overview({ linkDeadline: "2026-10-14T03:00:00Z" }), link: { kind: "generation", state: "active", url, deadline: "2026-10-11T03:00:00Z" } }), now)).toMatchObject({ status: "expired", url: null });
  });

  it("allows legacy only after a successful no-row read with no unsafe overview", () => {
    const legacy = { kind: "legacy" as const, url, deadline: null };
    expect(resolveClientPayment({ link: legacy }, now)).toMatchObject({ status: "active", url, deadline: null });
    expect(resolveClientPayment({ link: legacy, overview: overview({ linkState: undefined }) }, now).url).toBe(url);
    for (const payment of [overview({ available: false }), overview({ requiresReview: true }), overview({ processing: true }), overview({ linkState: "legacy_review" }), overview({ linkState: "absent" })]) expect(resolveClientPayment({ link: legacy, overview: payment }, now).url).toBeNull();
    expect(resolveClientPayment({ link: { kind: "unavailable" } }, now).url).toBeNull();
  });

  it("keeps closed views free of any payment action", () => {
    expect(resolveClientPayment(facts(), now, false)).toMatchObject({ status: "terminal", url: null });
    expect(resolveClientPayment({ link: { kind: "legacy", url, deadline: null } }, now, false).url).toBeNull();
  });

  it("never treats malformed confirmation or overview shapes as paid", () => {
    for (const value of [null, [], {}, { available: true, confirmedAt: "bad", requiresReview: false, processing: false }]) {
      expect(resolveClientPayment(facts({ overview: value as unknown as NatoriPaymentOverview }), now)).toMatchObject({ status: "unavailable", confirmedAt: null, url: null });
    }
    expect(resolveClientPayment(facts({ overview: undefined, confirmedAt: "invalid" }), now)).toMatchObject({ status: "unavailable", confirmedAt: null, url: null });
    expect(isPaymentTimestamp("1")).toBe(false);
    expect(isPaymentTimestamp("2026-02-30T00:00:00Z")).toBe(false);
  });
});

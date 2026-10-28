import { describe, expect, it } from "vitest";
import { deriveCaseReadModel } from "../caseReadModel";
import type {
  CaseActionId,
  CaseConsultationFact,
  CaseDeliveryFact,
  CaseFact,
  CaseFinancialReviewFact,
  CaseNotificationAttempt,
  CaseObservation,
  CaseOperationFact,
  CasePaymentFact,
  CasePaymentLinkFact,
  CaseProductionFact,
  CaseProjectFact,
  CaseQuoteFact,
  CaseReadModel,
  CaseReceiptFact,
  CaseRoughFact,
  CaseSnapshot,
} from "../../types/caseReadModel";
import type { NatoriProjectStatus } from "../../types/projects";

// Entirely synthetic facts. No production IDs, customer data, credentials or URLs.
const PROJECT = "synthetic-case";
const SNAPSHOT = "synthetic-snapshot";
const NOW = "2026-10-20T12:00:00.000Z";
const OBSERVED = "2026-10-20T11:59:00.000Z";
const RECORDED = "2026-10-19T10:00:00.000Z";
const FUTURE = "2026-10-21T12:00:00.000Z";
const MONEY = { amount: 12000, currency: "JPY" };

function fact(id: string): CaseFact {
  return { id, projectId: PROJECT, revision: "1", recordedAt: RECORDED, source: "ledger" };
}

function ready<T>(
  value: T,
  extra: Partial<Extract<CaseObservation<T>, { state: "ready" }>> = {},
): Extract<CaseObservation<T>, { state: "ready" }> {
  return { state: "ready", snapshotId: SNAPSHOT, observedAt: OBSERVED, revision: "1", value, ...extra };
}

function absent(): Extract<CaseObservation<never>, { state: "absent" }> {
  return { state: "absent", snapshotId: SNAPSHOT, observedAt: OBSERVED, revision: "1" };
}

function unavailable<T>(value?: T, observedAt = RECORDED): Extract<CaseObservation<T>, { state: "unavailable" }> {
  return {
    state: "unavailable",
    reason: "read_failed",
    ...(value === undefined ? {} : { lastKnown: { value, revision: "1", observedAt } }),
  };
}

function project(extra: Partial<CaseProjectFact> = {}): CaseProjectFact {
  return {
    ...fact(PROJECT), rawStatus: "inquiry", type: "illustration", archivedAt: null,
    origin: "internal", administrativeAmount: { ...MONEY }, ...extra,
  };
}

function quote(extra: Partial<CaseQuoteFact> = {}): CaseQuoteFact {
  return {
    ...fact("quote-1"), version: 1, state: "issued", money: { ...MONEY },
    validUntil: FUTURE, acceptance: null, ...extra,
  };
}

function acceptedQuote(extra: Partial<CaseQuoteFact> = {}): CaseQuoteFact {
  return quote({
    acceptance: { quoteId: "quote-1", version: 1, acceptedAt: RECORDED, money: { ...MONEY } },
    ...extra,
  });
}

function payment(extra: Partial<CasePaymentFact> = {}): CasePaymentFact {
  return { ...fact("payment-1"), confirmedAt: RECORDED, money: { ...MONEY }, method: "stripe", ...extra };
}

function link(extra: Partial<CasePaymentLinkFact> = {}): CasePaymentLinkFact {
  return {
    ...fact("link-1"), quoteId: "quote-1", quoteVersion: 1, generation: 1,
    deadlineRevision: FUTURE, money: { ...MONEY }, expiresAt: FUTURE,
    state: "active", providerState: "active", ...extra,
  };
}

function production(extra: Partial<CaseProductionFact> = {}): CaseProductionFact {
  return {
    ...fact("production-1"), stage: "delivery",
    tasks: [{ id: "rough", done: true }, { id: "finish", done: true }],
    files: "ready", ...extra,
  };
}

function rough(id = "rough-1", extra: Partial<CaseRoughFact> = {}): CaseRoughFact {
  return { ...fact(id), beforeQuote: false, clientOkAt: null, acknowledgedAt: null, ...extra };
}

function delivery(extra: Partial<CaseDeliveryFact> = {}): CaseDeliveryFact {
  return { ...fact("delivery-1"), kind: "release", manifest: "verified", expiresAt: FUTURE, expiryRevision: FUTURE, ...extra };
}

function receipt(extra: Partial<CaseReceiptFact> = {}): CaseReceiptFact {
  return { ...fact("receipt-1"), deliveryId: "delivery-1", acceptedAt: RECORDED, ...extra };
}

function consultation(extra: Partial<CaseConsultationFact> = {}): CaseConsultationFact {
  return { ...fact("consultation-1"), responseRequired: true, ...extra };
}

function operation(extra: Partial<CaseOperationFact> = {}): CaseOperationFact {
  return {
    ...fact("operation-1"), target: { kind: "delivery", id: "delivery-1", revision: FUTURE },
    state: "unknown", ...extra,
  };
}

function notice(extra: Partial<CaseNotificationAttempt> = {}): CaseNotificationAttempt {
  return {
    ...fact("notice-1"), target: { kind: "delivery", id: "delivery-1", revision: FUTURE },
    purpose: "delivery_notice", notificationKey: "delivery-notice-1", attemptNo: 1,
    operationId: "operation-1", status: "sent", sentAt: RECORDED, resolvedByAttemptId: null,
    ...extra,
  };
}

function paymentNotice(extra: Partial<CaseNotificationAttempt> = {}): CaseNotificationAttempt {
  return notice({ target: { kind: "payment_link", id: "link-1", revision: FUTURE },
    purpose: "payment_notice", notificationKey: "payment-notice-1", ...extra });
}

describe("workspace delivery waiting follows the current client notice", () => {
  const model = (notifications: CaseSnapshot["notifications"], extra: Partial<CaseSnapshot> = {}) => deriveCaseReadModel(snapshot({
    delivery: ready(delivery({ noticeRequired: true })), notifications, ...extra,
  }));
  it.each(["pending", "sending", "failed", "unknown"] as const)("keeps %s notice with staff without inventing client waiting", status => {
    const result = model(ready([notice({ status, sentAt: null })]));
    expect(result.stage).toBe("delivery_issued");
    expect(result.attention).toContainEqual(expect.objectContaining({ reason: "delivery_notice_unconfirmed", waitingOn: "staff" }));
    expect(reasons(result)).not.toContain("receipt_pending");
  });
  it("requires positive evidence even with no notice rows", () => {
    expect(reasons(model(ready([])))).toContain("delivery_notice_unconfirmed");
  });
  it.each(["receipt_notice", "staff_notice"] as const)("does not use %s as client delivery notice evidence", purpose => {
    expect(reasons(model(ready([notice({ purpose })])))).toContain("delivery_notice_unconfirmed");
  });
  it.each([
    { kind: "delivery" as const, id: "another-release", revision: FUTURE },
    { kind: "delivery" as const, id: "delivery-1", revision: RECORDED },
  ])("rejects another release or obsolete expiry: %j", target => {
    expect(reasons(model(ready([notice({ target })])))).toContain("delivery_notice_unconfirmed");
  });
  it("last-known success does not prove a current send", () => {
    expect(reasons(model(unavailable([notice()])))).toContain("delivery_notice_unconfirmed");
  });
  it("last-known delivery terms cannot establish current client waiting", () => {
    const result = model(ready([notice()]), { delivery: unavailable(delivery({ noticeRequired: true })) });
    expect(reasons(result)).toContain("delivery_notice_unconfirmed");
    expect(reasons(result)).not.toContain("receipt_pending");
  });
  it("a mixed-snapshot delivery cannot establish current client waiting", () => {
    const result = model(ready([notice()]), { delivery: ready(delivery({ noticeRequired: true }), { snapshotId: "another-snapshot" }) });
    expect(reasons(result)).not.toContain("receipt_pending");
  });
  it("matching successful notice establishes client waiting", () => {
    const result = model(ready([notice()]));
    expect(result.attention).toContainEqual(expect.objectContaining({ reason: "receipt_pending", waitingOn: "client" }));
    expect(reasons(result)).not.toContain("delivery_notice_unconfirmed");
  });
  it("later unknown resend preserves prior success and separate unresolved attention", () => {
    const result = model(ready([notice(), notice({ id: "resend", notificationKey: "resend", operationId: "resend", status: "unknown", sentAt: null })]));
    expect(reasons(result)).toContain("receipt_pending");
    expect(reasons(result)).toContain("notification_unknown");
    expect(reasons(result)).not.toContain("delivery_notice_unconfirmed");
  });
  it("known receipt wins over missing notice evidence", () => {
    const result = model(ready([]), { receipt: ready(receipt()) });
    expect(result.stage).toBe("received");
    expect(reasons(result)).not.toContain("delivery_notice_unconfirmed");
    expect(reasons(result)).not.toContain("receipt_pending");
  });
  it("expired access retains its deadline attention", () => {
    const result = model(ready([]), { delivery: ready(delivery({ noticeRequired: true, expiresAt: RECORDED })) });
    expect(reasons(result)).toContain("delivery_access_expired");
    expect(reasons(result)).not.toContain("receipt_pending");
  });
  it("keeps an unmarked legacy release's existing semantics", () => {
    const result = model(ready([]), { delivery: ready(delivery()) });
    expect(reasons(result)).toContain("receipt_pending");
    expect(reasons(result)).not.toContain("delivery_notice_unconfirmed");
  });
});

function financial(kind: CaseFinancialReviewFact["kind"], id = "financial-1"): CaseFinancialReviewFact {
  return { ...fact(id), kind };
}

function snapshot(extra: Partial<CaseSnapshot> = {}): CaseSnapshot {
  return {
    projectId: PROJECT, snapshotId: SNAPSHOT, asOf: NOW, project: ready(project()),
    quote: absent(), link: absent(), payment: absent(), financialReview: ready([]),
    notifications: ready([]), operations: ready([]), production: absent(), roughs: ready([]),
    delivery: absent(), receipt: absent(), consultation: absent(),
    externalEvidence: { state: "unsupported" }, ...extra,
  };
}

it("explicit revision work waits for staff and suppresses an implied client response on that rough",()=>{
 const model=deriveCaseReadModel(snapshot({roughs:ready([rough("r1",{revisionPending:true})])}));
 expect(model.attention.some(a=>a.reason==="rough_revision_pending"&&a.waitingOn==="staff")).toBe(true);
 expect(model.attention.some(a=>a.reason==="rough_response_pending"&&a.targetId==="r1")).toBe(false);
});
it("a superseded rough remains history and never transfers its OK to the next version",()=>{
 const model=deriveCaseReadModel(snapshot({roughs:ready([rough("r1",{supersededBy:"r2",clientOkAt:RECORDED,acknowledgedAt:RECORDED}),rough("r2")])}));
 expect(model.attention.filter(a=>a.reason==="rough_response_pending").map(a=>a.targetId)).toEqual(["r2"]);
 expect(model.facts.roughs.state==="ready"&&model.facts.roughs.value[1].clientOkAt).toBe(null);
});

function action(model: CaseReadModel, id: CaseActionId) {
  const result = model.actions.find(item => item.id === id);
  expect(result, `action ${id} must have an explicit availability result`).toBeDefined();
  return result!;
}

function reasons(model: CaseReadModel) {
  return model.attention.map(item => item.reason);
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

describe("case evidence and observation boundaries", () => {
  it.each<NatoriProjectStatus>([
    "inquiry", "consulting", "estimating", "quoted", "awaiting_payment", "rough",
    "lineart", "coloring", "waiting", "delivery_prep", "delivered", "completed", "closed",
  ])("does not create agreement, payment, publication or receipt from raw %s", rawStatus => {
    const model = deriveCaseReadModel(snapshot({ project: ready(project({ rawStatus })) }));
    expect(model.agreement).toBe("absent");
    expect(["quote_accepted", "payment_available", "paid", "delivery_issued", "received"]).not.toContain(model.stage);
    expect(model.facts.payment.state).toBe("absent");
    expect(model.facts.delivery.state).toBe("absent");
    expect(model.facts.receipt.state).toBe("absent");
  });

  it("distinguishes ready, absent, not requested and unavailable observations", () => {
    const observations: CaseObservation<CaseQuoteFact>[] = [
      ready(quote()), absent(), { state: "not_requested" }, unavailable(),
    ];
    const models = observations.map(value => deriveCaseReadModel(snapshot({ quote: value })));
    expect(models.map(model => model.facts.quote.state)).toEqual(["ready", "absent", "not_requested", "unavailable"]);
    expect(models.map(model => model.agreement)).toEqual(["unaccepted", "absent", "unknown", "unknown"]);
    expect(models[1].attention.some(item => item.domain === "quote" && item.reason === "quote_needed")).toBe(true);
    for (const model of models.slice(2)) {
      expect(action(model, "prepare_quote").blockedBy).toContain("facts_not_current");
      expect(model.attention.some(item => item.domain === "quote" && item.action === "refresh_facts")).toBe(true);
    }
  });

  it("retains last-known accepted, paid and received facts while blocking fresh preparation", () => {
    const previousPayment = payment();
    const previousReceipt = receipt();
    const model = deriveCaseReadModel(snapshot({
      quote: unavailable(acceptedQuote()), payment: unavailable(previousPayment),
      delivery: unavailable(delivery()), receipt: unavailable(previousReceipt),
    }));
    expect(model.agreement).toBe("accepted");
    expect(model.stage).toBe("received");
    expect(model.facts.payment).toEqual(unavailable(previousPayment));
    expect(model.facts.receipt).toEqual(unavailable(previousReceipt));
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("facts_not_current");
    expect(action(model, "prepare_delivery").blockedBy).toContain("facts_not_current");
    expect(reasons(model)).toContain("unavailable");
  });

  it("does not trust a wrong-project payment, including a cached last-known payment", () => {
    for (const observed of [ready(payment({ projectId: "another-case" })), unavailable(payment({ projectId: "another-case" }))]) {
      const model = deriveCaseReadModel(snapshot({ payment: observed }));
      expect(model.stage).not.toBe("paid");
      expect(model.facts.payment).toEqual({ state: "unavailable", reason: "incomplete" });
      expect(model.issues).toContainEqual({ domain: "payment", code: "invalid_fact_identity", targetId: PROJECT });
    }
  });

  it("keeps mixed-snapshot payment as stale evidence instead of enabling a command", () => {
    const model = deriveCaseReadModel(snapshot({
      payment: ready(payment(), { snapshotId: "another-snapshot" }),
      project: ready(project({ rawStatus: "delivery_prep" })), production: ready(production()),
    }));
    expect(model.stage).toBe("paid");
    expect(model.facts.payment.state).toBe("unavailable");
    expect(action(model, "prepare_delivery").blockedBy).toContain("facts_not_current");
    expect(model.issues.some(item => item.code === "inconsistent_snapshot")).toBe(true);
  });

  it.each([
    { extra: { observedAt: FUTURE }, code: "inconsistent_snapshot" },
    { extra: { observedAt: "invalid-time" }, code: "invalid_fact_identity" },
    { extra: { revision: "" }, code: "inconsistent_snapshot" },
  ])("rejects inconsistent observation metadata $extra", ({ extra, code }) => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote(), extra) }));
    expect(model.facts.quote.state).toBe("unavailable");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
    expect(model.issues).toContainEqual({ domain: "quote", code, targetId: PROJECT });
  });

  it("fails closed for an invalid injected clock without consulting the wall clock", () => {
    const model = deriveCaseReadModel(snapshot({ asOf: "invalid-time", quote: ready(acceptedQuote()) }));
    expect(model.issues.some(item => item.code === "invalid_as_of")).toBe(true);
    expect(model.actions.filter(item => item.execution === "requires_command_revalidation").every(item => !item.available)).toBe(true);
  });

  it("does not let a malformed fact identity become evidence", () => {
    for (const extra of [{ id: "" }, { revision: "" }, { recordedAt: "invalid-time" }]) {
      const model = deriveCaseReadModel(snapshot({ receipt: ready(receipt(extra)) }));
      expect(model.facts.receipt.state).toBe("unavailable");
      expect(model.stage).not.toBe("received");
    }
  });

  it("does not treat a fact recorded after the snapshot time as current or last-known evidence", () => {
    for (const observed of [
      ready(payment({ recordedAt: FUTURE })),
      unavailable(payment({ recordedAt: FUTURE })),
    ]) {
      const model = deriveCaseReadModel(snapshot({ payment: observed }));
      expect(model.stage).not.toBe("paid");
      expect(model.facts.payment).toEqual({ state: "unavailable", reason: "incomplete" });
      expect(model.issues.some(item => item.domain === "payment")).toBe(true);
      expect(action(model, "open_production").available).toBe(false);
    }
  });

  it("rejects duplicate rough identities without reporting an empty successful read", () => {
    const model = deriveCaseReadModel(snapshot({ roughs: ready([rough(), rough()]) }));
    expect(model.facts.roughs.state).toBe("unavailable");
    expect(reasons(model)).toContain("duplicate_fact_identity");
    expect(model.attention.some(item => item.domain === "roughs" && item.action === "refresh_facts")).toBe(true);
  });
});

describe("quote, money and payment-link evidence", () => {
  it("permits payment preparation after the matching agreement without requiring quote email success", () => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote()) }));
    expect(model.agreement).toBe("accepted");
    expect(model.stage).toBe("quote_accepted");
    expect(action(model, "prepare_payment_notice")).toMatchObject({
      available: true, blockedBy: [], execution: "requires_command_revalidation",
    });
  });

  it.each([
    { quoteId: "another-quote" },
    { version: 2 },
    { acceptedAt: "invalid-time" },
    { money: { amount: 12001, currency: "JPY" } },
    { money: { amount: 12000, currency: "USD" } },
  ])("requires review for acceptance that does not match its quote: %j", extra => {
    const selected = acceptedQuote();
    selected.acceptance = { ...selected.acceptance!, ...extra };
    const model = deriveCaseReadModel(snapshot({ quote: ready(selected) }));
    expect(model.agreement).toBe("needs_review");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
    expect(reasons(model)).toContain("acceptance_target_mismatch");
  });

  it.each(["draft", "superseded"] as const)("does not use acceptance on a %s quote as current agreement", state => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote({ state })) }));
    expect(model.agreement).toBe("needs_review");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("does not revoke an accepted agreement when its acceptance deadline later expires", () => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote({ validUntil: RECORDED })) }));
    expect(model.agreement).toBe("accepted");
    expect(action(model, "prepare_payment_notice").available).toBe(true);
    expect(reasons(model)).not.toContain("quote_expired");
  });

  it("does not recognize an acceptance timestamp later than the snapshot", () => {
    const value = acceptedQuote();
    value.acceptance = { ...value.acceptance!, acceptedAt: FUTURE };
    const model = deriveCaseReadModel(snapshot({ quote: ready(value) }));
    expect(model.agreement).toBe("needs_review");
    expect(model.stage).not.toBe("quote_accepted");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it.each([
    ["2026-10-20T11:59:59.999Z", "quote_acceptance_pending"],
    [NOW, "quote_expired"],
    ["2026-10-20T12:00:00.001Z", "quote_expired"],
  ])("uses the quote deadline boundary at %s", (asOf, expected) => {
    const model = deriveCaseReadModel(snapshot({ asOf, quote: ready(quote({ validUntil: NOW })) }));
    expect(reasons(model)).toContain(expected);
  });

  it("preserves accepted terms and paid money when the administrative amount differs", () => {
    const paid = payment();
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ administrativeAmount: { amount: 14000, currency: "JPY" } })),
      quote: ready(acceptedQuote()), payment: ready(paid),
    }));
    expect(model.agreement).toBe("accepted");
    expect(model.stage).toBe("paid");
    expect(model.facts.payment).toEqual(ready(paid));
    expect(reasons(model)).toContain("administrative_agreement_amount_mismatch");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("retains a confirmed payment with unknown amount without turning it into zero", () => {
    const paid = payment({ money: null, method: "unclassified" });
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(paid), production: ready(production()),
    }));
    expect(model.stage).toBe("paid");
    expect(model.facts.payment).toEqual(ready(paid));
    expect(model.attention.some(item => item.domain === "payment")).toBe(true);
    expect(action(model, "prepare_delivery").available).toBe(false);
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("payment_recorded");
  });

  it.each([
    { amount: -1, currency: "JPY" },
    { amount: 1.5, currency: "JPY" },
    { amount: Number.MAX_SAFE_INTEGER + 1, currency: "JPY" },
    { amount: 12000, currency: "jpy" },
  ])("blocks preparation on invalid money %j", money => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote({ money })) }));
    expect(model.agreement).toBe("needs_review");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("keeps zero and unknown administrative money distinct", () => {
    const free = { amount: 0, currency: "JPY" };
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ administrativeAmount: null })),
      payment: ready(payment({ money: free, method: "manual" })),
    }));
    expect(model.stage).toBe("paid");
    expect(model.facts.payment).toEqual(ready(payment({ money: free, method: "manual" })));
    expect(reasons(model)).not.toContain("payment_administrative_amount_mismatch");
  });

  it.each([
    ["2026-10-20T11:59:59.999Z", "active"],
    [NOW, "expired"],
    ["2026-10-20T12:00:00.001Z", "expired"],
  ])("distinguishes expiry from provider stop at %s", (asOf, expected) => {
    const value = link({ expiresAt: NOW, deadlineRevision: NOW });
    const model = deriveCaseReadModel(snapshot({ asOf, quote: ready(acceptedQuote()), link: ready(value) }));
    expect(model.linkValidity).toBe(expected);
    expect(model.facts.link).toEqual(ready(value));
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("link_already_exists");
  });

  it.each<Partial<CasePaymentLinkFact>>([
    { quoteId: "another-quote" }, { quoteVersion: 2 }, { money: null },
    { money: { amount: 12001, currency: "JPY" } }, { generation: null },
    { generation: 0 }, { deadlineRevision: "" }, { expiresAt: null },
    { expiresAt: "invalid-time" }, { source: "legacy_projection" },
    { providerState: "unverified" }, { state: "stopping" }, { state: "unknown" },
  ])("does not call an unverified or mismatched payment link active: %j", extra => {
    const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote()), link: ready(link(extra)) }));
    expect(model.linkValidity).toBe("needs_review");
    expect(model.stage).not.toBe("payment_available");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("recognizes a proved stopped link without reissuing it through the new-link action", () => {
    const model = deriveCaseReadModel(snapshot({
      quote: ready(acceptedQuote()), link: ready(link({ state: "stopped", providerState: "inactive" })),
    }));
    expect(model.linkValidity).toBe("inactive");
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("link_already_exists");
  });

  it("asks to confirm a paid link has stopped only when the link can be checked with Stripe", () => {
    const reasons = (extra: Partial<CasePaymentLinkFact>) => deriveCaseReadModel(snapshot({
      quote: ready(acceptedQuote()), link: ready(link(extra)), payment: ready(payment()),
    })).attention.map(item => item.reason);
    expect(reasons({})).toContain("paid_link_stop_unconfirmed");
    expect(reasons({ source: "legacy_projection", providerState: "unverified" })).not.toContain("paid_link_stop_unconfirmed");
    expect(reasons({ state: "stopped", providerState: "inactive" })).not.toContain("paid_link_stop_unconfirmed");
  });

  it("does not present a last-known active link as currently payable after its read fails", () => {
    const previousLink = link();
    const model = deriveCaseReadModel(snapshot({
      quote: ready(acceptedQuote()), link: unavailable(previousLink),
    }));
    expect(model.linkValidity).toBe("unknown");
    expect(model.stage).not.toBe("payment_available");
    expect(model.facts.link).toEqual(unavailable(previousLink));
    expect(reasons(model)).not.toContain("payment_pending");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it.each(["payment", "quote", "project"] as const)(
    "does not call a link payable while its %s prerequisite is unavailable", domain => {
      const input = snapshot({ quote: ready(acceptedQuote()), link: ready(link()) });
      input[domain] = { state: "unavailable", reason: "read_failed" };
      const model = deriveCaseReadModel(input);
      expect(model.linkValidity).not.toBe("active");
      expect(model.stage).not.toBe("payment_available");
    },
  );

  it.each(["quote", "link"] as const)(
    "retains mixed-snapshot %s evidence without presenting current payment availability", domain => {
      const input = snapshot({ quote: ready(acceptedQuote()), link: ready(link()) });
      if (domain === "quote") input.quote = ready(acceptedQuote(), { snapshotId: "old-snapshot" });
      else input.link = ready(link(), { snapshotId: "old-snapshot" });
      const model = deriveCaseReadModel(input);
      expect(model.facts[domain].state).toBe("unavailable");
      expect(model.linkValidity).toBe("unknown");
      expect(model.stage).not.toBe("payment_available");
      expect(action(model, "prepare_payment_notice").available).toBe(false);
    },
  );

  it("keeps last-known accepted terms while suppressing active link claims until quote refresh", () => {
    const model = deriveCaseReadModel(snapshot({ quote: unavailable(acceptedQuote()), link: ready(link()) }));
    expect(model.agreement).toBe("accepted");
    expect(model.linkValidity).toBe("unknown");
    expect(model.stage).not.toBe("payment_available");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it.each(["closed", "completed"] as const)(
    "does not offer an active customer-payment state for a %s case", rawStatus => {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus })), quote: ready(acceptedQuote()), link: ready(link()),
      }));
      expect(model.linkValidity).not.toBe("active");
      expect(reasons(model)).not.toContain("payment_pending");
    },
  );

  it("does not present a second payment as available after money was confirmed", () => {
    const model = deriveCaseReadModel(snapshot({
      quote: ready(acceptedQuote()), link: ready(link()), payment: ready(payment()),
    }));
    expect(model.stage).toBe("paid");
    expect(model.linkValidity).not.toBe("active");
    expect(reasons(model)).not.toContain("payment_pending");
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("does not treat a future payment or receipt timestamp as an already recorded fact", () => {
    const model = deriveCaseReadModel(snapshot({
      payment: ready(payment({ confirmedAt: FUTURE })),
      receipt: ready(receipt({ acceptedAt: FUTURE })),
    }));
    expect(model.stage).not.toBe("paid");
    expect(model.stage).not.toBe("received");
    expect(reasons(model)).toContain("invalid_payment");
    expect(reasons(model)).toContain("invalid_receipt");
  });

  it("retains paid evidence alongside processing, review and refunds", () => {
    const model = deriveCaseReadModel(snapshot({
      payment: ready(payment()), financialReview: ready([
        financial("payment_processing", "processing"), financial("payment_review", "review"),
        financial("refund_pending", "refund-pending"), financial("refund_confirmed", "refund-confirmed"),
      ]),
    }));
    expect(model.stage).toBe("paid");
    expect(model.attention.filter(item => item.domain === "financialReview")).toHaveLength(4);
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("payment_recorded");
    expect(action(model, "view_consultation").available).toBe(true);
  });
});

describe("production, roughs, publication and receipt", () => {
  it.each([
    { tasks: [] },
    { tasks: [{ id: "finish", done: true }] },
    { tasks: [{ id: "rough", done: false }] },
  ])(
    "does not create payment or delivery from task completion $tasks", ({ tasks }) => {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), production: ready(production({ tasks })),
      }));
      expect(model.stage).not.toBe("paid");
      expect(model.stage).not.toBe("delivery_issued");
      expect(model.stage).not.toBe("received");
      expect(action(model, "prepare_delivery").blockedBy).toContain("payment_required");
    },
  );

  it("offers only revalidated preparation for a paid, eligible, file-ready case", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()), production: ready(production()),
    }));
    expect(model.stage).toBe("paid");
    expect(action(model, "prepare_delivery")).toMatchObject({ available: true, execution: "requires_command_revalidation" });
    expect(model.primary).toBe("prepare_delivery");
  });

  it.each(["absent", "pending", "failed", "unverified"] as const)(
    "does not prepare delivery with %s file evidence", files => {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()), production: ready(production({ files })),
      }));
      expect(action(model, "prepare_delivery").blockedBy).toContain("files_not_verified");
    },
  );

  it("blocks publication on duplicate tasks without changing the confirmed payment", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()),
      production: ready(production({ tasks: [{ id: "same", done: true }, { id: "same", done: false }] })),
    }));
    expect(model.stage).toBe("paid");
    expect(reasons(model)).toContain("duplicate_task_identity");
    expect(action(model, "prepare_delivery").blockedBy).toContain("inconsistent_facts");
  });

  it("keeps reference rough, partial OK, acknowledgement and notification as separate facts", () => {
    const model = deriveCaseReadModel(snapshot({
      roughs: ready([
        rough("before-quote", { beforeQuote: true }),
        rough("ok", { clientOkAt: RECORDED }),
        rough("ack", { clientOkAt: RECORDED, acknowledgedAt: OBSERVED }),
      ]),
    }));
    expect(model.agreement).toBe("absent");
    expect(model.facts.payment.state).toBe("absent");
    expect(model.attention).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetId: "before-quote", reason: "rough_response_pending", waitingOn: "client" }),
      expect.objectContaining({ targetId: "ok", reason: "rough_ok_unacknowledged", waitingOn: "staff" }),
    ]));
    expect(model.attention.some(item => item.targetId === "ack")).toBe(false);
    expect(model.attention.some(item => item.domain === "notifications")).toBe(false);
  });

  it.each([
    { clientOkAt: null, acknowledgedAt: OBSERVED },
    { clientOkAt: "invalid-time", acknowledgedAt: null },
    { clientOkAt: OBSERVED, acknowledgedAt: RECORDED },
  ])("rejects impossible rough acknowledgement chronology %j", extra => {
    const model = deriveCaseReadModel(snapshot({ roughs: ready([rough("rough-1", extra)]) }));
    expect(reasons(model)).toContain("invalid_rough_acknowledgement");
  });

  it.each(["pending", "failed", "unknown"] as const)(
    "preserves a published delivery while its notice is %s", status => {
      const release = delivery();
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
        delivery: ready(release), notifications: ready([notice({ status, sentAt: null })]),
      }));
      expect(model.stage).toBe("delivery_issued");
      expect(model.facts.delivery).toEqual(ready(release));
      expect(action(model, "prepare_delivery").blockedBy).toContain("delivery_already_exists");
      expect(action(model, "extend_delivery").blockedBy).toContain("notification_attention");
      expect(reasons(model)).toContain(`notification_${status}`);
    },
  );

  it.each([
    ["2026-10-20T11:59:59.999Z", "receipt_pending"],
    [NOW, "delivery_access_expired"],
    ["2026-10-20T12:00:00.001Z", "delivery_access_expired"],
  ])("uses the delivery expiry boundary at %s", (asOf, expected) => {
    const model = deriveCaseReadModel(snapshot({
      asOf, project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
      delivery: ready(delivery({ expiresAt: NOW, expiryRevision: NOW })),
    }));
    expect(reasons(model)).toContain(expected);
    expect(model.stage).toBe("delivery_issued");
  });

  it("keeps receipt after expiry, missing files and failed completion notification", () => {
    const accepted = receipt();
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "completed" })), payment: ready(payment()),
      delivery: ready(delivery({ expiresAt: RECORDED, manifest: "unverified" })),
      production: unavailable(), receipt: ready(accepted),
      notifications: ready([notice({ purpose: "receipt_notice", status: "failed", sentAt: null })]),
    }));
    expect(model.stage).toBe("received");
    expect(model.facts.receipt).toEqual(ready(accepted));
    expect(reasons(model)).not.toContain("receipt_pending");
    expect(reasons(model)).not.toContain("delivery_access_expired");
    expect(action(model, "extend_delivery").available).toBe(false);
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("preserves explicit legacy receipt without inventing a release", () => {
    const accepted = receipt({ source: "legacy_projection" });
    const model = deriveCaseReadModel(snapshot({ receipt: ready(accepted), delivery: absent() }));
    expect(model.stage).toBe("received");
    expect(model.facts.delivery.state).toBe("absent");
    expect(model.facts.receipt).toEqual(ready(accepted));
  });

  it.each(["manual_record", "historical_registration"] as const)(
    "does not turn %s into a formal customer receipt", source => {
      const model = deriveCaseReadModel(snapshot({ receipt: ready(receipt({ source })) }));
      expect(model.stage).not.toBe("received");
      expect(reasons(model)).toContain("receipt_source_requires_review");
      expect(action(model, "prepare_delivery").available).toBe(false);
    },
  );

  it("flags a receipt attached to a different delivery and prevents a fresh operation", () => {
    const model = deriveCaseReadModel(snapshot({
      payment: ready(payment()), delivery: ready(delivery()), receipt: ready(receipt({ deliveryId: "other-release" })),
    }));
    expect(reasons(model)).toContain("receipt_delivery_mismatch");
    expect(action(model, "extend_delivery").blockedBy).toContain("inconsistent_facts");
    expect(action(model, "prepare_delivery").available).toBe(false);
  });
});

describe("terminal records, external boundaries and independent attention", () => {
  it.each(["closed", "completed"] as const)("blocks fresh business progression for %s without inventing a receipt", rawStatus => {
    const model = deriveCaseReadModel(snapshot({ project: ready(project({ rawStatus })) }));
    expect(model.eligibility).toBe(rawStatus);
    expect(model.stage).not.toBe("received");
    expect(model.actions.filter(item => item.execution === "requires_command_revalidation").every(item => !item.available)).toBe(true);
    expect(action(model, "view_case").available).toBe(true);
  });

  it("does not treat an unspecified completed origin as historical registration", () => {
    const model = deriveCaseReadModel(snapshot({ project: ready(project({ rawStatus: "completed" })) }));
    expect(model.stage).toBe("existing_completion");
    expect(model.eligibility).toBe("completed");
    expect(model.facts.receipt.state).toBe("absent");
  });

  it("keeps explicit historical registration separate from formal receipt", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "completed", origin: "historical", source: "historical_registration" })),
      payment: ready(payment({ method: "historical", source: "historical_registration" })),
    }));
    expect(model.eligibility).toBe("historical");
    expect(model.stage).toBe("historical_record");
    expect(model.facts.receipt.state).toBe("absent");
    expect(model.facts.delivery.state).toBe("absent");
    expect(action(model, "prepare_delivery").blockedBy).toContain("historical_record");
  });

  it.each<Partial<CasePaymentFact>>([
    { source: "historical_registration" },
    { method: "historical" },
  ])("blocks work preparation when historical payment provenance contradicts internal origin: %j", extra => {
    const paid = payment(extra);
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ origin: "internal", rawStatus: "delivery_prep" })),
      payment: ready(paid), production: ready(production()),
    }));
    expect(model.facts.payment).toEqual(ready(paid));
    expect(reasons(model)).toContain("historical_payment_origin_mismatch");
    expect(action(model, "open_production").available).toBe(false);
    expect(action(model, "prepare_delivery").available).toBe(false);
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it.each(["external", "legacy"] as const)("does not call missing internal quote no-agreement for %s origin", origin => {
    const model = deriveCaseReadModel(snapshot({ project: ready(project({ origin })) }));
    expect(model.agreement).toBe("unknown");
    expect(action(model, "prepare_quote").available).toBe(false);
    expect(model.attention.some(item => item.domain === "externalEvidence")).toBe(true);
  });

  it("preserves manual external paid work without requiring a fictitious internal quote", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ origin: "external", rawStatus: "rough" })),
      payment: ready(payment({ method: "manual", source: "manual_record" })),
    }));
    expect(model.stage).toBe("paid");
    expect(model.agreement).toBe("unknown");
    expect(action(model, "open_production").available).toBe(true);
    expect(action(model, "prepare_payment_notice").available).toBe(false);
  });

  it("retains closed-case rough follow-up and new completed-case responses", () => {
    const closed = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "closed" })),
      roughs: ready([rough("old-ok", { clientOkAt: RECORDED })]), consultation: unavailable(),
    }));
    expect(reasons(closed)).toContain("rough_ok_unacknowledged");
    expect(reasons(closed)).toContain("unavailable");
    expect(action(closed, "review_rough").available).toBe(true);
    const completed = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "completed" })), receipt: ready(receipt()),
      consultation: ready(consultation()),
    }));
    expect(reasons(completed)).toContain("response_required");
    expect(action(completed, "view_consultation").available).toBe(true);
    expect(completed.stage).toBe("received");
  });

  it("archives and restores a received case without changing evidence or enabling repeat business", () => {
    const common = { payment: ready(payment()), receipt: ready(receipt()), delivery: ready(delivery()) };
    const archived = deriveCaseReadModel(snapshot({
      ...common, project: ready(project({ rawStatus: "completed", archivedAt: OBSERVED })),
    }));
    const restored = deriveCaseReadModel(snapshot({ ...common, project: ready(project({ rawStatus: "completed" })) }));
    expect(archived.eligibility).toBe("archived");
    expect(restored.eligibility).toBe("completed");
    for (const model of [archived, restored]) {
      expect(model.stage).toBe("received");
      expect(model.facts.payment).toEqual(common.payment);
      expect(model.facts.receipt).toEqual(common.receipt);
      expect(model.actions.filter(item => item.execution === "requires_command_revalidation").every(item => !item.available)).toBe(true);
    }
  });

  it("reopens consideration without reactivating the stopped old link or replacing agreement", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "inquiry" })), quote: ready(acceptedQuote()),
      link: ready(link({ state: "stopped", providerState: "inactive" })),
    }));
    expect(model.agreement).toBe("accepted");
    expect(model.linkValidity).toBe("inactive");
    expect(action(model, "prepare_payment_notice").blockedBy).toContain("link_already_exists");
  });

  it("preserves multiple waiting parties without stopping an unrelated safe reply", () => {
    const model = deriveCaseReadModel(snapshot({
      quote: ready(acceptedQuote()), link: ready(link()), consultation: ready(consultation()),
      roughs: ready([rough()]), operations: ready([operation()]),
      notifications: ready([paymentNotice()]),
    }));
    expect(model.attention).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "payment_pending", waitingOn: "client" }),
      expect.objectContaining({ reason: "response_required", waitingOn: "staff" }),
      expect.objectContaining({ reason: "rough_response_pending", waitingOn: "client" }),
      expect.objectContaining({ reason: "operation_unknown", priority: 0 }),
    ]));
    expect(model.primary).toBe("check_operation");
    expect(action(model, "view_consultation").available).toBe(true);
  });
});

describe("payment waiting requires evidence of the current payment notice", () => {
  const base = () => ({ quote: ready(acceptedQuote()), link: ready(link()) });
  const waiting = (model: CaseReadModel) => model.attention.some(item => item.reason === "payment_pending");
  it.each([ready<readonly CaseNotificationAttempt[]>([]), absent(), {state:"not_requested"} as const,
    unavailable<readonly CaseNotificationAttempt[]>(), unavailable([paymentNotice()])])(
    "keeps link availability without inventing client waiting from missing/stale notices: %j", notifications => {
      const input = snapshot({...base(),notifications}), before = structuredClone(input), model=deriveCaseReadModel(input);
      expect(waiting(model)).toBe(false);
      expect(model.attention).toContainEqual(expect.objectContaining({reason:"payment_notice_unconfirmed",waitingOn:"staff",action:"view_payment"}));
      expect(model.stage).toBe("payment_available");expect(model.linkValidity).toBe("active");
      expect(action(model,"prepare_payment_notice").blockedBy).toContain("link_already_exists");expect(input).toEqual(before);
    });
  it.each(["pending","sending","unknown","failed"] as const)("%s notice is not evidence of provider acceptance", status => {
    const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([paymentNotice({status,sentAt:null})])}));
    expect(waiting(model)).toBe(false);expect(reasons(model)).toContain("payment_notice_unconfirmed");
    expect(reasons(model)).toContain(`notification_${status}`);expect(action(model,"prepare_payment_notice").available).toBe(false);
  });
  it.each(["sent","state_error"] as const)("preserves corresponding ledger and legacy %s acceptance", status => {
    for(const source of ["ledger","legacy_projection"] as const){
      const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([paymentNotice({status,source})])}));
      expect(waiting(model)).toBe(true);expect(reasons(model)).not.toContain("payment_notice_unconfirmed");
      if(status==="state_error")expect(reasons(model)).toContain("notification_projection_review");
    }
  });
  it.each([
    {target:{kind:"payment_link",id:"link-1",revision:RECORDED}},
    {target:{kind:"payment_link",id:"old-generation",revision:FUTURE}},
    {target:{kind:"quote",id:"quote-1",revision:"1"},purpose:"quote_notice"},
    {purpose:"staff_notice"}, {source:"manual_record"}, {source:"historical_registration"},
    {sentAt:"2026-10-22T00:00:00.000Z"},
  ] satisfies Partial<CaseNotificationAttempt>[])("does not infer current sharing from unrelated/invalid evidence: %j", extra=>{
    const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([paymentNotice(extra)])}));
    expect(waiting(model)).toBe(false);expect(reasons(model)).toContain("payment_notice_unconfirmed");
  });
  it("does not use last-known success from a different snapshot as a current client wait",()=>{
    const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([paymentNotice()],{snapshotId:"stale-read"})}));
    expect(waiting(model)).toBe(false);expect(reasons(model)).toContain("inconsistent_snapshot");
  });
  it("a matching success keeps distinct unknown purposes and the ban on preparing another notice",()=>{
    const unknown=notice({id:"other-unknown",notificationKey:"other-purpose",status:"unknown",sentAt:null});
    const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([paymentNotice(),unknown])}));
    expect(waiting(model)).toBe(true);expect(reasons(model)).toContain("notification_unknown");
    expect(model.primary).toBe("review_notification");expect(action(model,"prepare_payment_notice").blockedBy).toContain("notification_attention");
  });
  it("a later failed resend does not erase a known send or permit another preparation",()=>{
    const first=paymentNotice(),failed=paymentNotice({id:"failed-resend",notificationKey:"new-resend",status:"failed",sentAt:null});
    const model=deriveCaseReadModel(snapshot({...base(),notifications:ready([first,failed])}));
    expect(waiting(model)).toBe(true);expect(reasons(model)).toContain("notification_failed");
    expect(action(model,"prepare_payment_notice").blockedBy).toContain("notification_attention");
  });
  it("new raw status or external origin cannot stand in for a payment notice",()=>{
    for(const origin of ["internal","legacy","external","unknown"] as const){
      const model=deriveCaseReadModel(snapshot({...base(),project:ready(project({origin,rawStatus:"awaiting_payment"}))}));
      expect(waiting(model)).toBe(false);expect(reasons(model)).toContain("payment_notice_unconfirmed");
    }
  });
  it("known payment and inactive/expired links do not acquire the new waiting label",()=>{
    for(const extra of [{payment:ready(payment())},{link:ready(link({state:"stopped",providerState:"inactive"}))},{link:ready(link({expiresAt:RECORDED}))}]){
      const model=deriveCaseReadModel(snapshot({...base(),...extra}));
      expect(waiting(model)).toBe(false);expect(reasons(model)).not.toContain("payment_notice_unconfirmed");
    }
  });
});

describe("operation prerequisites and deterministic observations", () => {
  it.each(["pending", "processing", "failed", "unknown"] as const)(
    "does not replace an unresolved %s operation with a new delivery", state => {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()),
        production: ready(production()), operations: ready([operation({ state })]),
      }));
      expect(action(model, "prepare_delivery").blockedBy).toContain("unresolved_operation");
      expect(model.primary).toBe("check_operation");
    },
  );

  it("does not retain operation recovery attention after an explicit succeeded result", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()),
      production: ready(production()), operations: ready([operation({ state: "succeeded" })]),
    }));
    expect(action(model, "prepare_delivery").available).toBe(true);
    expect(model.attention.some(item => item.domain === "operations")).toBe(false);
  });

  it.each(["payment", "production", "delivery", "receipt", "notifications", "operations", "financialReview"] as const)(
    "blocks publication if the required %s domain was not requested", domain => {
      const input = snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()), production: ready(production()),
      });
      input[domain] = { state: "not_requested" };
      const model = deriveCaseReadModel(input);
      expect(action(model, "prepare_delivery").blockedBy).toContain("facts_not_current");
      expect(action(model, "view_consultation").available).toBe(true);
    },
  );

  it("changes fingerprint when only a notice changes while project revision stays the same", () => {
    const common = snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()), delivery: ready(delivery()),
    });
    const before = deriveCaseReadModel({ ...common, notifications: ready([notice({ status: "unknown", sentAt: null })]) });
    const after = deriveCaseReadModel({ ...common, notifications: ready([notice()]) });
    expect(before.facts.project).toEqual(after.facts.project);
    expect(before.fingerprint).not.toBe(after.fingerprint);
    expect(reasons(before)).toContain("notification_unknown");
    expect(reasons(after)).not.toContain("notification_unknown");
  });

  it("does not count a receipt email as delivery-issue notification success", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
      delivery: ready(delivery()), notifications: ready([notice({ purpose: "receipt_notice" })]),
    }));
    const summary = model.notifications.find(item => item.target.kind === "delivery" && item.target.id === "delivery-1");
    expect(summary?.currentSuccessIds).toEqual([]);
    expect(reasons(model)).toContain("current_notice_unconfirmed");
  });

  it("keeps previous delivery success when a later re-notification failed", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()), delivery: ready(delivery()),
      notifications: ready([
        notice(),
        notice({ id: "notice-2", notificationKey: "delivery-notice-2", operationId: "operation-2", recordedAt: OBSERVED, status: "failed", sentAt: null }),
      ]),
    }));
    const summary = model.notifications.find(item => item.target.id === "delivery-1");
    expect(summary?.currentSuccessIds).toContain("notice-1");
    expect(summary?.failedIds).toContain("notice-2");
    expect(model.stage).toBe("delivery_issued");
    expect(reasons(model)).not.toContain("current_notice_unconfirmed");
    expect(reasons(model)).toContain("notification_failed");
  });

  it("does not reuse old-expiry success for an extended delivery", () => {
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
      delivery: ready(delivery()),
      notifications: ready([notice({ target: { kind: "delivery", id: "delivery-1", revision: RECORDED } })]),
    }));
    const summary = model.notifications.find(item => item.target.id === "delivery-1");
    expect(summary?.pastSuccessIds).toContain("notice-1");
    expect(summary?.currentSuccessIds).toEqual([]);
    expect(reasons(model)).toContain("current_notice_unconfirmed");
  });

  it("keeps an old quote's unresolved notice without labelling it the current unconfirmed notice", () => {
    const model = deriveCaseReadModel(snapshot({
      quote: ready(quote()),
      notifications: ready([notice({
        id: "old-quote-notice", target: { kind: "quote", id: "superseded-quote", revision: "1" },
        purpose: "quote_notice", notificationKey: "old-quote-key", status: "unknown", sentAt: null,
      })]),
    }));
    expect(model.attention).toContainEqual(expect.objectContaining({
      domain: "notifications", targetId: "old-quote-notice", reason: "notification_unknown",
    }));
    expect(model.attention.filter(item => item.reason === "current_notice_unconfirmed").map(item => item.targetId))
      .toEqual(["quote-1"]);
    expect(action(model, "prepare_quote").available).toBe(false);
  });

  it("is reproducible, does not mutate frozen input, and orders attention independently of row order", () => {
    const input = snapshot({
      payment: ready(payment()), consultation: ready(consultation()),
      roughs: ready([rough("rough-b", { clientOkAt: RECORDED }), rough("rough-a")]),
      financialReview: ready([financial("refund_pending", "review-b"), financial("payment_review", "review-a")]),
      operations: ready([operation({ id: "op-b" }), operation({ id: "op-a", state: "processing" })]),
    });
    const before = JSON.stringify(input);
    freeze(input);
    const first = deriveCaseReadModel(input);
    const second = deriveCaseReadModel(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
    const reversed = snapshot({
      ...input,
      roughs: ready([rough("rough-a"), rough("rough-b", { clientOkAt: RECORDED })]),
      financialReview: ready([financial("payment_review", "review-a"), financial("refund_pending", "review-b")]),
      operations: ready([operation({ id: "op-a", state: "processing" }), operation({ id: "op-b" })]),
    });
    const reordered = deriveCaseReadModel(reversed);
    expect(reordered.attention).toEqual(first.attention);
    expect(reordered.primary).toEqual(first.primary);
    expect(reordered.fingerprint).toEqual(first.fingerprint);
    expect(new Set(first.attention.map(item => item.key)).size).toBe(first.attention.length);
    expect(first.attention.map(item => item.priority)).toEqual([...first.attention.map(item => item.priority)].sort());
  });
});

describe("evidence provenance and observation-time boundaries", () => {
  const AFTER_OBSERVATION = "2026-10-20T11:59:00.001Z";
  const SAME_OBSERVATION_WITH_OFFSET = "2026-10-20T20:59:00.000+09:00";

  it.each(["manual_record", "historical_registration"] as const)(
    "does not elevate a %s quote to formal acceptance, including cached evidence", source => {
      const value = acceptedQuote({ source });
      for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
        const model = deriveCaseReadModel(snapshot({ quote: observed }));
        expect(model.agreement).toBe("needs_review");
        expect(model.stage).not.toBe("quote_accepted");
        expect(model.stage).not.toBe("quote_issued");
        expect(reasons(model)).toContain("quote_source_requires_review");
        expect(action(model, "prepare_payment_notice").available).toBe(false);
        expect(model.facts.quote).toEqual(observed);
      }
    },
  );

  it("continues to recognize matching legacy quote acceptance without manufacturing new evidence", () => {
    const value = acceptedQuote({ source: "legacy_projection" });
    const model = deriveCaseReadModel(snapshot({ quote: ready(value) }));
    expect(model.agreement).toBe("accepted");
    expect(model.stage).toBe("quote_accepted");
    expect(model.facts.quote).toEqual(ready(value));
    expect(reasons(model)).not.toContain("quote_source_requires_review");
  });

  it.each(["legacy_projection", "manual_record", "historical_registration"] as const)(
    "requires ledger provenance before declaring a %s link active", source => {
      const value = link({ source });
      const model = deriveCaseReadModel(snapshot({ quote: ready(acceptedQuote()), link: ready(value) }));
      expect(model.linkValidity).toBe("needs_review");
      expect(model.stage).not.toBe("payment_available");
      expect(reasons(model)).toContain("link_evidence_requires_review");
      expect(reasons(model)).not.toContain("payment_pending");
      expect(model.facts.link).toEqual(ready(value));
      expect(action(model, "prepare_payment_notice").available).toBe(false);
    },
  );

  it.each(["manual_record", "historical_registration", "legacy_projection"] as const)(
    "does not declare a %s release formally published", source => {
      const value = delivery({ kind: "release", source });
      for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
        const model = deriveCaseReadModel(snapshot({
          project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()), delivery: observed,
        }));
        expect(model.stage).toBe("paid");
        expect(reasons(model)).toContain("delivery_source_requires_review");
        expect(action(model, "extend_delivery").available).toBe(false);
        expect(action(model, "prepare_delivery").available).toBe(false);
        expect(model.facts.delivery).toEqual(observed);
      }
    },
  );

  it("preserves a legacy delivery as legacy evidence without making it extendable", () => {
    const value = delivery({ kind: "legacy", source: "legacy_projection", manifest: "unverified" });
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()), delivery: ready(value),
    }));
    expect(model.stage).toBe("delivery_issued");
    expect(model.facts.delivery).toEqual(ready(value));
    expect(reasons(model)).not.toContain("delivery_source_requires_review");
    expect(action(model, "extend_delivery").blockedBy).toContain("legacy_evidence_required");
  });

  it.each(["legacy_projection", "historical_registration"] as const)(
    "does not use %s production projections to prepare formal delivery", source => {
      const value = production({ source });
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), payment: ready(payment()),
        production: ready(value),
      }));
      expect(model.stage).toBe("paid");
      expect(action(model, "prepare_delivery").available).toBe(false);
      expect(action(model, "prepare_delivery").blockedBy).toContain("inconsistent_facts");
      expect(reasons(model)).toContain("production_source_requires_review");
      expect(model.facts.production).toEqual(ready(value));
    },
  );

  it("rejects a fact recorded after its observation even when it predates the overall snapshot clock", () => {
    const value = payment({ recordedAt: AFTER_OBSERVATION, confirmedAt: RECORDED });
    for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
      const model = deriveCaseReadModel(snapshot({ payment: observed }));
      expect(model.stage).not.toBe("paid");
      expect(model.facts.payment).toEqual({ state: "unavailable", reason: "incomplete" });
      expect(reasons(model)).toContain("invalid_fact_identity");
      expect(action(model, "open_production").available).toBe(false);
    }
  });

  it("rejects acceptance after its observation rather than accepting it because asOf is later", () => {
    const value = acceptedQuote();
    value.acceptance = { ...value.acceptance!, acceptedAt: AFTER_OBSERVATION };
    for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
      const model = deriveCaseReadModel(snapshot({ quote: observed }));
      expect(model.agreement).toBe("needs_review");
      expect(model.stage).not.toBe("quote_accepted");
      expect(reasons(model)).toContain("acceptance_target_mismatch");
      expect(action(model, "prepare_payment_notice").available).toBe(false);
    }
  });

  it("rejects payment confirmation after its observation without allowing work preparation", () => {
    const value = payment({ confirmedAt: AFTER_OBSERVATION });
    for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivery_prep" })), production: ready(production()), payment: observed,
      }));
      expect(model.stage).not.toBe("paid");
      expect(reasons(model)).toContain("invalid_payment");
      expect(action(model, "open_production").available).toBe(false);
      expect(action(model, "prepare_delivery").available).toBe(false);
    }
  });

  it("rejects receipt after its observation while retaining independent delivery evidence", () => {
    const value = receipt({ acceptedAt: AFTER_OBSERVATION });
    for (const observed of [ready(value), unavailable(value, OBSERVED)]) {
      const model = deriveCaseReadModel(snapshot({
        project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
        delivery: ready(delivery()), receipt: observed,
      }));
      expect(model.stage).toBe("delivery_issued");
      expect(reasons(model)).toContain("invalid_receipt");
      expect(action(model, "extend_delivery").available).toBe(false);
    }
  });

  it.each([
    { clientOkAt: AFTER_OBSERVATION, acknowledgedAt: null },
    { clientOkAt: RECORDED, acknowledgedAt: AFTER_OBSERVATION },
  ])("flags rough business timestamps after their observation: %j", extra => {
    const rows = [rough("rough-1", extra)];
    for (const observed of [ready(rows), unavailable(rows, OBSERVED)]) {
      const model = deriveCaseReadModel(snapshot({ roughs: observed }));
      expect(reasons(model)).toContain("invalid_rough_acknowledgement");
      expect(model.stage).not.toBe("received");
      expect(model.agreement).toBe("absent");
    }
  });

  it.each([OBSERVED, SAME_OBSERVATION_WITH_OFFSET])(
    "accepts business events exactly at their observation instant: %s", stamp => {
      const selected = acceptedQuote();
      selected.acceptance = { ...selected.acceptance!, acceptedAt: stamp };
      const model = deriveCaseReadModel(snapshot({
        quote: ready(selected), payment: ready(payment({ confirmedAt: stamp })),
        delivery: ready(delivery()), receipt: ready(receipt({ acceptedAt: stamp })),
        roughs: ready([rough("rough-1", { clientOkAt: stamp, acknowledgedAt: stamp })]),
        notifications: ready([notice({ sentAt: stamp })]),
      }));
      expect(model.agreement).toBe("accepted");
      expect(model.stage).toBe("received");
      expect(model.issues).toEqual([]);
      expect(model.notifications.find(item => item.target.id === "delivery-1")?.currentSuccessIds).toEqual(["notice-1"]);
    },
  );

  it.each([AFTER_OBSERVATION, FUTURE])(
    "excludes notification success at %s after observation or asOf without losing prior valid success", sentAt => {
      const previous = notice({ id: "valid-notice" });
      const invalid = notice({
        id: "future-notice", notificationKey: "future-notice-key", operationId: "future-operation", sentAt,
      });
      const rows = [previous, invalid];
      for (const observed of [ready(rows), unavailable(rows, OBSERVED)]) {
        const model = deriveCaseReadModel(snapshot({
          project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
          delivery: ready(delivery()), notifications: observed,
        }));
        const summary = model.notifications.find(item => item.target.id === "delivery-1");
        expect(summary?.pastSuccessIds).toEqual(["valid-notice"]);
        expect(summary?.currentSuccessIds).toEqual(["valid-notice"]);
        expect(summary?.latestAttemptId).not.toBe("future-notice");
        expect(model.issues).toContainEqual({
          domain: "notifications", code: "invalid_notification_sent_at", targetId: "future-notice",
        });
        expect(model.stage).toBe("delivery_issued");
        expect(action(model, "extend_delivery").available).toBe(false);
        expect(model.facts.notifications).toEqual(observed);
      }
    },
  );

  it("does not let an invalid future success resolve an existing unknown notification", () => {
    const unknown = notice({
      id: "unknown-notice", status: "unknown", sentAt: null, resolvedByAttemptId: "future-notice",
    });
    const futureSuccess = notice({
      id: "future-notice", attemptNo: 2, sentAt: AFTER_OBSERVATION,
    });
    const model = deriveCaseReadModel(snapshot({
      project: ready(project({ rawStatus: "delivered" })), payment: ready(payment()),
      delivery: ready(delivery()), notifications: ready([unknown, futureSuccess]),
    }));
    const summary = model.notifications.find(item => item.target.id === "delivery-1");
    expect(summary?.currentSuccessIds).toEqual([]);
    expect(summary?.unresolvedIds).toContain("unknown-notice");
    expect(reasons(model)).toContain("notification_unknown");
    expect(reasons(model)).toContain("invalid_notification_sent_at");
    expect(action(model, "extend_delivery").available).toBe(false);
  });

  it.each([
    { kind: "quote" as const, id: "", revision: "1" },
    { kind: "quote" as const, id: "quote-not-in-current-domain", revision: "" },
  ])("retains invalid notification-target evidence even when no current object can produce a summary: %j", target => {
    const model = deriveCaseReadModel(snapshot({
      notifications: ready([notice({
        id: "unresolved-notice", purpose: "quote_notice", target, status: "unknown", sentAt: null,
      })]),
    }));
    expect(model.facts.quote.state).toBe("absent");
    expect(model.facts.link.state).toBe("absent");
    expect(model.facts.delivery.state).toBe("absent");
    expect(model.issues).toContainEqual({
      domain: "notifications", code: "invalid_notification_target", targetId: "unresolved-notice",
    });
    expect(action(model, "prepare_quote").available).toBe(false);
    expect(action(model, "prepare_quote").blockedBy).toContain("inconsistent_facts");
    expect(model.attention.some(item => item.domain === "notifications" && item.action === "review_evidence")).toBe(true);
  });

  it.each([
    { kind: "quote" as const, id: "", revision: "1" },
    { kind: "quote" as const, id: "quote-not-in-current-domain", revision: "" },
  ])("retains invalid operation-target evidence without current quote, link or delivery: %j", target => {
    const model = deriveCaseReadModel(snapshot({
      operations: ready([operation({ id: "unresolved-operation", target })]),
    }));
    expect(model.issues).toContainEqual({
      domain: "operations", code: "invalid_operation_target", targetId: "unresolved-operation",
    });
    expect(action(model, "prepare_quote").available).toBe(false);
    expect(action(model, "prepare_quote").blockedBy).toContain("inconsistent_facts");
    expect(reasons(model)).toContain("operation_unknown");
    expect(action(model, "check_operation").available).toBe(true);
  });

  it.each([
    "2026-02-29T10:00:00.000Z",
    "2026-02-30T10:00:00.000Z",
    "2026-10-19T24:00:00.000Z",
    "2026-10-19T10:00:00",
    "2026-10-19",
  ])("rejects malformed calendar/time values instead of Date.parse normalization: %s", stamp => {
    const selected = acceptedQuote();
    selected.acceptance = { ...selected.acceptance!, acceptedAt: stamp };
    const model = deriveCaseReadModel(snapshot({
      quote: ready(selected), payment: ready(payment({ confirmedAt: stamp })),
      receipt: ready(receipt({ acceptedAt: stamp })),
      roughs: ready([rough("rough-1", { clientOkAt: stamp })]),
      delivery: ready(delivery({ expiresAt: stamp })),
      notifications: ready([notice({ sentAt: stamp })]),
    }));
    expect(model.agreement).toBe("needs_review");
    expect(model.stage).not.toBe("paid");
    expect(model.stage).not.toBe("received");
    expect(reasons(model)).toEqual(expect.arrayContaining([
      "acceptance_target_mismatch", "invalid_payment", "invalid_receipt",
      "invalid_rough_acknowledgement", "invalid_delivery_expiry", "invalid_notification_sent_at",
    ]));
    expect(model.notifications.flatMap(item => item.currentSuccessIds)).toEqual([]);
    expect(model.actions.filter(item => item.execution === "requires_command_revalidation").every(item => !item.available)).toBe(true);
  });

  it("rejects an impossible asOf date even though JavaScript normalizes it", () => {
    const model = deriveCaseReadModel(snapshot({ asOf: "2026-02-30T12:00:00.000Z" }));
    expect(reasons(model)).toContain("invalid_as_of");
    expect(model.actions.filter(item => item.execution === "requires_command_revalidation").every(item => !item.available)).toBe(true);
  });

  it("rejects impossible observed and recorded calendar dates before making business assertions", () => {
    for (const observed of [
      ready(payment(), { observedAt: "2026-02-30T10:00:00.000Z" }),
      ready(payment({ recordedAt: "2026-02-30T10:00:00.000Z" })),
    ]) {
      const model = deriveCaseReadModel(snapshot({ payment: observed }));
      expect(model.stage).not.toBe("paid");
      expect(model.facts.payment.state).toBe("unavailable");
      expect(reasons(model)).toContain("invalid_fact_identity");
    }
  });
});

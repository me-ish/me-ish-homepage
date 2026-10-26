import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
const m = vi.hoisted(() => ({
  account: vi.fn(),
  context: vi.fn(),
  receive: vi.fn(),
  claim: vi.fn(),
  paid: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("stripe")>();
  class FixtureStripe extends original.default {
    constructor(...args: ConstructorParameters<typeof original.default>) {
      super(...args);
      this.accounts.retrieve = m.account as typeof this.accounts.retrieve;
    }
  }
  return { ...original, default: FixtureStripe };
});
vi.mock("@/features/natori/server/caseAcceptance", () => ({
  acceptanceContext: m.context,
  acceptanceStripeKey: () => "sk_test_synthetic_fixture",
}));
vi.mock("@/features/natori/server/paymentEventService", () => ({
  paymentIntegrityEnabled: () => true,
  refundLedgerEnabled: () => false,
  refundLedgerReadEnabled: () => false,
  receiveNatoriPaymentEvent: m.receive,
}));
vi.mock("@/lib/stripe/processedEvents", () => ({
  claimStripeEvent: m.claim,
  releaseStripeEvent: vi.fn(),
}));
vi.mock("@/features/natori/server/orderMailService", () => ({
  markNatoriCommissionPaid: m.paid,
}));
import { POST } from "../route";
const owner = "22222222-2222-4222-8222-222222222222",
  project = "33333333-3333-4333-8333-333333333333",
  run = "44444444-4444-4444-8444-444444444444";
const secret = "whsec_synthetic_signature_fixture",
  signer = new Stripe("sk_test_synthetic_fixture");
const created = Math.floor(Date.now() / 1000);
const event = () => ({
  id: "evt_fixture",
  object: "event",
  type: "checkout.session.completed",
  livemode: false,
  created,
  data: {
    object: {
      id: "cs_test_fixture",
      object: "checkout.session",
      livemode: false,
      status: "complete",
      payment_status: "paid",
      amount_total: 12000,
      currency: "jpy",
      payment_intent: "pi_fixture",
      metadata: {
        kind: "natori_commission",
        projectId: project,
        quoteId: owner,
      },
    },
  },
});
const request = (
  body: ReturnType<typeof event>,
  invalid = false,
  stale = false,
) => {
  const raw = JSON.stringify(body),
    sig = signer.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      ...(stale ? { timestamp: Math.floor(Date.now() / 1000) - 301 } : {}),
    });
  return new NextRequest("http://localhost:4195/api/webhook/stripe", {
    method: "POST",
    body: raw + (invalid ? " " : ""),
    headers: { "stripe-signature": sig },
  });
};
beforeEach(() => {
  vi.clearAllMocks();
  const target = JSON.stringify({
    profile: "local",
    ref: "local",
    project: "local-fixture",
    url: "http://localhost:4193",
    origin: "http://localhost:4195",
    run,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
  });
  for (const [key, value] of Object.entries({
    NATORI_CASE_ACCEPTANCE_TARGET: target,
    NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET: target,
    SUPABASE_URL: "http://localhost:4193",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:4193",
    VERCEL_ENV: "",
    NATORI_OWNER_USER_ID: owner,
    STRIPE_WEBHOOK_SECRET: secret,
  }))
    vi.stubEnv(key, value);
  m.account.mockResolvedValue({ id: "acct_fixture" });
  m.context.mockResolvedValue({ account: "acct_fixture", active: true });
  m.receive.mockResolvedValue({ status: 200, result: "completed" });
});
afterEach(() => vi.unstubAllEnvs());
describe("dedicated Stripe webhook scope; real signature SDK / mocked account and consumer", () => {
  it("verified scoped test event enters only the durable Natori inbox", async () => {
    expect((await POST(request(event()))).status).toBe(200);
    expect(m.receive).toHaveBeenCalledExactlyOnceWith(event());
    expect(m.claim).not.toHaveBeenCalled();
    expect(m.paid).not.toHaveBeenCalled();
  });
  it.each(["raw", "timestamp"])(
    "rejects invalid %s signature before DB or account retrieval",
    async (kind) => {
      expect(
        (await POST(request(event(), kind === "raw", kind === "timestamp")))
          .status,
      ).toBe(400);
      expect(m.account).not.toHaveBeenCalled();
      expect(m.context).not.toHaveBeenCalled();
      expect(m.receive).not.toHaveBeenCalled();
    },
  );
  it.each(["live", "object-live", "Connect", "other-product"])(
    "rejects %s before consumer",
    async (kind) => {
      const e = event();
      if (kind === "live") e.livemode = true;
      if (kind === "object-live") e.data.object.livemode = true;
      if (kind === "other-product") e.data.object.metadata.kind = "gallery";
      const raw = kind === "Connect" ? { ...e, account: "acct_other" } : e;
      expect((await POST(request(raw))).status).toBe(400);
      expect(m.receive).not.toHaveBeenCalled();
    },
  );
  it("foreign/unlisted project cannot enter even with a valid account signature", async () => {
    m.context.mockResolvedValue(null);
    expect((await POST(request(event()))).status).toBe(400);
    expect(m.receive).not.toHaveBeenCalled();
  });
  it("different credential account fails closed before consumer", async () => {
    m.account.mockResolvedValue({ id: "acct_other" });
    expect((await POST(request(event()))).status).toBe(400);
    expect(m.receive).not.toHaveBeenCalled();
  });
  it("paused run still records signed late payment but does not call legacy writers", async () => {
    m.context.mockResolvedValue({ account: "acct_fixture", active: false });
    expect((await POST(request(event()))).status).toBe(200);
    expect(m.receive).toHaveBeenCalledOnce();
    expect(m.paid).not.toHaveBeenCalled();
  });
});

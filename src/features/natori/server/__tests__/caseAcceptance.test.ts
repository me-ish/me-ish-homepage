import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => m }));
import {
  assertServerAcceptanceTarget,
  assertAcceptanceLegacyMailDisabled,
} from "@/lib/caseAcceptanceEnvironment";
import {
  parseCaseAcceptanceTarget,
  PRODUCTION_SUPABASE_REF,
  PRODUCTION_VERCEL_PROJECT,
} from "../../lib/caseAcceptanceTarget";
import { assertAcceptanceMailLinks } from "../caseAcceptanceMail";
import { acceptanceManagementRequestAllowed } from "../caseAcceptance";
import { caseWorkspaceReadAvailable } from "../caseWorkspaceRead";
import {
  receiveCaseMailWebhook,
  verifyCaseMailSignature,
} from "../caseMailWebhook";
import { createAcceptanceReconciliationProvider } from "../caseReconciliationAdapter";
import {
  evidenceCanApply,
  type ReconciliationIdentity,
} from "../../lib/caseReconciliation";
const owner = "22222222-2222-4222-8222-222222222222",
  project = "33333333-3333-4333-8333-333333333333",
  run = "44444444-4444-4444-8444-444444444444",
  job = "55555555-5555-4555-8555-555555555555";
const now = Date.now(),
  target = {
    profile: "local",
    ref: "local",
    project: "local-fixture",
    url: "http://localhost:4193",
    origin: "http://localhost:4195",
    run,
    startsAt: new Date(now - 60000).toISOString(),
    endsAt: new Date(now + 3600000).toISOString(),
  };
const configure = (t = target) => {
  const raw = JSON.stringify(t);
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET", raw);
  vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET", raw);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", t.url);
  vi.stubEnv("SUPABASE_URL", t.url);
};
beforeEach(() => {
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET", "");
  vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:4193");
});
afterEach(() => vi.unstubAllEnvs());
describe("dedicated target gate", () => {
  it("permits only the filtered read-only notice index, retaining the personal-event run boundary",async()=>{
    configure();
    const request=(query:string)=>new Request(`http://localhost:4195/api/natori/admin/case-workspace/entries?${query}`);
    expect(await acceptanceManagementRequestAllowed("case-entry-index.GET",[request("kind=notices")],false)).toBe(true);
    expect(await acceptanceManagementRequestAllowed("case-entry-index.GET",[request("kind=events")],false)).toBe(false);
    expect(await acceptanceManagementRequestAllowed("case-entry-index.GET",[request("kind=notices&kind=events")],false)).toBe(false);
    expect(await acceptanceManagementRequestAllowed("case-entry-index.GET",[request("kind=notices")],true)).toBe(false);
  });
  it("keeps ordinary production closed and accepts explicit local production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(caseWorkspaceReadAvailable()).toBe(false);
    configure();
    expect(caseWorkspaceReadAvailable()).toBe(true);
    expect(assertServerAcceptanceTarget()?.run).toBe(run);
  });
  it.each([
    "NATORI_CASE_ACCEPTANCE_TARGET",
    "NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",
  ])("one-sided marker %s cannot fall back", (name) => {
    configure();
    vi.stubEnv(name, "");
    expect(() => assertServerAcceptanceTarget()).toThrow();
    expect(caseWorkspaceReadAvailable()).toBe(false);
  });
  it("build/runtime mismatch, Vercel production and mixed DB URLs reject", () => {
    configure();
    vi.stubEnv("SUPABASE_URL", "http://localhost:9999");
    expect(() => assertServerAcceptanceTarget()).toThrow();
    configure();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => assertServerAcceptanceTarget()).toThrow();
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv(
      "NATORI_CASE_ACCEPTANCE_TARGET",
      JSON.stringify({ ...target, run: job }),
    );
    expect(caseWorkspaceReadAvailable()).toBe(false);
  });
  it("expired target permits evidence reads but blocks new transport and legacy direct SDK", () => {
    configure({ ...target, endsAt: new Date(now - 1000).toISOString() });
    expect(assertServerAcceptanceTarget(true)).toBeTruthy();
    expect(() => assertServerAcceptanceTarget()).toThrow();
    expect(caseWorkspaceReadAvailable()).toBe(true);
    expect(() => assertAcceptanceLegacyMailDisabled()).toThrow();
  });
  it.each([
    { ref: PRODUCTION_SUPABASE_REF },
    { project: PRODUCTION_VERCEL_PROJECT },
    { url: `https://${PRODUCTION_SUPABASE_REF}.supabase.co` },
    { origin: "https://www.me-ish.art" },
    { url: "http://localhost:4193@evil.invalid" },
    { origin: "http://localhost:4195/path" },
  ])("rejects forbidden identity %j", (patch) => {
    const t = { ...target, ...patch };
    expect(() => parseCaseAcceptanceTarget(JSON.stringify(t), t.url)).toThrow();
  });
  it("hosted target requires exact preview project and does not rely on NODE_ENV", () => {
    const t = {
      ...target,
      profile: "hosted",
      ref: "abcdefghijklmnopqrst",
      project: "prj_fixture",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      origin: "https://acceptance.example.invalid",
    };
    configure(t);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertServerAcceptanceTarget()).toThrow();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_PROJECT_ID", t.project);
    expect(assertServerAcceptanceTarget()?.ref).toBe(t.ref);
  });
  it("default dev cannot point to hosted production", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
    );
    expect(caseWorkspaceReadAvailable()).toBe(false);
  });
});
const secret =
  "whsec_" +
  Buffer.from("synthetic-webhook-fixture-key-only").toString("base64");
const event = () => ({
  type: "email.sent",
  created_at: new Date().toISOString(),
  data: {
    email_id: "mail_fixture",
    tags: { natori_job: job, natori_run: run, natori_hash: "a".repeat(64) },
  },
});
const signed = (
  raw: string,
  stamp = Math.floor(Date.now() / 1000),
  id = "msg_fixture",
) =>
  new Headers({
    "svix-id": id,
    "svix-timestamp": String(stamp),
    "svix-signature":
      "v1," +
      createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
        .update(`${id}.${stamp}.${raw}`)
        .digest("base64"),
  });
describe("signed Resend inbox boundary", () => {
  beforeEach(() => {
    configure();
    vi.stubEnv("NATORI_CASE_ACCEPTANCE_MAIL_SCOPE", "resend-fixture");
    vi.stubEnv("NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET", secret);
  });
  it("uses exact raw body, event identity and durable correlation without passing body/address", async () => {
    const raw = JSON.stringify(event()),
      call = vi.fn(async () => ({ result: "recorded" }));
    expect(await receiveCaseMailWebhook(raw, signed(raw), call)).toEqual({
      result: "recorded",
    });
    expect(call.mock.calls[0]).toMatchObject([
      "natori_case_mail_event_v1",
      {
        p_job: job,
        p_scope: "resend-fixture",
        p_run: run,
        p_provider: "mail_fixture",
        p_request_hash: "a".repeat(64),
      },
    ]);
    expect(JSON.stringify(call.mock.calls)).not.toContain("created_at");
    expect(() =>
      verifyCaseMailSignature(raw + " ", signed(raw), secret),
    ).toThrow();
  });
  it.each([-301, 301])(
    "rejects timestamp outside replay tolerance %s",
    (delta) => {
      const raw = JSON.stringify(event());
      expect(() =>
        verifyCaseMailSignature(
          raw,
          signed(raw, Math.floor(Date.now() / 1000) + delta),
          secret,
        ),
      ).toThrow();
    },
  );
  it("signature, scope, duplicate tag and malformed body cannot reach SQL", async () => {
    const call = vi.fn(async () => ({ result: "recorded" }));
    let raw = JSON.stringify(event());
    await expect(
      receiveCaseMailWebhook(raw, signed("other"), call),
    ).rejects.toThrow();
    raw = JSON.stringify({
      ...event(),
      data: {
        ...event().data,
        tags: { ...event().data.tags, natori_run: owner },
      },
    });
    await expect(
      receiveCaseMailWebhook(raw, signed(raw), call),
    ).rejects.toThrow();
    raw = JSON.stringify({
      ...event(),
      data: {
        ...event().data,
        tags: [
          { name: "natori_job", value: job },
          { name: "natori_job", value: job },
        ],
      },
    });
    await expect(
      receiveCaseMailWebhook(raw, signed(raw), call),
    ).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it("late stopped-run evidence and duplicate delivery are acknowledged without initiating a send", async () => {
    configure({ ...target, endsAt: new Date(now - 1000).toISOString() });
    const e = { ...event(), type: "email.delivered" },
      raw = JSON.stringify(e),
      call = vi.fn(async () => ({ result: "duplicate" }));
    expect((await receiveCaseMailWebhook(raw, signed(raw), call)).result).toBe(
      "duplicate",
    );
    expect(call).toHaveBeenCalledOnce();
  });
});
const identity: ReconciliationIdentity = {
  owner,
  project,
  target: job,
  quote: owner,
  account: "acct_fixture",
  scope: "platform",
  livemode: false,
  amount: 12000,
  currency: "jpy",
  purpose: "natori_commission",
  key: "natori-plink/fixture/link",
  attempt: run,
  generation: 1,
  requestHash: "b".repeat(64),
  price: "price_fixture",
  link: "plink_fixture",
};
const metadata = {
  kind: "natori_commission",
  projectId: project,
  quoteId: owner,
  attemptId: run,
  generation: "1",
};
const price = {
  id: "price_fixture",
  unit_amount: 12000,
  currency: "jpy",
  metadata,
  livemode: false,
};
function adapter() {
  let active = true;
  const ctx = vi.fn(async () => ({
    scope: "resend-fixture",
    account: "acct_fixture",
    active,
    target: { run },
  }));
  const fence = vi.fn(async () => {}),
    fetcher = vi.fn<typeof fetch>(async (input, options) => {
      const u = new URL(String(input)),
        p = u.pathname;
      if (p === "/v1/account") return Response.json({ id: "acct_fixture" });
      if (p === "/v1/prices/price_fixture") return Response.json(price);
      if (p === "/v1/payment_links/plink_fixture/line_items")
        return Response.json({
          has_more: false,
          data: [{ quantity: 1, price }],
        });
      if (p === "/v1/payment_links/plink_fixture") {
        if (options?.method === "POST") active = false;
        return Response.json({
          id: "plink_fixture",
          url: "https://buy.stripe.com/fixture",
          metadata,
          active,
          livemode: false,
        });
      }
      if (p === "/v1/checkout/sessions")
        return Response.json({ has_more: false, data: [] });
      return Response.json({}, { status: 404 });
    });
  const mail = vi.fn(async () => ({
    reference: "mail_fixture",
    occurredAt: new Date().toISOString(),
    requestHash: "b".repeat(64),
    scope: "resend-fixture",
    run,
  }));
  const key = vi.fn(() => "sk_test_synthetic");
  return {
    ctx,
    fence,
    fetcher,
    key,
    mail,
    p: createAcceptanceReconciliationProvider({
      context: ctx,
      fetch: fetcher,
      key,
      mail,
      beforeMutation: fence,
    }),
  };
}
describe("real adapter through synthetic HTTP transport", () => {
  it.each(["price", "link"] as const)(
    "retrieves exact scoped %s object",
    async (kind) => {
      const a = adapter(),
        f = await a.p.inspect(kind, identity);
      expect(f.state).toBe("confirmed");
      expect(evidenceCanApply(kind, f)).toBe(true);
      expect(
        a.fetcher.mock.calls.every((c) =>
          String(c[0]).startsWith("https://api.stripe.com/v1/"),
        ),
      ).toBe(true);
    },
  );
  it.each([
    { account: "acct_other" },
    { livemode: true },
    { amount: 1 },
    { project: owner },
    { quote: project },
    { generation: 2 },
  ])("does not confirm mismatched object %j", async (patch) => {
    const a = adapter();
    expect((await a.p.inspect("link", { ...identity, ...patch })).state).toBe(
      "unknown",
    );
  });
  it("404 and empty sessions never grant nonexecution or payment proof", async () => {
    const a = adapter();
    expect(
      (await a.p.inspect("price", { ...identity, price: "price_missing" }))
        .limits,
    ).toEqual(["not_found"]);
    expect((await a.p.inspect("payment", identity)).state).toBe("unknown");
  });
  it("incomplete pagination and multiple matching objects remain unresolved", async () => {
    for (const multiple of [false, true]) {
      const a = adapter();
      a.fetcher.mockImplementation(async (input) =>
        String(input).endsWith("/account")
          ? Response.json({ id: "acct_fixture" })
          : Response.json({
              has_more: !multiple,
              data: multiple ? [price, price] : [price],
            }),
      );
      expect(
        (await a.p.inspect("price", { ...identity, price: null })).limits,
      ).toEqual([multiple ? "multiple" : "pagination"]);
    }
  });
  it("live key fails before any HTTP request", async () => {
    const a = adapter();
    a.key.mockReturnValue("sk_live_forbidden");
    expect((await a.p.inspect("link", identity)).state).toBe("unknown");
    expect(a.fetcher).not.toHaveBeenCalled();
  });
  it("stop is a separate confirmed operation; every mutation has fresh DB fence/account and never applies DB evidence", async () => {
    const a = adapter(),
      f = await a.p.stopOldLink(identity);
    expect(f.outcome).toBe("stopped");
    expect(f.sessionsSafe).toBe(true);
    expect(a.fence).toHaveBeenCalledOnce();
    expect(
      a.fetcher.mock.calls.filter((c) => c[1]?.method === "POST"),
    ).toHaveLength(1);
  });
  it.each(["kill", "lease", "abort"])(
    "%s between inspection and mutation blocks POST",
    async (reason) => {
      const a = adapter(),
        controller = new AbortController();
      a.fence.mockImplementation(async () => {
        if (reason === "abort") controller.abort();
        else throw Error(reason);
      });
      expect((await a.p.stopOldLink(identity, controller.signal)).state).toBe(
        "unknown",
      );
      expect(
        a.fetcher.mock.calls.filter((c) => c[1]?.method === "POST"),
      ).toHaveLength(0);
    },
  );
  it("stopped run can inspect facts but cannot mutate", async () => {
    const a = adapter();
    a.ctx.mockResolvedValue({
      scope: "resend-fixture",
      account: "acct_fixture",
      active: false,
      target: { run },
    });
    expect((await a.p.inspect("link", identity)).state).toBe("confirmed");
    expect((await a.p.stopOldLink(identity)).state).toBe("unknown");
  });
  it("mail uses signed inbox and records acceptance without claiming delivery/reading", async () => {
    const a = adapter(),
      i = {
        ...identity,
        account: "resend-fixture",
        livemode: null,
        mailEnvironment: "acceptance" as const,
        mailRun: run,
        payloadHash: "a".repeat(64),
        reference: null,
      },
      f = await a.p.inspect("mail", i);
    expect(f.source).toBe("provider_webhook");
    expect(f.outcome).toBe("accepted");
    expect(evidenceCanApply("mail", f)).toBe(true);
    expect(a.fetcher).not.toHaveBeenCalled();
    expect((await a.p.inspect("mail", { ...i, mailRun: job })).state).toBe(
      "unknown",
    );
  });
});

describe("acceptance operation-specific scope", () => {
  beforeEach(() => {
    configure();
    vi.stubEnv("NATORI_OWNER_USER_ID", owner);
    vi.stubEnv("NATORI_CASE_ACCEPTANCE_MAIL_SCOPE", "resend-fixture");
    vi.stubEnv("NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT", "acct_fixture");
    m.rpc.mockReset();
    m.from.mockReset();
    m.rpc.mockResolvedValue({
      error: null,
      data: {
        scope: "resend-fixture",
        account: "acct_fixture",
        origin: target.origin,
        ref: "local",
        active: true,
      },
    });
  });
  const req = (body: unknown, query = "") =>
    new Request(target.origin + "/api/natori/admin/case-work" + query, {
      method: "POST",
      body: JSON.stringify(body),
    });
  it("query cannot hide different body/nested case", async () => {
    expect(
      await acceptanceManagementRequestAllowed(
        "case-work.POST",
        [req({ projectId: owner }, "?projectId=" + project)],
        true,
      ),
    ).toBe(false);
    expect(
      await acceptanceManagementRequestAllowed(
        "case-work.POST",
        [
          req(
            { command: "delivery", request: { projectId: owner } },
            "?projectId=" + project,
          ),
        ],
        true,
      ),
    ).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(["id", "fileId", "quoteId"])(
    "query %s cannot shadow a writer body identifier",
    async (key) => {
      expect(
        await acceptanceManagementRequestAllowed(
          "notifications.POST",
          [req({ id: owner, projectId: project }, "?" + key + "=" + job)],
          true,
        ),
      ).toBe(false);
      expect(m.rpc).not.toHaveBeenCalled();
    },
  );
  it("normal nested delivery request checks its actual target", async () => {
    expect(
      await acceptanceManagementRequestAllowed(
        "case-work.POST",
        [req({ command: "delivery", request: { projectId: project } })],
        true,
      ),
    ).toBe(true);
    expect(m.rpc).toHaveBeenCalledWith(
      "natori_case_acceptance_context_v1",
      expect.objectContaining({ p_project: project, p_mutation: true }),
    );
  });
  it("a new upload UUID may be reserved only under an active whitelisted parent", async () => {
    m.from.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ error: null, data: null }) }),
      }),
    });
    expect(
      await acceptanceManagementRequestAllowed(
        "delivery-files.POST",
        [req({ fileId: job, projectId: project })],
        true,
      ),
    ).toBe(true);
    expect(
      await acceptanceManagementRequestAllowed(
        "delivery-files.PATCH",
        [req({ fileId: job, projectId: project })],
        true,
      ),
    ).toBe(false);
  });
  it("coexisting file/job/quote must all belong to same project", async () => {
    m.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            error: null,
            data: { project_id: owner },
          }),
        }),
      }),
    });
    expect(
      await acceptanceManagementRequestAllowed(
        "delivery-files.PATCH",
        [req({ fileId: job, projectId: project })],
        true,
      ),
    ).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(["inspect", "apply-evidence"])(
    "stopped run permits %s result recording without opening mutation",
    async (action) => {
      m.rpc.mockResolvedValue({
        error: null,
        data: {
          scope: "resend-fixture",
          account: "acct_fixture",
          origin: target.origin,
          ref: "local",
          active: false,
        },
      });
      expect(
        await acceptanceManagementRequestAllowed(
          "case-reconciliation.POST",
          [req({ action, projectId: project })],
          true,
        ),
      ).toBe(true);
      expect(m.rpc).toHaveBeenCalledWith(
        "natori_case_acceptance_context_v1",
        expect.objectContaining({ p_mutation: false }),
      );
      expect(
        await acceptanceManagementRequestAllowed(
          "case-reconciliation.POST",
          [req({ action: "stop-old-link", projectId: project })],
          true,
        ),
      ).toBe(false);
    },
  );
  it("new transport rechecks run after potentially waiting on DB fence", async () => {
    const a = adapter();
    a.fence.mockImplementation(async () => {
      a.ctx.mockResolvedValue({
        scope: "resend-fixture",
        account: "acct_fixture",
        active: false,
        target: { run },
      });
    });
    expect((await a.p.stopOldLink(identity)).state).toBe("unknown");
    expect(
      a.fetcher.mock.calls.filter((c) => c[1]?.method === "POST"),
    ).toHaveLength(0);
  });
});

describe("acceptance mail links", () => {
  it.each([
    "https://www.me-ish.art/natori",
    "HTTPS://www.me-ish.art/natori",
    "https://localhost:4195@evil.invalid/x",
  ])("rejects out-of-run link %s", (text) => {
    expect(() => assertAcceptanceMailLinks(text, target.origin)).toThrow();
  });
  it("allows only dedicated origin and exact current test Payment Link", () => {
    expect(() =>
      assertAcceptanceMailLinks(
        target.origin + "/natori\nhttps://buy.stripe.com/fixture",
        target.origin,
        "https://buy.stripe.com/fixture",
      ),
    ).not.toThrow();
    expect(() =>
      assertAcceptanceMailLinks(
        "https://buy.stripe.com/old",
        target.origin,
        "https://buy.stripe.com/fixture",
      ),
    ).toThrow();
  });
});

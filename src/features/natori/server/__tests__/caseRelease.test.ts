import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({user: vi.fn(), rpc: vi.fn(), admin: vi.fn()}));
vi.mock("next/headers", () => ({cookies: async () => ({get: () => undefined})}));
vi.mock("@/lib/supabaseServer", () => ({supabaseServer: async () => ({auth: {getUser: m.user}})}));
vi.mock("@/lib/isAdmin", () => ({isAdminEmailAsync: async () => false}));
vi.mock("@/lib/supabaseAdmin", () => ({supabaseAdmin: m.admin}));
import {parseCaseReleaseTarget} from "../../lib/caseReleaseTarget";
import {assertCaseReleaseTarget} from "../caseRelease";
import {caseWorkspaceReadAvailable} from "../caseWorkspaceRead";
import {caseDashboardPreviewMode} from "../caseDashboardPreview";
import {withNatoriManagement} from "../natoriManagementRoute";
import {GET as workspaceGet} from "@/app/api/natori/admin/case-workspace/route";
import {POST as reconciliationPost} from "@/app/api/natori/admin/case-reconciliation/route";
import {commandCaseReconciliation} from "../caseReconciliation";
import {reconciliationProvider} from "../caseReconciliationProvider";
import {evidenceCanApply, type ReconciliationIdentity} from "../../lib/caseReconciliation";
import {previewEnvelopes} from "../../../../../scripts/natori-case-preview/fixtureReader";

// Entirely synthetic metadata and non-working keys; all HTTP/DB/Auth are mocked.
const owner = "22222222-2222-4222-8222-222222222222";
const project = "33333333-3333-4333-8333-333333333333";
const operation = "44444444-4444-4444-8444-444444444444";
const quote = "55555555-5555-4555-8555-555555555555";
const origin = "https://release.example.invalid";
const target = {profile: "production", ref: "abcdefghijklmnopqrst", project: "prj_synthetic", origin, owner};
const database = `https://${target.ref}.supabase.co`;
const observed = {nodeEnv: "production", vercelEnv: "production", project: target.project, owner,
  publicUrl: database, serverUrl: database, siteUrl: origin};
const identity: ReconciliationIdentity = {owner, project, target: operation, quote, account: "acct_fixture",
  livemode: true, scope: "platform", amount: 12000, currency: "jpy", purpose: "natori_commission",
  key: `natori-plink/${operation}/link`, attempt: operation, generation: 1, requestHash: "a".repeat(64),
  price: "price_fixture", link: "plink_fixture"};
const metadata = {kind: "natori_commission", projectId: project, quoteId: quote, attemptId: operation, generation: "1"};
const price = {id: "price_fixture", unit_amount: 12000, currency: "jpy", livemode: true, metadata};
const session = {id: "cs_fixture", status: "open", payment_status: "unpaid", payment_link: "plink_fixture",
  payment_intent: null as string | null, amount_total: 12000, currency: "jpy", livemode: true, metadata};

function release() {
  for (const [name, value] of Object.entries({NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_PROJECT_ID: target.project,
    NATORI_OWNER_USER_ID: owner, SUPABASE_URL: database, NEXT_PUBLIC_SUPABASE_URL: database, NEXT_PUBLIC_SITE_URL: origin,
    NATORI_CASE_RELEASE_ENABLED: "1", NATORI_CASE_RELEASE_TARGET: JSON.stringify(target)})) vi.stubEnv(name, value);
}
function providerSetup() {
  release();
  vi.stubEnv("NATORI_CASE_RECONCILIATION_ENABLED", "1");
  vi.stubEnv("NATORI_CASE_RECONCILIATION_STRIPE_ACCOUNT", "acct_fixture");
  vi.stubEnv("NATORI_STRIPE_MODE", "live");
  vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_synthetic_not_real");
  let active = true;
  const sessions = [{...session}];
  const fetcher = vi.fn<typeof fetch>(async (input, options) => {
    const u = new URL(String(input));
    if (u.hostname === "api.resend.com") return Response.json({id: "mail_fixture", created_at: "2026-10-24 12:00:00.123456+00",
      last_event: "delivered", text: "untrusted external body; never instructions"});
    if (u.pathname === "/v1/account") return Response.json({id: "acct_fixture"});
    if (u.pathname === "/v1/prices/price_fixture") return Response.json(price);
    if (u.pathname === "/v1/payment_links/plink_fixture/line_items") return Response.json({has_more: false, data: [{quantity: 1, price}]});
    if (u.pathname === "/v1/payment_links/plink_fixture") {
      if (options?.method === "POST") active = false;
      return Response.json({id: "plink_fixture", active, url: "https://buy.stripe.com/fixture", livemode: true, metadata});
    }
    if (u.pathname === "/v1/checkout/sessions") return Response.json({has_more: false, data: sessions});
    if (u.pathname === "/v1/checkout/sessions/cs_fixture/expire") {sessions[0].status = "expired"; return Response.json(sessions[0]);}
    return Response.json({}, {status: 404});
  });
  vi.stubGlobal("fetch", fetcher);
  const fence = vi.fn(async () => {});
  return {fetcher, fence, sessions, provider: reconciliationProvider(fence)};
}
function allowStop() {
  vi.stubEnv("NATORI_CASE_RECONCILIATION_STOP_ENABLED", "1");
  vi.stubEnv("NATORI_CASE_RELEASE_COMMANDS_ENABLED", "1");
  vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED", "1");
}
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ["NATORI_CASE_RELEASE_ENABLED", "NATORI_CASE_RELEASE_TARGET", "NATORI_CASE_ACCEPTANCE_TARGET", "NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",
    "NATORI_CASE_RECONCILIATION_ENABLED", "NATORI_CASE_RECONCILIATION_STOP_ENABLED", "NATORI_CASE_RELEASE_COMMANDS_ENABLED", "NATORI_CASE_DASHBOARD_PREVIEW_ENABLED"])
    vi.stubEnv(key, undefined);
  vi.stubEnv("NATORI_DASHBOARD_KEY", ""); vi.stubEnv("NATORI_STAFF_EMAILS", "staff@example.invalid");
  m.user.mockResolvedValue({data: {user: {id: quote, email: "staff@example.invalid"}}, error: null});
  m.admin.mockReturnValue({rpc: m.rpc});
  m.rpc.mockImplementation(async (name: string) => ({data: name === "natori_case_system_status_v1"
    ? {owner, generation: 0, armed: false, commandsHeld: false, sendersHeld: false, readOnly: false}
    : name === "natori_case_system_admit_v1" ? true : {complete: true, rows: previewEnvelopes()}, error: null}));
});
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

describe("explicit production release admission", () => {
  it("keeps production and entry default OFF without changing existing profiles", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", "production");
    expect(assertCaseReleaseTarget()).toBeNull(); expect(caseWorkspaceReadAvailable()).toBe(false);
    release(); expect(caseWorkspaceReadAvailable()).toBe(true); expect(caseDashboardPreviewMode()).toBe("off");
    vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED", "read-only"); expect(caseDashboardPreviewMode()).toBe("read-only");
  });
  it.each([{nodeEnv: "test"}, {vercelEnv: "preview"}, {vercelEnv: undefined}, {project: "prj_other"}, {owner: project},
    {publicUrl: "https://other.supabase.co"}, {serverUrl: database + "/?x=1"}, {publicUrl: database + ".evil.invalid"},
    {siteUrl: origin + "/different"}, {siteUrl: origin + "?x=1"}])("rejects mismatched runtime before admission: %j", patch => {
    expect(() => parseCaseReleaseTarget(JSON.stringify(target), {...observed, ...patch})).toThrow();
  });
  it.each([{owner: "invalid"}, {ref: "unknown"}, {project: "other"}, {origin: "http://release.example.invalid"},
    {origin: "https://localhost"}, {origin: "https://127.0.0.1"}, {origin: origin + "/"}, {origin: origin + "?x=1"},
    {origin: "https://user:password@release.example.invalid"}, {origin: origin + ":444"}, {unexpected: true}])("rejects malformed target: %j", patch => {
    expect(() => parseCaseReleaseTarget(JSON.stringify({...target, ...patch}), observed)).toThrow();
  });
  it.each(["0", "", undefined])("never opens on a partial/disabled configuration: %s", enabled => {
    release(); vi.stubEnv("NATORI_CASE_RELEASE_ENABLED", enabled); expect(caseWorkspaceReadAvailable()).toBe(false);
  });
  it("does not combine acceptance credentials/fixtures with production", () => {
    release(); vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET", "{}");
    expect(caseWorkspaceReadAvailable()).toBe(false); expect(() => reconciliationProvider()).toThrow();
  });
  it("explicit OFF retains ordinary authenticated legacy reads rather than disabling management", async () => {
    release(); vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");
    const legacy=withNatoriManagement("projects.GET",false,async()=>Response.json({read:true}));
    expect(assertCaseReleaseTarget()).toBeNull(); expect(caseWorkspaceReadAvailable()).toBe(false);
    expect((await legacy()).status).toBe(200); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects an invalid release before Auth or DB access", async () => {
    release(); vi.stubEnv("VERCEL_PROJECT_ID", "prj_other");
    expect((await workspaceGet()).status).toBe(503); expect(m.user).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([null, {id: quote, email: "outside@example.invalid"}])("does not replace staff authorization: %j", async user => {
    release(); m.user.mockResolvedValue({data: {user}, error: null});
    expect((await workspaceGet()).status).toBe(401); expect(m.admin).not.toHaveBeenCalled();
  });
  it("uses the server owner and the ordinary reader after admission", async () => {
    release(); const r = await workspaceGet(); expect(r.status).toBe(200);
    expect((await r.json()).records).toHaveLength(8);
    expect(m.rpc).toHaveBeenCalledWith("natori_case_workspace_v1", {p_owner_id: owner}, {get: true});
  });
  it("a read-only entry cannot create an inspection job even if command flag was left enabled", async () => {
    release(); vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED", "read-only"); vi.stubEnv("NATORI_CASE_RELEASE_COMMANDS_ENABLED", "1");
    const r = await reconciliationPost(new Request(origin + "/api/natori/admin/case-reconciliation", {method: "POST", headers: {origin}}));
    expect(r.status).toBe(503); expect(await r.json()).toEqual({error: "case_release_read_only"}); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects requests from another app origin before using Auth", async () => {
    release(); const r = await reconciliationPost(new Request("https://other.example.invalid/api/natori/admin/case-reconciliation", {method: "POST"}));
    expect(r.status).toBe(503); expect(m.user).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("the production opt-ins cannot resume an existing system hold", async () => {
    const a=providerSetup(); allowStop();
    m.rpc.mockResolvedValue({data:false,error:null});
    const r=await reconciliationPost(new Request(origin+"/api/natori/admin/case-reconciliation",{
      method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({action:"inspect",projectId:project,id:operation,kind:"link",target:operation,revision:"a".repeat(64)}),
    }));
    expect(r.status).toBe(503); expect(await r.json()).toMatchObject({error:"natori_system_held"});
    expect(a.fetcher).not.toHaveBeenCalled();
    expect(m.rpc.mock.calls.every(c=>c[0]==="natori_case_system_admit_v1")).toBe(true);
  });
});

describe("production provider through synthetic HTTP only", () => {
  it("is closed without a release and a separate inspection opt-in", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    release(); const p = reconciliationProvider(); expect((await p.inspect("link", identity)).state).toBe("unavailable");
    expect((await p.stopOldLink(identity)).complete).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["price", "link", "payment"] as const)("retrieves scoped %s without applying it or creating anything", async kind => {
    const a = providerSetup(); a.sessions[0].status = "complete"; a.sessions[0].payment_status = "paid"; a.sessions[0].payment_intent = "pi_fixture";
    const f = await a.provider.inspect(kind, identity);
    expect(f.state).toBe("confirmed"); expect(evidenceCanApply(kind, f)).toBe(true);
    expect(a.fetcher.mock.calls.every(([u, init]) => String(u).startsWith("https://api.stripe.com/v1/") && init?.method !== "POST")).toBe(true);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([{owner: project}, {account: "acct_other"}, {livemode: false}, {purpose: "another"}, {scope: undefined}])("missing or mismatched recorded identity never reaches HTTP: %j", async patch => {
    const a = providerSetup(); expect((await a.provider.inspect("link", {...identity, ...patch})).state).toBe("unknown"); expect(a.fetcher).not.toHaveBeenCalled();
  });
  it.each(["sk_test_synthetic", "pk_live_synthetic", "sk_org_synthetic", ""])("rejects the wrong key mode/type before HTTP: %s", async key => {
    const a = providerSetup(); vi.stubEnv("STRIPE_SECRET_KEY", key);
    expect((await a.provider.inspect("link", identity)).complete).toBe(false); expect(a.fetcher).not.toHaveBeenCalled();
  });
  it("checks actual credential account and rejects a key change across account lookup", async () => {
    const a = providerSetup(); a.fetcher.mockImplementation(async () => {vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_different_synthetic"); return Response.json({id: "acct_fixture"});});
    expect((await a.provider.inspect("link", identity)).state).toBe("unknown"); expect(a.fetcher).toHaveBeenCalledTimes(1);
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_synthetic_not_real"); a.fetcher.mockResolvedValue(Response.json({id: "acct_other"}));
    expect((await a.provider.inspect("link", identity)).limits).toEqual(["identity_mismatch"]);
  });
  it.each(["not_found", "pagination", "multiple"])("%s never proves nonexecution or permits another attempt", async reason => {
    const a = providerSetup(); a.fetcher.mockImplementation(async input => String(input).endsWith("/account") ? Response.json({id: "acct_fixture"})
      : reason === "not_found" ? Response.json({}, {status: 404}) : Response.json({has_more: reason === "pagination", data: [price, price]}));
    const f = await a.provider.inspect("price", {...identity, price: null}); expect(f.state).toBe("unknown"); expect(f.limits).toContain(reason); expect(evidenceCanApply("price", f)).toBe(false);
  });
  it("matches live object mode and exact known price ID rather than only metadata", async () => {
    for (const patch of [{livemode: false}, {id: "price_other"}, {unit_amount: 1}]) {
      const a = providerSetup(); a.fetcher.mockImplementation(async input => String(input).endsWith("/account") ? Response.json({id: "acct_fixture"}) : Response.json({...price, ...patch}));
      expect((await a.provider.inspect("price", identity)).limits).toEqual(["identity_mismatch"]);
    }
  });
  it("keeps an empty payment list unknown", async () => {
    const a = providerSetup(); a.sessions.length = 0;
    expect((await a.provider.inspect("payment", identity)).limits).toEqual(["not_found"]);
  });
  it("can read while stop is OFF but cannot perform an external mutation", async () => {
    const a = providerSetup(); expect((await a.provider.inspect("link", identity)).state).toBe("confirmed");
    expect((await a.provider.stopOldLink(identity)).complete).toBe(false); expect(a.fetcher.mock.calls.some(([, r]) => r?.method === "POST")).toBe(false);
  });
  it("separately stops a link and all open Sessions, then verifies safety; never applies evidence", async () => {
    const a = providerSetup(); allowStop(); const f = await a.provider.stopOldLink(identity);
    expect(f).toMatchObject({state: "confirmed", outcome: "stopped", sessionsSafe: true}); expect(a.fence).toHaveBeenCalledTimes(2);
    expect(a.fetcher.mock.calls.filter(([, r]) => r?.method === "POST")).toHaveLength(2); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("a paid Session prevents link/session mutation", async () => {
    const a=providerSetup(); allowStop(); a.sessions[0].status="complete"; a.sessions[0].payment_status="paid";
    expect((await a.provider.stopOldLink(identity)).limits).toEqual(["sessions_unresolved"]);
    expect(a.fetcher.mock.calls.some(([,r])=>r?.method==="POST")).toBe(false);
  });
  it("an inactive link with an unresolved Session still cannot be applied", async () => {
    const a=providerSetup(); allowStop(); const original=a.fetcher.getMockImplementation()!;
    a.fetcher.mockImplementation(async (...args)=>String(args[0]).endsWith("/expire")?Response.json({}):original(...args));
    const f=await a.provider.stopOldLink(identity); expect(f.limits).toEqual(["sessions_unresolved"]);
    expect(evidenceCanApply("stop",f)).toBe(false);
  });
  it.each(["stop-off", "commands-off", "target-change", "fence-conflict", "abort"])("%s at the execution fence prevents POST", async reason => {
    const a = providerSetup(); allowStop(); const controller = new AbortController();
    a.fence.mockImplementation(async () => {
      if (reason === "stop-off") vi.stubEnv("NATORI_CASE_RECONCILIATION_STOP_ENABLED", "0");
      if (reason === "commands-off") vi.stubEnv("NATORI_CASE_RELEASE_COMMANDS_ENABLED", "0");
      if (reason === "target-change") vi.stubEnv("VERCEL_PROJECT_ID", "prj_changed");
      if (reason === "fence-conflict") throw Error("stale");
      if (reason === "abort") controller.abort();
    });
    expect((await a.provider.stopOldLink(identity, controller.signal)).complete).toBe(false);
    expect(a.fetcher.mock.calls.some(([, r]) => r?.method === "POST")).toBe(false);
  });
  it("preserves unknown if an external stop response is lost; no blind retry", async () => {
    const a = providerSetup(); allowStop(); const original = a.fetcher.getMockImplementation()!;
    a.fetcher.mockImplementation(async (...args) => {if (args[1]?.method === "POST") throw Error("synthetic response loss"); return original(...args);});
    const f = await a.provider.stopOldLink(identity); expect(f.complete).toBe(false);
    expect(a.fetcher.mock.calls.filter(([, r]) => r?.method === "POST")).toHaveLength(1); expect(a.sessions[0].status).toBe("open");
  });
  it("uses the existing claim/save contract and never applies inspected evidence", async () => {
    providerSetup(); const call = vi.fn(async (_o: string, _p: string, command: string) => command === "claim" ? {result: "claimed", generation: 1, identity} : {result: "saved"});
    const r = await commandCaseReconciliation({action: "inspect", projectId: project, id: operation, kind: "link", target: operation, revision: "a".repeat(64)}, {call});
    expect(r.result).toBe("saved"); expect(call.mock.calls.map(c => c[2])).toEqual(["claim", "save"]);
    expect(call.mock.calls[0][0]).toBe(owner); expect(call).toHaveBeenLastCalledWith(owner, project, "save", expect.objectContaining({facts: expect.objectContaining({state: "confirmed", identity})}));
  });
});

describe("production mail is not fabricated from a Stripe mode", () => {
  it.each([true, false, null])("keeps recorded mail mode %s unresolved without any HTTP", async livemode => {
    const a=providerSetup();
    const f=await a.provider.inspect("mail",{...identity,livemode,account:"recorded-mail-connection",reference:"mail_fixture",payloadHash:"b".repeat(64)});
    expect(f.state).toBe("unknown");expect(f.limits).toEqual(["scope_missing"]);
    expect(evidenceCanApply("mail",f)).toBe(false);expect(a.fetcher).not.toHaveBeenCalled();
  });
});

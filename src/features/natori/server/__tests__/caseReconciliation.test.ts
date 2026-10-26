import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../caseSystemHold",async importOriginal=>({...await importOriginal<typeof import('../caseSystemHold')>(),assertCaseSystemAdmission:vi.fn(async()=>{})}));
const m = vi.hoisted(() => ({ context: vi.fn(), admin: vi.fn() }));
vi.mock("../natoriOwner", () => ({ resolveNatoriManagementContext: m.context }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: m.admin }));
import { commandCaseReconciliation, readCaseReconciliation, type ReconciliationRpc } from "../caseReconciliation";
import { reconciliationProvider, type ReconciliationProvider } from "../caseReconciliationProvider";
import { evidenceCanApply, type ReconciliationFacts, type ReconciliationIdentity } from "../../lib/caseReconciliation";
const owner = "22222222-2222-4222-8222-222222222222", project = "33333333-3333-4333-8333-333333333333", id = "44444444-4444-4444-8444-444444444444", target = "55555555-5555-4555-8555-555555555555";
const identity: ReconciliationIdentity = { owner, project, target, quote: target, account: "acct_fixture", scope: "platform", livemode: false, amount: 12000, currency: "jpy", purpose: "natori_commission", key: "natori-plink/fixture/link", attempt: id, generation: 1, requestHash: "a".repeat(64), price: null, link: null };
const facts = (): ReconciliationFacts => ({ state: "confirmed", source: "provider_retrieval", identity, checkedAt: new Date().toISOString(), complete: true, limits: [], reference: "plink_fixture", price: "price_fixture", url: "https://buy.stripe.com/fixture", outcome: "active" });
const command = { action: "inspect", projectId: project, id, kind: "link", target, revision: "a".repeat(64) };
beforeEach(() => { vi.resetAllMocks(); m.context.mockResolvedValue({ ownerId: owner, operator: { kind: "auth-user", userId: target } }); });
afterEach(() => vi.useRealTimers());
function setup(value = facts()) {
  const call = vi.fn<ReconciliationRpc>(async (_o, _p, c) => c === "claim" ? { result: "claimed", generation: 1, identity } : { result: "saved" });
  const provider: ReconciliationProvider = { inspect: vi.fn(async () => value), stopOldLink: vi.fn(async () => value) };
  return { call, provider };
}
describe("R1 explicit provider boundary", () => {
  it("DB-only read never constructs a provider or mutates", async () => {
    const call = vi.fn<ReconciliationRpc>(async () => ({ result: "ok", revision: "a", operations: [], notifications: [], jobs: [] }));
    await readCaseReconciliation(project, call); expect(call).toHaveBeenCalledExactlyOnceWith(owner, project, "read", {});
  });
  it("records only server-acquired evidence under authenticated owner/operator", async () => {
    const d = setup(); expect((await commandCaseReconciliation(command,d)).result).toBe("saved");
    expect(d.provider.inspect).toHaveBeenCalledExactlyOnceWith("link",identity,expect.any(AbortSignal));
    expect(d.call.mock.calls[0].slice(0,3)).toEqual([owner,project,"claim"]);
    expect(d.call.mock.calls[1][2]).toBe("save"); expect(d.call.mock.calls[1][3]).toMatchObject({ facts: {state:"confirmed",identity,reference:"plink_fixture"} });
  });
  it.each(["existing","busy","stale","not_found"])("%s claim never repeats provider inspection", async result => {
    const d = setup(); d.call.mockResolvedValue({result}); expect((await commandCaseReconciliation(command,d)).result).toBe(result); expect(d.provider.inspect).not.toHaveBeenCalled();
  });
  it.each([{account:"acct_other"},{livemode:true},{amount:1},{purpose:"other"},{project:owner}])("rejects provider identity mismatch %j", async changed => {
    const d = setup({...facts(),identity:{...identity,...changed}}); await commandCaseReconciliation(command,d);
    expect(d.call.mock.calls[1][3]).toMatchObject({facts:{state:"mismatch",limits:["identity_mismatch"]}});
  });
  it.each(["not_found","pagination","multiple","history_expired"] as const)("%s keeps unknown and never applies", async limit => {
    const d = setup({...facts(),state:"unknown",complete:false,limits:[limit]}); await commandCaseReconciliation(command,d);
    expect(d.call.mock.calls.map(c=>c[2])).toEqual(["claim","save"]); expect(evidenceCanApply("link",{...facts(),limits:[limit]})).toBe(false);
  });
  it("unbound historical mail never calls a provider with guessed scope", async () => {
    const d = setup(); d.call.mockImplementation(async (_o,_p,c)=>c==="claim"?{result:"claimed",generation:1,identity:{...identity,account:null,livemode:null}}:{result:"saved"});
    await commandCaseReconciliation({...command,kind:"mail"},d); expect(d.provider.inspect).not.toHaveBeenCalled();expect(d.call.mock.calls[1][3]).toMatchObject({facts:{state:"unavailable",limits:["scope_missing"]}});
  });
  it("rejects browser supplied proof and forced scope", async () => {
    const d=setup(); await expect(commandCaseReconciliation({...command,facts:facts()},d)).rejects.toThrow(); expect(d.call).not.toHaveBeenCalled();
  });
  it("apply is separate, calls no provider and preserves stable resolution identity", async () => {
    const d=setup(); await commandCaseReconciliation({action:"apply-evidence",projectId:project,id,evidenceId:target,resolutionId:owner,confirmed:true},d);
    expect(d.provider.inspect).not.toHaveBeenCalled();expect(d.provider.stopOldLink).not.toHaveBeenCalled();expect(d.call).toHaveBeenCalledExactlyOnceWith(owner,project,"apply",{id,evidenceId:target,resolutionId:owner,operator:{kind:"auth-user",userId:target}});
  });
  it("stopping requires explicit confirmation and does not apply evidence", async () => {
    const d=setup({...facts(),outcome:"stopped",sessionsSafe:true});
    await expect(commandCaseReconciliation({...command,action:"stop-old-link",kind:"stop"},d)).rejects.toThrow();
    await commandCaseReconciliation({...command,action:"stop-old-link",kind:"stop",confirmed:true},d);
    expect(d.provider.stopOldLink).toHaveBeenCalledOnce();expect(d.call.mock.calls.map(c=>c[2])).toEqual(["claim","save"]);
  });
  it("link inactive without complete Session safety never enables resolution", () => {
    expect(evidenceCanApply("stop",{...facts(),outcome:"stopped",sessionsSafe:false})).toBe(false);
    expect(evidenceCanApply("price",facts())).toBe(false);expect(evidenceCanApply("payment",facts())).toBe(false);
  });
  it("default adapter performs no network call or credential lookup", async () => {
    const fetch=vi.spyOn(globalThis,"fetch");const p=reconciliationProvider();expect((await p.inspect("link",identity)).state).toBe("unavailable");expect((await p.stopOldLink(identity)).complete).toBe(false);expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
  });
});

it("exact older mail read binds selected ID and does not clear another purpose or start provider inspection",async()=>{
 const view={result:"ok",revision:"a",operations:[],notifications:[{id:target,purpose:"quote_accept_artist",status:"unknown",attempt_no:1}],jobs:[],selectedNotice:target};
 const call=vi.fn<ReconciliationRpc>(async()=>view);
 expect((await readCaseReconciliation(project,call,target))?.notifications[0].status).toBe("unknown");
 expect(call).toHaveBeenCalledExactlyOnceWith(owner,project,"read-notice",{notificationId:target});
 call.mockResolvedValue({...view,selectedNotice:id});await expect(readCaseReconciliation(project,call,target)).rejects.toThrow("scope_mismatch");
});

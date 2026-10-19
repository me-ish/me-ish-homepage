import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("stripe", () => ({ default: class {} }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: mockRpc }) }));
vi.mock("../trustedNatoriOwner", () => ({
  resolveTrustedNatoriOwnerId: () => ({ kind: "ok", ownerId: "11111111-1111-4111-8111-111111111111" }),
}));
vi.mock("../natoriOwner", () => ({ resolveNatoriOwnerId: async () => "11111111-1111-4111-8111-111111111111" }));

import { stopDuePaymentLinks, retryPaymentStop, type PaymentLinkProvider } from "../paymentLinkService";

const PROJECT = "22222222-2222-4222-8222-222222222222";
const QUOTE = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";
const ACCOUNT = "acct_TEST123";

const attempt = {
  id: ATTEMPT, project_id: PROJECT, quote_id: QUOTE, generation: 1, amount: 30000, livemode: false,
  provider_account_id: ACCOUNT, state: "active", price_id: "price_1", link_id: "plink_1",
  link_url: "https://buy.stripe.com/test_1", deadline: "2026-10-01T00:00:00Z", deadline_revision: 1,
  claim_generation: 1, price_started_at: null, link_started_at: null,
};

function installRpc() {
  mockRpc.mockImplementation(async (_name: string, args: { p_command: string; p_input?: {outcome?:string} }) => {
    const data: Record<string, unknown> = {
      scan: { result: "ok", projects: [PROJECT] },
      context: { result: "ok", attempt },
      queue_stop: { result: "ok" },
      claim_stop: { result: "claimed", attempt, job: { id: ATTEMPT, link_id: "plink_1", livemode: false, claim_generation: 1 } },
      stop_renew: { result: "renewed" },
      finish_stop: { result: "completed" },
    };
    return { data: _name === "natori_payment_stop_claim_v1" ? data.claim_stop : args.p_command === "finish_stop" ? {result:args.p_input?.outcome === "inactive" ? "completed" : "needs_review"} : data[args.p_command] ?? { result: "ok" }, error: null };
  });
}

function provider(sessions: { id: string; status: string | null; paymentStatus: string }[]) {
  const link = {
    id: "plink_1", url: attempt.link_url, active: true, livemode: false, projectId: PROJECT, quoteId: QUOTE,
    kind: "natori_commission", attemptId: ATTEMPT, generation: "1", priceId: "price_1", amount: 30000, currency: "jpy",
  };
  const calls: string[] = [];
  const ext: PaymentLinkProvider = {
    accountId: async () => ACCOUNT,
    createPrice: async () => "price_1",
    createLink: async () => link,
    findLink: async () => link,
    readLink: async () => ({ ...link }),
    sessions: async () => sessions,
    expireSession: async (id) => { calls.push(`expire:${id}`); },
    stopLink: async () => { calls.push("stop"); link.active = false; },
  };
  return { ext, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NATORI_PAYMENT_LINK_INTEGRITY_ENABLED", "1");
  vi.stubEnv("NATORI_STRIPE_MODE", "test");
  installRpc();
});

describe("stopDuePaymentLinks", () => {
  it("リンク停止後、開いたままの支払い画面も閉じる（支払い済みの画面には触れない）", async () => {
    const { ext, calls } = provider([
      { id: "cs_open", status: "open", paymentStatus: "unpaid" },
      { id: "cs_done", status: "complete", paymentStatus: "paid" },
      { id: "cs_old", status: "expired", paymentStatus: "unpaid" },
    ]);
    const result = await stopDuePaymentLinks(ext);
    expect(result).toMatchObject({ kind: "ok", expired: 1, failed: 0 });
    expect(calls).toEqual(["stop", "expire:cs_open"]);
  });

  it("支払い画面を閉じられなかった場合は停止完了にせず、再試行に回す", async () => {
    const { ext } = provider([{ id: "cs_open", status: "open", paymentStatus: "unpaid" }]);
    ext.expireSession = async () => { throw new Error("stripe_down"); };
    await stopDuePaymentLinks(ext);
    const finish = mockRpc.mock.calls.find(([, args]) => args.p_command === "finish_stop");
    expect(finish?.[1].p_input.outcome).toBe("retry");
  });
});

describe("exact stop job recovery",()=>{
 it("retries a failed Session expiry on the same job without create, mail, queue or reconcile",async()=>{
  const {ext,calls}=provider([{id:"cs_open",status:"open",paymentStatus:"unpaid"}]);
  const expire=ext.expireSession;ext.expireSession=async()=>{throw new Error("synthetic-down");};
  expect(await retryPaymentStop(PROJECT,ATTEMPT,ext)).toEqual({result:"needs_review"});
  ext.expireSession=expire;
  expect(await retryPaymentStop(PROJECT,ATTEMPT,ext)).toEqual({result:"completed"});
  expect(calls).toEqual(["stop","stop","expire:cs_open"]);
  expect(mockRpc.mock.calls.every(([name,args])=>name==="natori_payment_stop_claim_v1"||["stop_renew","finish_stop"].includes(args.p_command))).toBe(true);
 });
 it.each(["not_due","busy","earlier_job_pending","not_found","completed","needs_review"])("does not touch provider links after %s",async(result)=>{
  const {ext,calls}=provider([]);ext.readLink=vi.fn(ext.readLink);
  mockRpc.mockResolvedValue({data:{result},error:null});
  expect(await retryPaymentStop(PROJECT,ATTEMPT,ext)).toEqual({result});expect(calls).toEqual([]);expect(ext.readLink).not.toHaveBeenCalled();
 });
 it("refuses a response with the wrong job",async()=>{
  const {ext,calls}=provider([]);const original=mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async(name,args)=>{const r=await original(name,args);return name==="natori_payment_stop_claim_v1"?{...r,data:{...r.data,job:{...r.data.job,id:PROJECT}}}:r;});
  expect(await retryPaymentStop(PROJECT,ATTEMPT,ext)).toEqual({result:"needs_review"});expect(calls).toEqual([]);
 });
 it.each(["account","generation","amount","resource_missing","lease"])("does not mutate an unverified %s link",async(kind)=>{
  const {ext,calls}=provider([]),read=ext.readLink;
  if(kind==="account")ext.accountId=async()=>"acct_OTHER";
  if(kind==="generation")ext.readLink=async(id)=>({...await read(id),generation:"2"});
  if(kind==="amount")ext.readLink=async(id)=>({...await read(id),amount:40000});
  if(kind==="resource_missing")ext.readLink=async()=>{throw Object.assign(new Error("private-fixture"),{code:"resource_missing"});};
  if(kind==="lease"){const original=mockRpc.getMockImplementation()!;mockRpc.mockImplementation(async(name,args)=>args.p_command==="stop_renew"?{data:{result:"stale"},error:null}:original(name,args));}
  expect((await retryPaymentStop(PROJECT,ATTEMPT,ext)).result).not.toBe("completed");expect(calls).toEqual([]);
 });
});

import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
vi.mock("../natoriOwner",()=>({resolveNatoriManagementContext:async()=>({ownerId:"22222222-2222-4222-8222-222222222222"})}));
vi.mock("@/lib/caseAcceptanceEnvironment",()=>({assertServerAcceptanceTarget:()=>null}));
import {previewEnvelopes} from "../../../../../scripts/natori-case-preview/fixtureReader";
import {readCaseHistory} from "../caseHistoryRead";
import {readCaseDetail} from "../caseDetailRead";
const owner="22222222-2222-4222-8222-222222222222";
const envelope=()=>{
 const e=previewEnvelopes()[2];const p=e.sections.financial_payments as {rows:Record<string,unknown>[]};
 Object.assign(p.rows[0],{status:"received",currency:"jpy",has_session:true,is_original:true,is_manual_candidate:false,has_refund_mapping:true});return e;
};
const raw=()=>{const e=envelope();return {ownerId:owner,projectId:e.project.id,revision:"a".repeat(32),total:0,offset:0,next:null,changed:false,observedAt:e.observed_at,rows:[],counts:{},snapshot:e,legacyEntries:[{dateISO:"2026-10-01",label:"支払い依頼メール送信"}],refundSummary:{available:true,originalMapped:true,confirmedAmount:1000,pendingCount:0,reviewCount:0}};};
beforeEach(()=>vi.clearAllMocks());
it("reads one exact case from the SETOF snapshot RPC without loading a collection",async()=>{
 const e=envelope();m.rpc.mockResolvedValue({data:[e],error:null});
 const value=await readCaseDetail(e.project.id);expect(value.state).toBe("ready");
 expect(m.rpc).toHaveBeenCalledExactlyOnceWith("natori_case_snapshot_v1",{p_project_id:e.project.id,p_owner_id:owner},{get:true});
 m.rpc.mockResolvedValue({data:[],error:null});expect(await readCaseDetail(e.project.id)).toEqual({state:"not_found"});
});
it("refuses a foreign/mixed detail envelope rather than adapting another case",async()=>{
 const e=envelope();e.project.user_id="33333333-3333-4333-8333-333333333333";m.rpc.mockResolvedValue({data:[e],error:null});
 expect((await readCaseDetail(e.project.id)).state).toBe("unavailable");
});
it("returns matched recorded income and a verified net only from complete clear financial sources",async()=>{
 const r=raw();const value=await readCaseHistory(r.projectId,0,null,async()=>({data:r,error:null}));
 expect(value.state).toBe("ready");if(value.state!=="ready")throw Error('ready');
 expect(value.view.financial).toMatchObject({gross:40000,refunded:1000,net:39000,state:"verified"});
 expect(JSON.stringify(value.view)).not.toMatch(/snapshot|ownerId|legacyNote/);
 expect(value.view.legacyLogs).toEqual([{dateISO:"2026-10-01",label:"支払い依頼メール送信"}]);
});
it.each(["pending","review","missing","over-total"])("keeps unresolved %s money unknown without replacing known income with the registration amount",async mode=>{
 const r=raw();if(mode==="pending")r.refundSummary.pendingCount=1;if(mode==="review")r.refundSummary.reviewCount=1;
 if(mode==="missing")r.refundSummary.originalMapped=false;if(mode==="over-total")r.refundSummary.confirmedAmount=50000;
 const value=await readCaseHistory(r.projectId,0,null,async()=>({data:r,error:null}));if(value.state!=="ready")throw Error('ready');
 expect(value.view.financial).toMatchObject({gross:40000,refunded:null,net:null,state:"unverified"});
});
it("keeps unknown paid amount unknown even when the registration amount is known",async()=>{
 const r=raw();r.snapshot.project.paid_amount=null;r.snapshot.sections.financial_payments={total:0,rows:[]};
 const value=await readCaseHistory(r.projectId,0,null,async()=>({data:r,error:null}));if(value.state!=="ready")throw Error('ready');expect(value.view.financial?.gross).toBeNull();expect(value.view.financial?.net).toBeNull();
});
it("rejects owner substitution and incomplete pages, and exposes a changing cursor distinctly",async()=>{
 const r=raw();await expect(readCaseHistory(r.projectId,0,null,async()=>({data:{...r,ownerId:"33333333-3333-4333-8333-333333333333"},error:null}))).rejects.toThrow();
 await expect(readCaseHistory(r.projectId,0,null,async()=>({data:{...r,total:2},error:null}))).rejects.toThrow();
 expect(await readCaseHistory(r.projectId,50,r.revision,async()=>({data:{...r,changed:true},error:null}))).toEqual({state:"changed"});
});

it("keeps legacy known amount as an uncorrelated reference and never uses it as gross or net",async()=>{
 const r=raw();r.snapshot.sections.financial_payments={total:0,rows:[]};
 const value=await readCaseHistory(r.projectId,0,null,async()=>({data:r,error:null}));if(value.state!=="ready")throw Error('ready');
 expect(value.view.financial).toMatchObject({gross:null,legacyRecordedAmount:40000,refunded:null,net:null,state:"unverified"});
});

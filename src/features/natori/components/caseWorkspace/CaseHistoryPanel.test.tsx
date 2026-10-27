// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("../../data/supabaseCaseHistory",async()=>({...await vi.importActual<typeof import("../../data/supabaseCaseHistory")>("../../data/supabaseCaseHistory"),loadCaseHistory:m.load}));
import {CaseHistoryChangedError} from "../../data/supabaseCaseHistory";
import {CaseHistoryPanel} from "./CaseHistoryPanel";
import {caseHistoryRow,type CaseHistoryView} from "../../lib/caseHistory";
const id="11111111-1111-4111-8111-111111111111",onPage=vi.fn(),reject=vi.fn();
const row=(n:number)=>caseHistoryRow.parse({...Object.fromEntries(['occurredAt','state','kind','quoteId','quoteVersion','quoteMatched','amount','currency','relatedId','operatorKind','origin','legacy','acceptedAt','sentAt','receivedAt','confirmedAt','expiresAt','retentionState','reason'].map(k=>[k,null])),id:`activity/${n}`,recordId:String(n),source:'activity'});
const first=():CaseHistoryView=>({projectId:id,revision:'a'.repeat(32),total:51,offset:0,next:50,changed:false,observedAt:'2026-10-22T01:00:00Z',rows:Array.from({length:50},(_,i)=>row(i)),counts:{activity:51},financial:{gross:null,legacyRecordedAmount:7000,method:'unclassified',confirmedAt:'2026-10-01T00:00:00Z',refunded:null,net:null,pendingCount:0,reviewCount:1,state:'unverified'},legacyLogs:[]});
const panel=(page=1,key='one')=><CaseHistoryPanel key={key} projectId={id} section="history" page={page} refreshKey="facts" onPage={onPage} onAccessRejected={reject}/>;
beforeEach(()=>{vi.clearAllMocks();m.load.mockResolvedValue(first());});afterEach(cleanup);
it("labels a partial page and uncorrelated old money without calling it the full history or confirmed income",async()=>{
 render(panel());await screen.findByText(/51件中 1〜50件/);expect(screen.queryByText(/（全件）/)).toBeNull();
 expect(screen.getByText(/以前の方法で記録した金額：7,000円/)).not.toBeNull();expect(screen.getByText(/差し引きの金額はまだ決まっていません/)).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'次へ'}));expect(onPage).toHaveBeenCalledWith(2);
});
it("clears old data on a changing cursor and requires explicit restart rather than silently returning an empty page",async()=>{
 const view=render(panel());await screen.findByText(/51件中 1〜50件/);
 m.load.mockRejectedValueOnce(new CaseHistoryChangedError('changed'));view.rerender(panel(2));await screen.findByRole('alert');
 expect(screen.queryByText(/51件中/)).toBeNull();expect(screen.getByText(/記録が増えました/)).not.toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'最初のページから読み込み直す'}));expect(onPage).toHaveBeenCalledWith(1);
});
it("discards an obsolete in-flight read after the target panel unmounts",async()=>{
 let finish!:(v:CaseHistoryView)=>void;m.load.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));const old=render(panel());old.unmount();
 const fresh=first();fresh.total=0;fresh.rows=[];fresh.next=null;fresh.counts={};fresh.financial=null;m.load.mockResolvedValue(fresh);
 render(panel(1,'new'));await screen.findByText(/0件中 0〜0件/);await act(async()=>finish(first()));expect(screen.queryByText(/51件中/)).toBeNull();
});

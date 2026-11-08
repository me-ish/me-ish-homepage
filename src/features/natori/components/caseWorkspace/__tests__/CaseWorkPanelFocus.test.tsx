// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CaseWorkView } from "../../../lib/caseWork";
const m=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock("../../../data/supabaseCaseWork",()=>({fetchCaseWork:m.fetch,mutateCaseWork:vi.fn()}));
vi.mock("../CaseAdministrationPanel",()=>({CaseAdministrationPanel:()=>null}));
vi.mock("../../consultation/ConsultationThread",()=>({default:()=>null}));
vi.mock("../../dashboard/DeliveryFilesManager",()=>({default:()=>null}));
vi.mock("../CaseItemsPanel",()=>({CaseItemsPanel:()=>null,CaseItemsProgress:()=>null}));
vi.mock("../useCaseItems",()=>({useCaseItems:()=>({items:[],unavailable:false})}));
import { CaseWorkPanel } from "../CaseWorkPanel";
const id="11111111-1111-4111-8111-111111111111";
const task=(stage:string)=>({id:`task-${stage}`,stage,label:stage,done:true});
function view(release:CaseWorkView["release"]):CaseWorkView{
 return {project:{id,status:"delivered",nextAction:"-",title:"架空案件",clientName:"架空依頼者",clientEmail:"a@example.com",amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:"2026-10-01T00:00:00Z",note:null,requestData:{},mutationRevision:1,tasks:[task("rough"),task("finish"),task("delivery")],paymentConfirmedAt:null,paidAt:null,paidAmount:null,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:"2026-10-05T00:00:00Z",deletedAt:null} as CaseWorkView["project"],
  revision:"a".repeat(64),complete:true,records:[],files:[],messages:[],release,operation:null,outboundBlocked:false};
}
beforeEach(()=>{vi.clearAllMocks();});
afterEach(()=>cleanup());
const panel=(section:"production"|"history")=>render(<CaseWorkPanel projectId={id} section={section} onChanged={()=>{}} onDraftChange={()=>{}}/>);
it("raises only the form this case needs now and folds the others to one line",async()=>{
 m.fetch.mockResolvedValue(view({id:"33333333-3333-4333-8333-333333333333",expiresAt:"2026-10-20T00:00:00Z",acceptedAt:null,publishedAt:"2026-10-05T00:00:00Z"}));
 panel("production");
 const now=(await screen.findByText("いまはこれ")).closest("section")!;
 expect(now.querySelector("h3")?.textContent).toBe("受け取り済みとみなして完了にする");
 expect(screen.getAllByText("いまはこれ")).toHaveLength(1);
 for(const title of ["修正の依頼を記録","納品する"]){
  const details=screen.getByRole("heading",{name:title}).closest("details")!;
  expect(details).not.toBeNull();
  expect(details.open).toBe(false);
 }
 // The task buttons are not a form to fold.
 expect(screen.getByRole("heading",{name:"工程を進める"}).closest("details")).toBeNull();
});
it("raises nothing and folds every form when nothing is pressing",async()=>{
 m.fetch.mockResolvedValue(view({id:"33333333-3333-4333-8333-333333333333",expiresAt:"2099-01-01T00:00:00Z",acceptedAt:null,publishedAt:"2026-10-05T00:00:00Z"}));
 panel("production");
 await screen.findByRole("heading",{name:"納品する"});
 expect(screen.queryByText("いまはこれ")).toBeNull();
 expect(screen.getByRole("heading",{name:"修正の依頼を記録"}).closest("details")?.open).toBe(false);
});

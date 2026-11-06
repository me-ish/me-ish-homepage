// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CaseWorkView } from "../../../lib/caseWork";
const m=vi.hoisted(()=>({fetch:vi.fn(),admin:vi.fn()}));
vi.mock("../../../data/supabaseCaseWork",()=>({fetchCaseWork:m.fetch,mutateCaseWork:vi.fn()}));
vi.mock("../CaseAdministrationPanel",()=>({CaseAdministrationPanel:(props:{externalOrder?:boolean})=>{m.admin(props.externalOrder);return null;}}));
vi.mock("../../consultation/ConsultationThread",()=>({default:()=><p>トーク欄</p>}));
vi.mock("../../dashboard/DeliveryFilesManager",()=>({default:()=>null}));
vi.mock("../CaseItemsPanel",()=>({CaseItemsPanel:()=>null,CaseItemsProgress:()=>null}));
vi.mock("../useCaseItems",()=>({useCaseItems:()=>({})}));
import { CaseWorkPanel } from "../CaseWorkPanel";
const id="11111111-1111-4111-8111-111111111111",revision="a".repeat(64);
function view(origin:string,clientEmail:string|null):CaseWorkView{
 return {project:{id,status:"waiting",nextAction:"-",title:"架空案件",clientName:"架空依頼者",clientEmail,amount:30000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:"2026-10-01T00:00:00Z",note:null,requestData:null,mutationRevision:1,tasks:[],paymentConfirmedAt:null,paidAt:null,paidAmount:null,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null},
  revision,complete:true,files:[],messages:[],release:null,operation:null,outboundBlocked:false,
  records:[{id:"22222222-2222-4222-8222-222222222222",kind:"origin",data:{origin},operator:{kind:"auth-user",userId:null},created_at:"2026-10-01T00:00:00Z"} as unknown as CaseWorkView["records"][number]]};
}
beforeEach(()=>{vi.clearAllMocks();});
afterEach(()=>cleanup());
const panel=()=>render(<CaseWorkPanel projectId={id} section="consultation" onChanged={()=>{}} onDraftChange={()=>{}}/>);
it("treats a case registered by hand like an outside order and drops the empty talk",async()=>{
 m.fetch.mockResolvedValue(view("manual",null));
 panel();
 await waitFor(()=>expect(m.admin).toHaveBeenCalled());
 expect(m.admin).toHaveBeenLastCalledWith(true);
 expect(screen.queryByText("トーク欄")).toBeNull();
});
it("keeps the talk for a hand-registered case that has an email",async()=>{
 m.fetch.mockResolvedValue(view("manual","client@example.com"));
 panel();
 expect(await screen.findByText("トーク欄")).toBeTruthy();
});
it("keeps site cases on the site flow",async()=>{
 m.fetch.mockResolvedValue(view("internal",null));
 panel();
 expect(await screen.findByText("トーク欄")).toBeTruthy();
 expect(m.admin).toHaveBeenLastCalledWith(false);
});

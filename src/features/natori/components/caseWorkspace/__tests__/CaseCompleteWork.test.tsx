// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CaseWorkView } from "../../../lib/caseWork";
const m=vi.hoisted(()=>({fetch:vi.fn(),mutate:vi.fn()}));
vi.mock("../../../data/supabaseCaseWork",()=>({fetchCaseWork:m.fetch,mutateCaseWork:m.mutate}));
vi.mock("../CaseAdministrationPanel",()=>({CaseAdministrationPanel:()=>null}));
vi.mock("../../consultation/ConsultationThread",()=>({default:()=>null}));
vi.mock("../../dashboard/DeliveryFilesManager",()=>({default:()=>null}));
import { CaseWorkPanel } from "../CaseWorkPanel";
const id="11111111-1111-4111-8111-111111111111",revision="a".repeat(64);
function view(patch:Partial<CaseWorkView["project"]>={},rest:Partial<CaseWorkView>={}):CaseWorkView{
 return {project:{id,status:"delivery_prep",nextAction:"-",title:"架空案件",clientName:"架空依頼者",clientEmail:null,amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:"2026-10-01T00:00:00Z",note:null,requestData:null,mutationRevision:1,tasks:[],paymentConfirmedAt:null,paidAt:null,paidAmount:null,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null,...patch},
  revision,complete:true,records:[],files:[],messages:[],release:null,operation:null,outboundBlocked:false,...rest};
}
beforeEach(()=>{vi.clearAllMocks();});
afterEach(()=>cleanup());
const panel=()=>render(<CaseWorkPanel projectId={id} section="production" onChanged={()=>{}} onDraftChange={()=>{}}/>);
it("completes an outside-the-site case only after the confirm step",async()=>{
 m.fetch.mockResolvedValueOnce(view()).mockResolvedValue(view({status:"completed",completedAt:"2026-11-01T00:00:00Z"}));
 m.mutate.mockResolvedValue({result:"applied"});
 panel();
 fireEvent.click(await screen.findByRole("button",{name:"完了にする"}));
 expect(m.mutate).not.toHaveBeenCalled();
 expect(screen.getByText("完了にすると元に戻せません。")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"完了にする"}));
 await waitFor(()=>expect(m.mutate).toHaveBeenCalledTimes(1));
 expect(m.mutate.mock.calls[0][0]).toMatchObject({command:"complete",projectId:id,revision,kind:"external",note:"サイトの外で納品した"});
 expect(await screen.findByText("完了にしました。")).toBeTruthy();
 expect(screen.queryByRole("button",{name:"完了にする"})).toBeNull();
});
it("offers deemed completion for an expired, unaccepted delivery page without a date field",async()=>{
 m.fetch.mockResolvedValue(view({status:"delivered"},{release:{id,expiresAt:"2026-10-01T00:00:00Z",acceptedAt:null,publishedAt:"2026-09-01T00:00:00Z"}}));
 panel();
 fireEvent.click(await screen.findByRole("button",{name:"受け取り済みとみなして完了にする"}));
 expect(screen.queryByLabelText("完了した日")).toBeNull();
});
it("shows nothing for a site-form case before its delivery page",async()=>{
 m.fetch.mockResolvedValue(view({requestData:{schemaVersion:1}}));
 panel();
 await screen.findByText("工程を進める");
 expect(screen.queryByRole("button",{name:"完了にする"})).toBeNull();
});

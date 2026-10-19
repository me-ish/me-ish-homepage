// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import PaymentStopStatusPanel from "../PaymentStopStatusPanel";
const fetcher=vi.fn();
const job={id:"44444444-4444-4444-8444-444444444444",projectId:"22222222-2222-4222-8222-222222222222",title:"合成案件",status:"needs_review",createdAt:"2026-10-01T00:00:00Z",leaseUntil:null};
const data={enabled:true,checkedAt:"2026-10-19T01:00:00Z",unresolved:1,oldestAt:job.createdAt,jobs:[job],lastRun:{startedAt:"2026-10-19T00:20:00Z",finishedAt:"2026-10-19T00:20:30Z",outcome:"partial",failed:1},lastCompletedAt:"2026-10-19T00:20:30Z"};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue(response(data));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("shows partial failures and retries the same IDs with CSRF, then refreshes",async()=>{
 fetcher.mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({ok:true})).mockResolvedValueOnce(response({...data,unresolved:0,oldestAt:null,jobs:[]}));
 render(<PaymentStopStatusPanel/>);await screen.findByText("合成案件");expect(screen.getByText(/最後の定期実行に未完了/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"この停止ジョブを再試行"}));
 await screen.findByText("指定した停止ジョブの完了を確認しました。");await waitFor(()=>expect(screen.queryByText("合成案件")).toBeNull());
 expect(fetcher.mock.calls[1]).toEqual(["/api/natori/admin/payment-stops",{method:"POST",headers:{"Content-Type":"application/json","x-requested-with":"me-ish"},body:JSON.stringify({projectId:job.projectId,jobId:job.id})}]);
 expect(screen.getByText(/最後の定期実行に未完了/)).toBeTruthy();
});
it("does not treat a failed retry as completed, and refreshes the remaining job",async()=>{
 fetcher.mockResolvedValueOnce(response(data)).mockResolvedValueOnce(response({ok:false},503)).mockResolvedValueOnce(response(data));render(<PaymentStopStatusPanel/>);await screen.findByText("合成案件");fireEvent.click(screen.getByRole("button",{name:"この停止ジョブを再試行"}));await screen.findByRole("alert");expect(screen.queryByText("指定した停止ジョブの完了を確認しました。")).toBeNull();expect(screen.getByText("合成案件")).toBeTruthy();
});
it.each([null,{...data.lastRun,finishedAt:null,outcome:null},{...data.lastRun,startedAt:"2026-10-17T00:20:00Z"}])("shows missing, unfinished or late scheduled runs",async(lastRun)=>{fetcher.mockResolvedValueOnce(response({...data,lastRun}));render(<PaymentStopStatusPanel/>);await screen.findByText("合成案件");expect(screen.getAllByRole("status").length).toBeGreaterThan(0);});
it("does not present a failed read as no pending jobs",async()=>{fetcher.mockResolvedValueOnce(response({},503));render(<PaymentStopStatusPanel/>);await screen.findByRole("alert");expect(screen.queryByText(/停止未完了：0件/)).toBeNull();});
it("disables retry while a live lease is shown",async()=>{fetcher.mockResolvedValueOnce(response({...data,jobs:[{...job,status:"processing",leaseUntil:"2026-10-19T01:01:00Z"}]}));render(<PaymentStopStatusPanel/>);await screen.findByText("合成案件");expect((screen.getByRole("button",{name:"この停止ジョブを再試行"}) as HTMLButtonElement).disabled).toBe(true);});
it("hides the feature when disabled",async()=>{fetcher.mockResolvedValueOnce(response({enabled:false}));const {container}=render(<PaymentStopStatusPanel/>);await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());expect(container.textContent).toBe("");});

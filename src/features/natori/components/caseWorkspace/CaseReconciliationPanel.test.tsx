// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({read:vi.fn(),post:vi.fn()}));
vi.mock("../../data/supabaseCaseReconciliation",async()=>({...await vi.importActual<typeof import("../../data/supabaseCaseReconciliation")>("../../data/supabaseCaseReconciliation"),readReconciliation:m.read,postReconciliation:m.post}));
import {CaseReconciliationPanel} from "./CaseReconciliationPanel";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",project="33333333-3333-4333-8333-333333333333";
const view=(id:string)=>({revision:"a",operations:[],notifications:[{id,purpose:id,status:"unknown",attempt_no:1}],jobs:[],mailEvents:[],selectedNotice:id});
beforeEach(()=>{vi.clearAllMocks();m.read.mockImplementation(async(_p,_s,id)=>view(id));});afterEach(cleanup);
it("late manual refresh of notification A cannot overwrite the selected B read",async()=>{
 const renderPanel=(id:string)=><CaseReconciliationPanel projectId={project} selectedNotificationId={id} onChanged={()=>{}}/>;
 const panel=render(renderPanel(a));await screen.findByText(`選択した通知ID：${a}。この通知の照合入口です。別用途や他の未解決を解除しません。`);
 let finish!:(value:ReturnType<typeof view>)=>void;m.read.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 fireEvent.click(screen.getByRole('button',{name:'現在の記録を照会'}));panel.rerender(renderPanel(b));
 await screen.findByText(`選択した通知ID：${b}。この通知の照合入口です。別用途や他の未解決を解除しません。`);
 await act(async()=>finish(view(a)));
 expect(screen.getByText(`選択した通知ID：${b}。この通知の照合入口です。別用途や他の未解決を解除しません。`)).not.toBeNull();
 expect(screen.getAllByRole('button',{name:'メール受付を外部照合'})).toHaveLength(1);
});
it("an earlier mutation response cannot refresh or confirm a later selection; an uncertain outcome keeps the execution fence",async()=>{
 const renderPanel=(id:string)=><CaseReconciliationPanel projectId={project} selectedNotificationId={id} onChanged={()=>{}}/>;
 const panel=render(renderPanel(a));await screen.findByRole('button',{name:'メール受付を外部照合'});
 let reject!:(error:Error)=>void;m.post.mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;}));
 fireEvent.click(screen.getByRole('button',{name:'メール受付を外部照合'}));panel.rerender(renderPanel(b));
 await screen.findByText(`選択した通知ID：${b}。この通知の照合入口です。別用途や他の未解決を解除しません。`);
 await act(async()=>reject(Error('synthetic response loss')));
 expect(screen.getByRole('button',{name:'メール受付を外部照合'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getByText(/応答が未確認のため/)).not.toBeNull();expect(m.post).toHaveBeenCalledTimes(1);
});

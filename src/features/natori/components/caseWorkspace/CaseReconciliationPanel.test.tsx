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
 const panel=render(renderPanel(a));await screen.findByText(`${a} · 1回目 · 送れたか分かりません`);
 let finish!:(value:ReturnType<typeof view>)=>void;m.read.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 fireEvent.click(screen.getByRole('button',{name:'いまの記録を読み込む'}));panel.rerender(renderPanel(b));
 await screen.findByText(`${b} · 1回目 · 送れたか分かりません`);
 await act(async()=>finish(view(a)));
 expect(screen.getByText(`${b} · 1回目 · 送れたか分かりません`)).not.toBeNull();
 expect(screen.getAllByRole('button',{name:'メールが送れたか調べる'})).toHaveLength(1);
});
it("an earlier mutation response cannot refresh or confirm a later selection; an uncertain outcome keeps the execution fence",async()=>{
 const renderPanel=(id:string)=><CaseReconciliationPanel projectId={project} selectedNotificationId={id} onChanged={()=>{}}/>;
 const panel=render(renderPanel(a));await screen.findByRole('button',{name:'メールが送れたか調べる'});
 let reject!:(error:Error)=>void;m.post.mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;}));
 fireEvent.click(screen.getByRole('button',{name:'メールが送れたか調べる'}));panel.rerender(renderPanel(b));
 await screen.findByText(`${b} · 1回目 · 送れたか分かりません`);
 await act(async()=>reject(Error('synthetic response loss')));
 expect(screen.getByRole('button',{name:'メールが送れたか調べる'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getByText(/結果が分からないので/)).not.toBeNull();expect(m.post).toHaveBeenCalledTimes(1);
});

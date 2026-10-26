// @vitest-environment jsdom
import {StrictMode} from "react";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({load:vi.fn(),submit:vi.fn()}));
vi.mock("../../data/supabaseCaseSystem",()=>({loadCaseSystemReview:m.load,submitCaseSystemControl:m.submit,CaseSystemAccessRejected:class extends Error{}}));
import {CaseSystemControl} from "./CaseSystemControl";
import {CaseSystemAccessRejected} from "../../data/supabaseCaseSystem";
const state={owner:"22222222-2222-4222-8222-222222222222",generation:2,armed:true,commandsHeld:true,sendersHeld:true,readOnly:false,revision:"a".repeat(32),localUnknownRecords:1,localInFlightRecords:0,records:[],recordsComplete:true,externalAbsenceProven:false,priorRequestsMayComplete:true,scope:"local-ledgers-only"};
beforeEach(()=>{vi.clearAllMocks();m.load.mockReset();m.submit.mockReset();m.load.mockResolvedValue(state);vi.spyOn(window,"confirm").mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("StrictMode can read the held state; never automatically resumes or treats zero as proof",async()=>{
 render(<StrictMode><CaseSystemControl onAccessRejected={()=>{}}/></StrictMode>);
 await screen.findByText(/操作受付：停止中/);
 expect(screen.getByText(/0件でも外部で未実行だった証明にはなりません/)).not.toBeNull();
 expect(m.submit).not.toHaveBeenCalled();
 expect((screen.getByRole("button",{name:"操作受付だけ再開"}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole("button",{name:"送信受付を再開"}) as HTMLButtonElement).disabled).toBe(true);
});
it("one explicit resume carries the exact reviewed revision, then removes the old confirmation",async()=>{
 let saved!:()=>void;m.submit.mockReturnValue(new Promise<void>(r=>{saved=r;}));
 render(<CaseSystemControl onAccessRejected={()=>{}}/>);await screen.findByText(/操作受付：停止中/);
 fireEvent.click(screen.getByRole("checkbox"));const button=screen.getByRole("button",{name:"操作受付だけ再開"});fireEvent.click(button);fireEvent.click(button);
 expect(m.submit).toHaveBeenCalledExactlyOnceWith({action:"resume-commands",generation:2,revision:state.revision,acknowledgePrior:true});
 await act(async()=>saved());expect(screen.queryByRole("checkbox")).toBeNull();expect(screen.getByText(/操作画面の再開には再読み込み/)).not.toBeNull();
});
it("a lost control response does not retry or keep a resumable confirmation",async()=>{
 m.submit.mockRejectedValue(Error("response_lost"));render(<CaseSystemControl onAccessRejected={()=>{}}/>);await screen.findByText(/操作受付：停止中/);
 fireEvent.click(screen.getByRole("button",{name:"操作と送信を停止"}));await screen.findByText(/自動では再実行しません/);
 expect(m.submit).toHaveBeenCalledTimes(1);expect(screen.queryByRole("checkbox")).toBeNull();
});
it("authentication loss hides the reviewed details and rejects access",async()=>{
 const reject=vi.fn();render(<CaseSystemControl onAccessRejected={reject}/>);await screen.findByText(/操作受付：停止中/);
 m.load.mockRejectedValue(new CaseSystemAccessRejected());fireEvent.click(screen.getByRole("button",{name:"最新の停止状態を取得"}));
 await waitFor(()=>expect(reject).toHaveBeenCalledTimes(1));expect(screen.queryByText(/操作受付：停止中/)).toBeNull();
});

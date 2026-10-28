// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeAll,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {buildPreviewRecords} from "../../../../../scripts/natori-case-preview/fixtureReader";
import type {CaseWorkspaceRecord} from "../../types/caseWorkspace";
import {CaseWorkspacePreview} from "../../components/caseWorkspace/CaseWorkspacePreview";
import {CaseWorkspaceLoadError} from "../../types/caseWorkspaceLoad";
let record:CaseWorkspaceRecord;
beforeAll(async()=>{record=(await buildPreviewRecords())[0];window.scrollTo=vi.fn();});
afterEach(cleanup);
it("opens an exact case while the unrelated collection fails, without calling it missing",async()=>{
 const load=vi.fn().mockRejectedValue(Error('list unavailable')),detail=vi.fn().mockResolvedValue(record);
 render(<CaseWorkspacePreview application readOnly load={load} loadDetail={detail} initialSearch={`?case=${record.id}`}/>);
 await screen.findByRole('heading',{name:record.title});expect(screen.getByText('案件の一覧を読み込めませんでした。')).not.toBeNull();
 expect(detail.mock.calls[0][0]).toBe(record.id);
});
it("restores authorized detail after a rejection even if the collection remains unavailable",async()=>{
 const load=vi.fn().mockRejectedValue(Error('list unavailable')),detail=vi.fn().mockRejectedValueOnce(new CaseWorkspaceLoadError('unauthorized')).mockResolvedValue(record);
 render(<CaseWorkspacePreview application readOnly load={load} loadDetail={detail} initialSearch={`?case=${record.id}`}/>);
 await screen.findByText('ログインが切れました。もう一度ログインしてください。');
 fireEvent.click(screen.getByRole('button',{name:'再読み込み'}));
 await screen.findByRole('heading',{name:record.title});
});
it("discards a delayed former case when navigation has selected a different ID",async()=>{
 let finish!:(v:CaseWorkspaceRecord)=>void;const detail=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue(record);
 const other={...record,id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'古い対象'};
 const load=vi.fn().mockResolvedValue([]);
 render(<CaseWorkspacePreview application readOnly load={load} loadDetail={detail} initialSearch={`?case=${other.id}`}/>);
 await waitFor(()=>expect(detail).toHaveBeenCalledTimes(1));
 act(()=>{history.pushState(null,'',`/?case=${record.id}`);window.dispatchEvent(new PopStateEvent('popstate'));});
 await screen.findByRole('heading',{name:record.title});await act(async()=>finish(other));expect(screen.queryByRole('heading',{name:'古い対象'})).toBeNull();
});

it("keeps input focus in an open exact detail when the slower collection first arrives",async()=>{
 let finish!:(rows:readonly CaseWorkspaceRecord[])=>void;
 const load=vi.fn().mockImplementation(()=>new Promise(resolve=>{finish=resolve;})),detail=vi.fn().mockResolvedValue(record);
 render(<CaseWorkspacePreview application readOnly load={load} loadDetail={detail} initialSearch={`?case=${record.id}`}/>);
 await screen.findByRole('heading',{name:record.title});
 const search=screen.getByRole('searchbox');search.focus();expect(document.activeElement).toBe(search);
 await act(async()=>finish([record]));
 expect(document.activeElement).toBe(search);
});

import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const owner="22222222-2222-4222-8222-222222222222",project="a0000000-0000-4000-8000-000000000001",id="b0000000-0000-4000-8000-000000000001";
const mocks=vi.hoisted(()=>({target:vi.fn(),allowed:vi.fn()}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"22222222-2222-4222-8222-222222222222"}));
vi.mock("../caseAcceptance",()=>({acceptanceProjectAllowed:mocks.allowed}));
vi.mock("@/lib/caseAcceptanceEnvironment",()=>({assertServerAcceptanceTarget:mocks.target}));
import {readCaseNoticeIndex,readCasePersonalEvents} from "../caseEntryIndex";
const makeRead=(rows:unknown[])=>async()=>({data:{changed:false,revision:"a".repeat(32),total:rows.length,offset:0,next:null,rows},error:null});
const notice=()=>({id,user_id:owner,project_id:project,project_title:"合成案件",purpose:"quote_issue_client",status:"unknown",attempt_no:1,sent_at:null,created_at:"2026-10-22T00:00:00Z",target_id:project,target_revision:"2"});
beforeEach(()=>{mocks.target.mockReturnValue(false);mocks.allowed.mockResolvedValue(false);});
it("returns only minimal identifiers and typed revisions, never malformed snapshot content",async()=>{
 for(const target of ["https://example.invalid/private-token",'{"token":"synthetic-secret"}',null]){
  const result=await readCaseNoticeIndex(makeRead([{...notice(),target_id:target,target_revision:'{"body":"synthetic-secret"}'}]));
  expect(result.items[0]).toMatchObject({targetId:null,targetRevision:null});expect(JSON.stringify(result)).not.toMatch(/private-token|synthetic-secret/);
 }
 expect((await readCaseNoticeIndex(makeRead([notice()]))).items[0]).toMatchObject({targetId:project,targetRevision:"2"});
});
it("filters unregistered acceptance projects without relaxing owner validation",async()=>{
 mocks.target.mockReturnValue(true);expect((await readCaseNoticeIndex(makeRead([notice()]))).items).toEqual([]);
 mocks.allowed.mockResolvedValue(true);expect((await readCaseNoticeIndex(makeRead([notice()]))).items).toHaveLength(1);
 await expect(readCaseNoticeIndex(makeRead([{...notice(),user_id:project}]))).rejects.toThrow("scope_mismatch");
});
it("keeps personal dates and notes separate from project payment facts",async()=>{
 expect(await readCasePersonalEvents(makeRead([{id,user_id:owner,title:"個人予定",date:"2026-12-31",note:null}]))).toEqual([{id,title:"個人予定",date:"2026-12-31"}]);
 await expect(readCasePersonalEvents(makeRead([{id,user_id:owner,title:"予定",date:"2026-02-30",note:null}]))).rejects.toThrow();
});

import {beforeEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const owner="22222222-2222-4222-8222-222222222222",mine="a0000000-0000-4000-8000-000000000001",other="a0000000-0000-4000-8000-000000000002";
const message="b0000000-0000-4000-8000-000000000001",stray="b0000000-0000-4000-8000-000000000002";
const mocks=vi.hoisted(()=>({overviews:vi.fn(),messages:vi.fn(),projectFilter:vi.fn()}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>"22222222-2222-4222-8222-222222222222"}));
vi.mock("../caseAcceptance",()=>({acceptanceProjectAllowed:async()=>true}));
vi.mock("@/lib/caseAcceptanceEnvironment",()=>({assertServerAcceptanceTarget:()=>false}));
vi.mock("../consultationOverviewService",()=>({loadConsultationOverviews:mocks.overviews}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({from:(table:string)=>table==="natori_projects"
  ?{select:()=>({eq:async(column:string,value:string)=>{mocks.projectFilter(column,value);return {data:[{id:mine}],error:null};}})}
  :{select:()=>({in:async()=>mocks.messages()})}})}));
import {readCaseTalkPreviews} from "../caseEntryIndex";
beforeEach(()=>{mocks.overviews.mockResolvedValue(new Map([[mine,{latestMessageId:message}]]));});
it("returns only a short first line of the owner's latest messages",async()=>{
  mocks.messages.mockResolvedValue({data:[{id:message,project_id:mine,body:"ラフ見ました！\n秘密の続き",attachment_count:0},{id:stray,project_id:other,body:"他人の本文",attachment_count:0}],error:null});
  const items=await readCaseTalkPreviews();
  expect(mocks.projectFilter).toHaveBeenCalledWith("user_id",owner);
  expect(items).toEqual([{projectId:mine,messageId:message,excerpt:"ラフ見ました！"}]);
  expect(JSON.stringify(items)).not.toMatch(/秘密の続き|他人の本文/);
});
it("fails instead of returning an empty list when the talk overview cannot be read",async()=>{
  mocks.overviews.mockResolvedValue(null);
  await expect(readCaseTalkPreviews()).rejects.toThrow("talk_overview_unavailable");
});

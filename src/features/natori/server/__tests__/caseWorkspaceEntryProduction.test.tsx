import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("server-only", () => ({}));
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc:m.rpc})}));
vi.mock("../../components/caseWorkspace/CaseWorkspaceApp",()=>({
  CaseWorkspaceApp:({readOnly,entryTools}:{readOnly:boolean;entryTools:boolean})=>
    <div data-read-only={String(readOnly)} data-entry-tools={String(entryTools)}/>,
}));
import {CaseWorkspaceEntryPage} from "../../components/caseWorkspace/CaseWorkspaceEntryPage";

const owner="22222222-2222-4222-8222-222222222222";
const target={profile:"production",ref:"abcdefghijklmnopqrst",project:"prj_synthetic",origin:"https://release.example.invalid",owner};
const warning="導線の検証プレビューです。本番切替・実サービス受入は未実施です。";
beforeEach(()=>{
  vi.clearAllMocks();
  for(const key of ["NATORI_CASE_ACCEPTANCE_TARGET","NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET"])
    vi.stubEnv(key,undefined);
  for(const [key,value]of Object.entries({NODE_ENV:"production",VERCEL_ENV:"production",VERCEL_PROJECT_ID:target.project,
    NATORI_OWNER_USER_ID:owner,SUPABASE_URL:`https://${target.ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_URL:`https://${target.ref}.supabase.co`,
    NEXT_PUBLIC_SITE_URL:target.origin,NATORI_CASE_RELEASE_ENABLED:"1",NATORI_CASE_RELEASE_TARGET:JSON.stringify(target),
    NATORI_CASE_BOOTSTRAP_PHASE:"managed",NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:"1",NATORI_CASE_RELEASE_COMMANDS_ENABLED:"1"}))
    vi.stubEnv(key,value);
  m.rpc.mockResolvedValue({data:{owner,generation:3,armed:true,commandsHeld:false,sendersHeld:false,readOnly:false},error:null});
});
afterEach(()=>vi.unstubAllEnvs());

it.each([
  {source:"all" as const},
  {entry:"cases" as const,source:"all" as const},
  {entry:"cases" as const,source:"inquiries" as const},
  {entry:"cases" as const,source:"estimate" as const},
])("keeps the production $entry/$source entry interactive without a preview claim or a duplicate link bar",async props=>{
  const html=renderToStaticMarkup(await CaseWorkspaceEntryPage({input:{},preview:true,...props}));
  expect(html).not.toContain(warning);
  expect(html).not.toContain("<aside");
  expect(html).toContain('data-read-only="false"');
  expect(html).toContain('data-entry-tools="true"');
});

it.each(["read-only","system-hold","status-error"])("does not disguise a production %s restriction as a preview",async restriction=>{
  if(restriction==="read-only")vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","read-only");
  if(restriction==="system-hold")m.rpc.mockResolvedValue({data:{owner,generation:4,armed:true,commandsHeld:true,sendersHeld:true,readOnly:true},error:null});
  if(restriction==="status-error")m.rpc.mockResolvedValue({data:null,error:new Error("synthetic status unavailable")});
  const html=renderToStaticMarkup(await CaseWorkspaceEntryPage({input:{},preview:true}));
  expect(html).not.toContain(warning);
  expect(html).toContain('data-read-only="true"');
});

it("keeps the warning for a non-production preview and preserves the direct cases entry",async()=>{
  vi.stubEnv("NATORI_CASE_RELEASE_ENABLED","0");
  vi.stubEnv("NATORI_CASE_RELEASE_TARGET",undefined);
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("VERCEL_ENV",undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:4193");
  expect(renderToStaticMarkup(await CaseWorkspaceEntryPage({input:{},preview:true}))).toContain(warning);
  expect(renderToStaticMarkup(await CaseWorkspaceEntryPage({input:{}}))).not.toContain(warning);
});

it("never treats a mismatched production target as a valid release",async()=>{
  vi.stubEnv("VERCEL_PROJECT_ID","prj_wrong");
  await expect(CaseWorkspaceEntryPage({input:{},preview:true})).rejects.toThrow("case_release_target_invalid");
});

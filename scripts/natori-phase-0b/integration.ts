import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookieScope } from "./cookies";

let stage = "configuration";
async function main() {
  const {origin} = JSON.parse(readFileSync("/runtime/network.json","utf8")) as {origin:string};
  if (!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin)) throw new Error("DESTINATION_REJECTED");
  const keys = JSON.parse(readFileSync("/runtime/credentials.json","utf8")) as {anon:string;service:string};
  process.env.NEXT_PUBLIC_SUPABASE_URL=origin;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=keys.anon;
  process.env.SUPABASE_SERVICE_ROLE_KEY=keys.service;
  process.env.NATORI_DASHBOARD_KEY=randomBytes(32).toString("hex");
  process.env.ADMIN_EMAILS="";
  const admin=createClient(origin,keys.service,{auth:{persistSession:false,autoRefreshToken:false}});
  const check: (ok:unknown,code:string)=>asserts ok = (ok,code) => {if(!ok)throw new Error(code);};
  const {createClient:createSsrClient}=await import("../../src/lib/supabase/server");
  const {deriveNatoriDashboardCookieToken}=await import("../../src/features/natori/lib/dashboardKeyToken");
  const {NATORI_KEY_COOKIE}=await import("../../src/features/natori/constants/dashboardKey");
  const projects=await import("../../src/app/api/natori/admin/projects/route");
  const events=await import("../../src/app/api/natori/admin/events/route");
  const profile=await import("../../src/app/api/natori/admin/profile/route");
  const pricing=await import("../../src/app/api/natori/admin/pricing/route");
  const {createInquiryProject}=await import("../../src/features/natori/server/inquiryProjectService");
  const {resolveNatoriManagementContext}=await import("../../src/features/natori/server/natoriOwner");
  const {withNatoriManagement}=await import("../../src/features/natori/server/natoriManagementRoute");
  const actors: {name:string;id:string;jar:Map<string,string>}[]=[];
  stage="real-auth-users";
  for(const name of ["owner","staff-a","staff-b","stranger"]){
    const email=`${name}@phase0b.invalid`,password=randomBytes(32).toString("hex");
    const user=await admin.auth.admin.createUser({email,password,email_confirm:true});
    check(!user.error&&user.data.user,"AUTH_CREATE");
    const jar=new Map<string,string>();
    await cookieScope.run(jar,async()=>{
      const ssr=await createSsrClient();
      const login=await ssr.auth.signInWithPassword({email,password});
      check(!login.error&&login.data.user?.id===user.data.user!.id,"AUTH_LOGIN");
      const verified=await ssr.auth.getUser();
      check(!verified.error&&verified.data.user?.id===user.data.user!.id,"AUTH_VERIFIED");
    });
    check(jar.size>0,"SSR_COOKIES_MISSING");
    actors.push({name,id:user.data.user.id,jar});
  }
  const [owner,a,b,stranger]=actors;
  process.env.NATORI_OWNER_USER_ID=owner.id;
  process.env.NATORI_OWNER_EMAILS="owner@phase0b.invalid";
  process.env.NATORI_STAFF_EMAILS="staff-a@phase0b.invalid,staff-b@phase0b.invalid";
  const shared=new Map([[NATORI_KEY_COOKIE,await deriveNatoriDashboardCookieToken(process.env.NATORI_DASHBOARD_KEY)]]);
  const mixed=new Map([...stranger.jar,...shared]);
  const req=(method:string,body:object,csrf=true)=>new Request("http://localhost/api/natori/admin/projects",{method,headers:{"content-type":"application/json",...(csrf?{"x-requested-with":"me-ish"}:{})},body:JSON.stringify(body)});
  const run=<T>(jar:Map<string,string>,fn:()=>Promise<T>)=>cookieScope.run(new Map(jar),fn);
  const results:{name:string;status:string;code?:string}[]=[];
  async function test(name:string,fn:()=>Promise<void>){
    try{await fn();results.push({name,status:"passed"});console.log(`PASS phase0b/${name}`);}
    catch(error){const code=error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:"UNEXPECTED_ERROR";results.push({name,status:"failed",code});console.log(`FAIL phase0b/${name} ${code}`);}
  }
  stage="multi-owner-fixture";
  const fixture=await admin.from("natori_projects").insert(actors.map((actor,index)=>({user_id:actor.id,title:`fixture-${actor.name}`,client_name:"Synthetic",type:"undecided",status:"inquiry",amount:1000,due_date:"2026-12-01",paid_at:"2026-09-01T00:00:00Z",paid_amount:1000,request_data:{sentinel:index},agreed_terms:{sentinel:index}}))).select("*");
  check(!fixture.error&&fixture.data?.length===4,"PROJECT_FIXTURE");
  const ownerRow=fixture.data.find(r=>r.user_id===owner.id)!;
  const foreignRow=fixture.data.find(r=>r.user_id===stranger.id)!;
  for(const table of ["natori_events","natori_user_profiles","natori_pricing_configs"]){
    const rows=actors.map(actor=>table==="natori_events"?{user_id:actor.id,title:actor.name,date:"2026-12-01"}:table==="natori_user_profiles"?{user_id:actor.id,display_name:actor.name}:{user_id:actor.id,preset_key:"base",name:actor.name,config:{rate:1000},sort_order:0,is_default:true});
    const r=await admin.from(table).insert(rows);check(!r.error,"SUPPORT_FIXTURE");
  }
  stage="tests";
  for(const actor of [...actors.slice(0,3),{name:"shared",id:null,jar:shared},{name:"shared-plus-stranger",id:null,jar:mixed}]){
    await test(`same-owner-list-${actor.name}`,async()=>{
      const r=await run(actor.jar,()=>projects.GET());check(r.status===200,"LIST_STATUS");
      const body=await r.json();check(body.projects.length===1&&body.projects[0].id===ownerRow.id,"WRONG_OWNER_DATASET");
      const context=await run(actor.jar,resolveNatoriManagementContext);
      check(context.ownerId===owner.id&&context.operator.userId===actor.id,"WRONG_OPERATOR");
      check(context.operator.kind===(actor.id?"auth-user":"shared-key"),"OPERATOR_KIND");
    });
  }
  for(const [name,jar] of [["anonymous",new Map<string,string>()],["stranger",stranger.jar],["forged-cookie",new Map([[NATORI_KEY_COOKIE,"invalid"]])]] as const){
    await test(`deny-${name}`,async()=>{
      check((await run(jar,()=>projects.GET())).status===401,"DENIED_READ");
      check((await run(jar,()=>projects.POST(req("POST",{title:"bad",clientName:"bad",type:"icon"})))).status===401,"DENIED_WRITE");
    });
  }
  await test("concurrent-request-identities",async()=>{
    const probe=withNatoriManagement("integration-probe.GET",false,async()=>{await new Promise(resolve=>setTimeout(resolve,10));return Response.json(await resolveNatoriManagementContext());});
    const responses=await Promise.all([run(a.jar,probe),run(b.jar,probe),run(mixed,probe)]);
    const values=await Promise.all(responses.map(r=>r.json()));
    check(values[0].operator.userId===a.id&&values[1].operator.userId===b.id&&values[2].operator.userId===null,"CONTEXT_LEAK");
  });
  await test("supporting-datasets-same-owner",async()=>{
    const responses=await run(b.jar,()=>Promise.all([events.GET(),profile.GET(),pricing.GET()]));
    for(const response of responses)check(response.status===200,"SUPPORT_STATUS");
    const [e,p,c]=await Promise.all(responses.map(r=>r.json()));
    check(e.events.length===1&&e.events[0].user_id===owner.id,"EVENT_OWNER");
    check(p.profile.user_id===owner.id,"PROFILE_OWNER");
    check(c.presets.length===1&&c.presets[0].user_id===owner.id,"PRICING_OWNER");
  });
  const draft={title:"new-synthetic",clientName:"Synthetic",type:"icon",amount:0,userId:stranger.id};
  for(const [name,jar] of [["staff",a.jar],["shared-with-stranger",mixed]] as const){
    await test(`create-ignores-input-owner-${name}`,async()=>{
      const r=await run(jar,()=>projects.POST(req("POST",draft)));check(r.status===200,"CREATE_STATUS");
      const {projectId}=await r.json();
      const row=await admin.from("natori_projects").select("user_id").eq("id",projectId).single();check(!row.error&&row.data?.user_id===owner.id,"CREATE_OWNER");
      const tasks=await admin.from("natori_project_tasks").select("id").eq("project_id",projectId);check(!tasks.error&&tasks.data.length>0,"TASKS_MISSING");
    });
  }
  await test("csrf-remains-required",async()=>{check((await run(a.jar,()=>projects.POST(req("POST",draft,false)))).status===403,"CSRF_BYPASS");});
  await test("foreign-project-update-denied-and-unchanged",async()=>{
    const r=await run(a.jar,()=>projects.PATCH(req("PATCH",{kind:"project-details",projectId:foreignRow.id,patch:{title:"must-not-write"}})));
    check(r.status===404,"FOREIGN_UPDATE_ALLOWED");
    const row=await admin.from("natori_projects").select("*").eq("id",foreignRow.id).single();check(!row.error&&JSON.stringify(row.data)===JSON.stringify(foreignRow),"FOREIGN_ROW_CHANGED");
  });
  await test("owner-update-preserves-established-facts",async()=>{
    const r=await run(b.jar,()=>projects.PATCH(req("PATCH",{kind:"project-details",projectId:ownerRow.id,patch:{title:"renamed"}})));check(r.status===200,"OWNER_UPDATE");
    const row=await admin.from("natori_projects").select("*").eq("id",ownerRow.id).single();check(!row.error&&row.data?.title==="renamed","UPDATE_READBACK");
    for(const key of ["user_id","status","paid_at","paid_amount","request_data","agreed_terms"]){check(JSON.stringify(row.data[key])===JSON.stringify(ownerRow[key]),"FACT_CHANGED");}
  });
  const legacy={name:"Synthetic",email:"customer@phase0b.invalid",requestType:"アイコン",plan:"胸上",options:[],budget:"相談",deadline:"相談",details:"Synthetic",message:"Synthetic",refUrls:""};
  for(const [name,jar] of [["anonymous",new Map<string,string>()],["stranger",stranger.jar]] as const){
    await test(`legacy-fixed-owner-${name}`,async()=>{
      const r=await run(jar,()=>createInquiryProject(legacy));check(r.kind==="ok","LEGACY_CREATE");
      const row=await admin.from("natori_projects").select("user_id").eq("id",r.projectId).single();check(!row.error&&row.data?.user_id===owner.id,"LEGACY_OWNER");
    });
  }
  for(const setting of ["","invalid"]){
    await test(`configuration-fail-closed-${setting||"missing"}`,async()=>{
      const before=await admin.from("natori_projects").select("id",{count:"exact",head:true});check(!before.error,"COUNT_BEFORE");
      process.env.NATORI_OWNER_USER_ID=setting;
      try{
        for(const get of [projects.GET,events.GET,profile.GET,pricing.GET]){
          const r=await run(a.jar,get);check(r.status===503,"CONFIG_EMPTY_SUCCESS");check((await r.json()).code==="natori_owner_unavailable","CONFIG_ERROR_CODE");
        }
        check((await run(mixed,()=>projects.POST(req("POST",draft)))).status===503,"CONFIG_WRITE_ALLOWED");
        check((await run(stranger.jar,()=>createInquiryProject(legacy))).kind==="no-owner","CONFIG_LEGACY_ALLOWED");
      }finally{process.env.NATORI_OWNER_USER_ID=owner.id;}
      const after=await admin.from("natori_projects").select("id",{count:"exact",head:true});check(!after.error&&after.count===before.count,"CONFIG_WROTE_ROW");
    });
  }
  const summary={passed:results.filter(r=>r.status==="passed").length,failed:results.filter(r=>r.status==="failed").length,skipped:0,results};
  writeFileSync("/results/phase0b.json",JSON.stringify(summary,null,2));
  console.log(`SUMMARY phase0b: passed=${summary.passed} failed=${summary.failed} skipped=0`);
  if(summary.failed)process.exitCode=1;
}
main().catch(error=>{
  const code=error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?error.message:"UNEXPECTED_SETUP_ERROR";
  console.error(`FAIL phase0b setup: ${stage} ${code}`);process.exitCode=1;
});

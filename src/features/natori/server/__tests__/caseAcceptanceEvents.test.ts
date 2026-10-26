import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../natoriOwner",()=>({resolveNatoriOwnerId:async()=>process.env.NATORI_OWNER_USER_ID}));
const db=vi.hoisted(()=>({from:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>db}));
import {acceptanceEventConfiguration,acceptanceEventRequestAllowed,acceptancePersonalEventsAvailable} from "../caseAcceptanceEvents";
import {createNatoriAdminEvent,listNatoriAdminEvents,updateNatoriAdminEvent,deleteNatoriAdminEvent} from "../eventsService";
const owner="22222222-2222-4222-8222-222222222222",run="44444444-4444-4444-8444-444444444444",id="55555555-5555-4555-8555-555555555555",foreign="66666666-6666-4666-8666-666666666666";
const now=Date.now(),target={profile:"local",ref:"local",project:"local-fixture",url:"http://localhost:4193",origin:"http://localhost:4195",run,startsAt:new Date(now-60000).toISOString(),endsAt:new Date(now+3600000).toISOString()};
const fixture={id,create:{title:"合成予定",date:"2026-11-12",note:null}},config={run,owner,firstDate:"2026-11-01",lastDate:"2026-11-30",operations:["create","update","delete"],fixtures:[fixture]};
let active=true,stored:Record<string,unknown>|null,changes:unknown[],filters:unknown[],queries:string[];
const request=(method="GET",body?:unknown,query="")=>new Request(target.origin+"/api/natori/admin/events"+query,{method,...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
beforeEach(()=>{
 vi.stubEnv("NATORI_OWNER_USER_ID",owner);vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET",JSON.stringify(target));vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",JSON.stringify(target));vi.stubEnv("SUPABASE_URL",target.url);vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",target.url);vi.stubEnv("VERCEL_ENV","");vi.stubEnv("NATORI_CASE_ACCEPTANCE_EVENTS",JSON.stringify(config));vi.stubEnv("NATORI_CASE_ACCEPTANCE_MAIL_SCOPE","fixture-mail");vi.stubEnv("NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT","acct_fixture");
 active=true;stored=null;changes=[];filters=[];queries=[];db.from.mockReset();
 db.from.mockImplementation((table:string)=>{
  queries.push(table);let mutation:unknown;
  const get=()=>({error:null,data:table==="natori_case_acceptance_runs"?{id:run,owner_id:owner,project_ref:target.ref,origin:target.origin,provider_scope:"fixture-mail",stripe_account:"acct_fixture",enabled:active,starts_at:target.startsAt,ends_at:target.endsAt}:stored});
  const q={select:vi.fn(()=>q),eq:vi.fn((k,v)=>{filters.push([table,k,v]);return q;}),in:vi.fn((k,v)=>{filters.push([table,k,v]);return q;}),insert:vi.fn(v=>{mutation=v;changes.push(["insert",v]);return q;}),update:vi.fn(v=>{changes.push(["update",v]);return q;}),delete:vi.fn(()=>{changes.push(["delete"]);return q;}),maybeSingle:vi.fn(async()=>get()),single:vi.fn(async()=>({error:null,data:mutation})),order:vi.fn(async()=>({error:null,data:stored?[stored]:[]}))};return q;
 });
});
afterEach(()=>vi.unstubAllEnvs());
describe("dedicated personal-event fixture contract",()=>{
 it("stays closed when unset and does not change ordinary availability",async()=>{
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_EVENTS","");expect(acceptancePersonalEventsAvailable()).toBe(false);expect(await acceptanceEventRequestAllowed("events.GET",request(),false)).toBe(false);
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET","");vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET","");expect(acceptanceEventConfiguration()).toBeNull();expect(acceptancePersonalEventsAvailable()).toBe(true);
 });
 it.each([{run:foreign},{owner:foreign},{fixtures:[fixture,fixture]},{operations:["create","create"]},{firstDate:"2026-12-01"},{fixtures:[fixture,{...fixture,id:foreign}]}])("rejects mismatched or ambiguous fixture configuration %j",patch=>{
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_EVENTS",JSON.stringify({...config,...patch}));expect(acceptancePersonalEventsAvailable()).toBe(false);expect(()=>acceptanceEventConfiguration()).toThrow();
 });
 it("only admits registered content/ID/date/method and strict selectors",async()=>{
  expect(await acceptanceEventRequestAllowed("events.POST",request("POST",{title:fixture.create.title,date:fixture.create.date}),true)).toBe(true);
  expect(await acceptanceEventRequestAllowed("events.POST",request("POST",{...fixture.create,owner:foreign}),true)).toBe(false);
  expect(await acceptanceEventRequestAllowed("events.POST",request("POST",{...fixture.create,title:"not approved"}),true)).toBe(false);
  expect(await acceptanceEventRequestAllowed("events.PATCH",request("PATCH",{id,date:"2026-12-01"}),true)).toBe(false);
  expect(await acceptanceEventRequestAllowed("events.PATCH",request("PATCH",{id:foreign,title:"blocked"}),true)).toBe(false);
  expect(await acceptanceEventRequestAllowed("events.DELETE",request("DELETE",undefined,"?id="+id+"&id="+foreign),true)).toBe(false);
  expect(await acceptanceEventRequestAllowed("events.DELETE",request("DELETE",undefined,"?id="+id),true)).toBe(true);
 });
 it("filters both owner and fixture IDs before fetching rather than returning all owner events",async()=>{
  await listNatoriAdminEvents();expect(filters).toContainEqual(["natori_events","user_id",owner]);expect(filters).toContainEqual(["natori_events","id",[id]]);
 });
 it("uses the one frozen ID and recovers an exact saved result without a second insert",async()=>{
  const input={userId:owner,...fixture.create};expect((await createNatoriAdminEvent(input)).kind).toBe("ok");expect(changes).toEqual([["insert",{id,user_id:owner,...fixture.create}]]);
  expect(filters).toContainEqual(["natori_events","id",id]);expect(filters).toContainEqual(["natori_events","user_id",owner]);
  changes=[];stored={id,user_id:owner,...fixture.create};expect((await createNatoriAdminEvent(input)).kind).toBe("ok");expect(changes).toEqual([]);
  stored={...stored,user_id:foreign};expect((await createNatoriAdminEvent(input)).kind).toBe("db-error");expect(changes).toEqual([]);
 });
 it("never updates/deletes another ID even through direct service invocation",async()=>{
  expect(await updateNatoriAdminEvent(foreign,{title:"blocked"})).toEqual({kind:"not-found"});expect(await deleteNatoriAdminEvent(foreign)).toEqual({kind:"not-found"});expect(changes).toEqual([]);
  stored={id,user_id:owner,...fixture.create};await updateNatoriAdminEvent(id,{date:"2026-11-13"});await deleteNatoriAdminEvent(id);expect(filters).toContainEqual(["natori_events","id",id]);expect(filters).toContainEqual(["natori_events","user_id",owner]);
 });
 it("run disablement preserves exact reads but rejects new CRUD before event mutation",async()=>{
  active=false;expect(await acceptanceEventRequestAllowed("events.GET",request(),false)).toBe(true);
  expect(await acceptanceEventRequestAllowed("events.POST",request("POST",fixture.create),true)).toBe(false);
  await expect(createNatoriAdminEvent({userId:owner,...fixture.create})).rejects.toThrow();expect(changes).toEqual([]);
 });
 it("mismatched provider scope fails closed even for reads",async()=>{
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT","acct_other");expect(await acceptanceEventRequestAllowed("events.GET",request(),false)).toBe(false);expect(queries).not.toContain("natori_events");
 });
});

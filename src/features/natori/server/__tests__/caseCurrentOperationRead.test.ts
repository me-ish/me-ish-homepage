import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({admin:vi.fn()}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:m.admin}));
import {readCurrentOperation} from "../caseCurrentFlow";

const owner="22222222-2222-4222-8222-222222222222";
const project="33333333-3333-4333-8333-333333333333";
const id="44444444-4444-4444-8444-444444444444";
let requests:URL[];
beforeEach(()=>{
 requests=[];
 m.admin.mockReturnValue(createClient("http://localhost:4193","synthetic-not-a-key",{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async (input,init)=>{
   const url=new URL(input instanceof Request?input.url:String(input));requests.push(url);
   expect(url.origin).toBe("http://localhost:4193");
   expect(init?.method??(input instanceof Request?input.method:"GET")).toBe("GET");
   // Mirror the RPC's text-selector predicates: literal "null" is a filter,
   // unlike an omitted argument which uses PostgreSQL's SQL NULL default.
   const selectedId=url.searchParams.get("p_id"),kind=url.searchParams.get("p_kind");
   return Response.json((selectedId===null||selectedId===id)&&(kind===null||kind==="payment")
    ?{id,kind:"payment",status:"unknown",response:null,quote_id:null,sent_at:null,created_at:"2026-10-26T00:00:00Z",version:1}:null);
  }},
 }));
});
afterEach(()=>vi.clearAllMocks());

it("recovers the latest operation without serializing absent optional arguments as text null",async()=>{
 await expect(readCurrentOperation(owner,project)).resolves.toMatchObject({id,status:"unknown"});
 expect(requests).toHaveLength(1);
 expect(requests[0].searchParams.get("p_owner")).toBe(owner);
 expect(requests[0].searchParams.get("p_project")).toBe(project);
 expect(requests[0].searchParams.has("p_id")).toBe(false);
 expect(requests[0].searchParams.has("p_kind")).toBe(false);
});
it("recovers an exact operation while omitting only its absent kind",async()=>{
 await expect(readCurrentOperation(owner,project,id)).resolves.toMatchObject({id,status:"unknown"});
 expect(requests[0].searchParams.get("p_id")).toBe(id);
 expect(requests[0].searchParams.has("p_kind")).toBe(false);
});
it("preserves both exact selectors when supplied",async()=>{
 await readCurrentOperation(owner,project,id,"payment");
 expect(requests[0].searchParams.get("p_id")).toBe(id);
 expect(requests[0].searchParams.get("p_kind")).toBe("payment");
});
it("recovers the latest payment while preserving its kind selector",async()=>{
 await expect(readCurrentOperation(owner,project,undefined,"payment")).resolves.toMatchObject({id,status:"unknown"});
 expect(requests[0].searchParams.has("p_id")).toBe(false);
 expect(requests[0].searchParams.get("p_kind")).toBe("payment");
});

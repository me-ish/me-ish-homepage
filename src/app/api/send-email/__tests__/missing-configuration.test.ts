import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({construct:vi.fn(),send:vi.fn(),insert:vi.fn()}));
vi.mock("resend",()=>({Resend:class {emails={send:m.send};constructor(key:string){m.construct(key);if(!key)throw Error("missing key");}}}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({from:()=>({insert:m.insert})})}));
vi.mock("@/lib/rateLimit",()=>({checkRateLimit:async()=>({allowed:true}),getIpFromRequest:()=>null,rateLimitExceeded:()=>new Response(null,{status:429})}));
const key="re_synthetic_unit_only",admin="synthetic-unit-admin";
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubEnv("RESEND_API_KEY","");vi.stubEnv("ADMIN_API_TOKEN",admin);m.send.mockResolvedValue({data:{id:"synthetic_mail"},error:null});m.insert.mockResolvedValue({error:null});});
afterEach(()=>vi.unstubAllEnvs());
const request=(body:unknown,token=admin)=>new NextRequest("http://localhost/api/send-email/submit",{method:"POST",headers:{"content-type":"application/json","x-meish-admin-token":token},body:JSON.stringify(body)});
it("can import both full-app routes without a Resend key or any SDK construction",async()=>{
 await import("../[kind]/route");await import("../send-contact/route");expect(m.construct).not.toHaveBeenCalled();
});
it("missing mail configuration keeps existing 500 responses, without DB or provider work",async()=>{
 const kind=await import("../[kind]/route"),contact=await import("../send-contact/route");
 expect((await kind.POST(request({}),{params:Promise.resolve({kind:"submit"})})).status).toBe(500);
 expect((await contact.POST(request({}))).status).toBe(500);
 expect(m.construct).not.toHaveBeenCalled();expect(m.insert).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
});
it("configured kind route still authenticates before provider construction",async()=>{
 vi.stubEnv("RESEND_API_KEY",key);const kind=await import("../[kind]/route");
 expect((await kind.POST(request({},"wrong"),{params:Promise.resolve({kind:"submit"})})).status).toBe(401);expect(m.construct).not.toHaveBeenCalled();
});
it("configured routes still validate before provider construction",async()=>{
 vi.stubEnv("RESEND_API_KEY",key);const kind=await import("../[kind]/route"),contact=await import("../send-contact/route");
 expect((await kind.POST(request({}),{params:Promise.resolve({kind:"submit"})})).status).toBe(400);
 expect((await contact.POST(request({}))).status).toBe(400);expect(m.construct).not.toHaveBeenCalled();
});
it("configured valid template keeps the existing explicit send contract using a test double",async()=>{
 vi.stubEnv("RESEND_API_KEY",key);const kind=await import("../[kind]/route");
 const response=await kind.POST(request({to:"synthetic@example.invalid",name:"架空の依頼者"}),{params:Promise.resolve({kind:"submit"})});
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:"sent",id:"synthetic_mail"});expect(m.construct).toHaveBeenCalledWith(key);expect(m.send).toHaveBeenCalledTimes(1);
});

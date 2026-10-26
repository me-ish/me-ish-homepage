import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({rpc})}));
import {collectCaseEntryPages,type CasePageRead} from "../caseEntryPages";
const owner="22222222-2222-4222-8222-222222222222",foreign="33333333-3333-4333-8333-333333333333",revision="a".repeat(32);
const row=(n:number)=>({id:`a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`,user_id:owner});
const page=(offset=0,total=121,kind="events")=>({changed:false,revision,total,offset,next:Math.min(offset+50,total)<total?offset+50:null,rows:Array.from({length:Math.min(50,total-offset)},(_,n)=>kind==="cases"?{project:row(offset+n)}:row(offset+n))});
it("omits a NULL first-page revision on the actual GET transport instead of serializing text null",async()=>{
 rpc.mockResolvedValue({data:page(0,0),error:null});await collectCaseEntryPages(owner,"events");
 expect(rpc).toHaveBeenCalledWith("natori_case_entry_page_v1",{p_owner_id:owner,p_kind:"events",p_offset:0},{get:true});
});
it.each(["cases","events","notices"] as const)("collects every %s page, preserving exact identity beyond 50",async kind=>{
 const read=vi.fn<CasePageRead>(async args=>({data:page(args.p_offset,121,kind),error:null}));
 const value=await collectCaseEntryPages(owner,kind,read);expect(value.rows).toHaveLength(121);expect(read).toHaveBeenCalledTimes(3);
 expect(read.mock.calls[1][0]).toEqual({p_owner_id:owner,p_kind:kind,p_offset:50,p_revision:revision});
});
it("fails the complete read when a later page fails, changes, repeats or contradicts its count",async()=>{
 for(const corrupt of [
  {...page(50),changed:true},{...page(50),revision:"b".repeat(32)},{...page(50),total:122},
  {...page(50),offset:0},{...page(50),next:50},{...page(50),rows:[...page(50).rows.slice(1)]},
  {...page(50),rows:page(0).rows},{...page(50),rows:[{...row(50),user_id:foreign},...page(50).rows.slice(1)]},
 ]){
  const read:CasePageRead=async args=>({data:args.p_offset===0?page():corrupt,error:null});
  await expect(collectCaseEntryPages(owner,"events",read)).rejects.toThrow();
 }
 const read:CasePageRead=async args=>({data:args.p_offset===0?page():null,error:args.p_offset===0?null:{message:"SQL details"}});
 await expect(collectCaseEntryPages(owner,"events",read)).rejects.toThrow("case_entry_read_unavailable");
});
it("distinguishes a complete empty owner collection from incomplete transport",async()=>{
 expect(await collectCaseEntryPages(owner,"events",async()=>({data:page(0,0),error:null}))).toEqual({revision,rows:[]});
 await expect(collectCaseEntryPages(owner,"events",async()=>({data:{...page(0,0),next:0},error:null}))).rejects.toThrow();
});

it("keeps the first-page catalogue while reading at most four later pages concurrently and restores offset order",async()=>{
 let active=0,peak=0;
 const read:CasePageRead=async args=>{
  active++;peak=Math.max(active,peak);
  await new Promise(done=>setTimeout(done,args.p_offset%200===50?5:0));active--;
  return {data:page(args.p_offset,501),error:null};
 };
 const value=await collectCaseEntryPages(owner,"events",read);
 expect(peak).toBe(4);expect(value.rows).toEqual(Array.from({length:501},(_,i)=>row(i)));
});

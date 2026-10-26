import "server-only";
import {z} from "zod";
import {supabaseAdmin} from "@/lib/supabaseAdmin";

export type CaseEntryKind="cases"|"events"|"notices";
export type CasePageRead=(args:{p_owner_id:string;p_kind:CaseEntryKind;p_offset:number;p_revision:string|null})=>PromiseLike<{data:unknown;error:unknown}>;
const pageSchema=z.object({changed:z.boolean(),revision:z.string().regex(/^[a-f0-9]{32}$/),total:z.number().int().nonnegative().safe(),offset:z.number().int().nonnegative(),next:z.number().int().nonnegative().nullable(),rows:z.array(z.unknown()).max(50)});
const identitySchema=z.object({id:z.uuid(),user_id:z.uuid()});
const envelopeIdentity=z.object({project:identitySchema});

/** No partial success, offset clamp, guessed owner, or automatic retry on a changing collection. */
export async function collectCaseEntryPages(ownerId:string,kind:CaseEntryKind,read?:CasePageRead){
 // postgrest-js GET stringifies null as the text "null"; omit the optional
 // first-page revision so PostgreSQL uses its actual NULL default.
 const rpc:CasePageRead=read??(({p_revision,...args})=>supabaseAdmin().rpc("natori_case_entry_page_v1",{...args,...(p_revision===null?{}:{p_revision})},{get:true}));
 let revision:string|null=null,total:number|null=null;
 const rows:unknown[]=[],ids=new Set<string>();
 const readPage=async(offset:number)=>{
  const result=await rpc({p_owner_id:ownerId,p_kind:kind,p_offset:offset,p_revision:revision});
  if(result.error)throw Error("case_entry_read_unavailable");
  return pageSchema.parse(result.data);
 };
 const append=(page:z.infer<typeof pageSchema>,offset:number)=>{
  if(page.changed||page.offset!==offset||(revision!==null&&revision!==page.revision)||(total!==null&&total!==page.total))throw Error("case_entry_collection_changed");
  revision=page.revision;total=page.total;
  if(page.rows.length!==Math.min(50,total-offset)||offset>total||page.next!==(offset+page.rows.length<total?offset+page.rows.length:null))throw Error("case_entry_incomplete");
  for(const row of page.rows){
   const identity=kind==="cases"?envelopeIdentity.parse(row).project:identitySchema.parse(row);
   if(identity.user_id!==ownerId||ids.has(identity.id))throw Error("case_entry_scope_mismatch");
   ids.add(identity.id);rows.push(row);
  }
 };
 const first=await readPage(0);append(first,0);
 // A fixed, small window reduces serial round trips. Every page still has to
 // match the first revision/count and pass owner/duplicate checks before return.
 // No shared cache, partial success, or unbounded request fan-out.
 for(let offset=50;offset<first.total;offset+=200){
  const offsets=Array.from({length:Math.min(4,Math.ceil((first.total-offset)/50))},(_,i)=>offset+i*50);
  const pages=await Promise.all(offsets.map(readPage));
  pages.forEach((page,i)=>append(page,offsets[i]));
 }
 return {revision:revision!,rows};
}

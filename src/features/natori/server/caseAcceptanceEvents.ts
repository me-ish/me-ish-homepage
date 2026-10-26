import "server-only";
import {z} from "zod";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {assertServerAcceptanceTarget} from "@/lib/caseAcceptanceEnvironment";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";

const day=z.iso.date();
const content=z.strictObject({title:z.string().trim().min(1).max(200),date:day,note:z.string().max(1000).nullable()});
const requestContent=content.extend({note:content.shape.note.optional().default(null)});
const schema=z.strictObject({
 run:z.uuid(),owner:z.uuid(),firstDate:day,lastDate:day,
 operations:z.array(z.enum(["create","update","delete"])).max(3),
 fixtures:z.array(z.strictObject({id:z.uuid(),create:content})).min(1).max(3),
}).superRefine((v,ctx)=>{
 if(v.firstDate>v.lastDate||new Set(v.fixtures.map(f=>f.id)).size!==v.fixtures.length||new Set(v.operations).size!==v.operations.length||new Set(v.fixtures.map(f=>JSON.stringify(f.create))).size!==v.fixtures.length||v.fixtures.some(f=>f.create.date<v.firstDate||f.create.date>v.lastDate))ctx.addIssue({code:"custom",message:"invalid_fixture_scope"});
});
export type AcceptanceEventContent=z.infer<typeof content>;
/** Nonsecret fixture configuration only. Nothing is enabled merely by owner equality. */
export function acceptanceEventConfiguration(){
 const target=assertServerAcceptanceTarget(true);if(!target)return null;
 const raw=process.env.NATORI_CASE_ACCEPTANCE_EVENTS;if(!raw)return null;
 const config=schema.parse(JSON.parse(raw)),owner=resolveTrustedNatoriOwnerId();
 if(owner.kind!=="ok"||config.run!==target.run||config.owner!==owner.ownerId)throw Error("acceptance_events_scope_invalid");
 return {config,target};
}
export function acceptancePersonalEventsAvailable(){
 if(!assertServerAcceptanceTarget(true))return true;
 try{return Boolean(acceptanceEventConfiguration());}catch{return false;}
}
/** Recheck the actual run, independently of project membership: an event is not a case. */
export async function acceptanceEventContext(mutation=false){
 const configured=acceptanceEventConfiguration();if(!configured)throw Error("acceptance_events_not_configured");
 const target=assertServerAcceptanceTarget(!mutation);if(!target)throw Error("acceptance_events_not_configured");
 // This established table is absent from the repository's generated type snapshot.
 // Keep that boundary narrow and validate its response as unknown below.
 const from=supabaseAdmin().from.bind(supabaseAdmin()) as unknown as (name:"natori_case_acceptance_runs")=>{select:(columns:string)=>{eq:(column:"id",value:string)=>{maybeSingle:()=>PromiseLike<{data:unknown;error:unknown}>}}};
 const {data,error}=await from("natori_case_acceptance_runs")
  .select("id,owner_id,project_ref,origin,provider_scope,stripe_account,enabled,starts_at,ends_at").eq("id",target.run).maybeSingle();
 const row=z.object({id:z.uuid(),owner_id:z.uuid(),project_ref:z.string(),origin:z.string(),provider_scope:z.string(),stripe_account:z.string(),enabled:z.boolean(),starts_at:z.string(),ends_at:z.string()}).safeParse(data);
 if(error||!row.success)throw Error("acceptance_events_run_unconfirmed");
 const r=row.data;
 if(r.id!==target.run||r.owner_id!==configured.config.owner||r.project_ref!==target.ref||r.origin!==target.origin||r.provider_scope!==process.env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE||r.stripe_account!==process.env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT||Date.parse(r.starts_at)!==Date.parse(target.startsAt)||Date.parse(r.ends_at)!==Date.parse(target.endsAt)||(mutation&&(!r.enabled||Date.parse(r.starts_at)>Date.now()||Date.parse(r.ends_at)<=Date.now())))throw Error("acceptance_events_run_invalid");
 return configured.config;
}
export async function acceptanceEventRequestAllowed(operation:string,request:Request,mutation:boolean){
 try{
  const config=await acceptanceEventContext(mutation),url=new URL(request.url);
  if(operation==="events.GET")return !mutation&&url.searchParams.size===0;
  if(operation==="case-entry-index.GET")return !mutation&&url.searchParams.getAll("kind").length===1&&url.searchParams.get("kind")==="events"&&[...url.searchParams.keys()].every(k=>k==="kind");
  if(!mutation)return false;
  if(operation==="events.DELETE")return config.operations.includes("delete")&&url.searchParams.getAll("id").length===1&&[...url.searchParams.keys()].every(k=>k==="id")&&config.fixtures.some(f=>f.id===url.searchParams.get("id"));
  if(url.searchParams.size)return false;
  const raw:unknown=await request.clone().json().catch(()=>null);
  if(operation==="events.POST"){
   const c=requestContent.safeParse(raw);return config.operations.includes("create")&&c.success&&config.fixtures.some(f=>sameEventContent(f.create,c.data));
  }
  if(operation==="events.PATCH"){
   const patch=z.strictObject({id:z.uuid(),title:content.shape.title.optional(),date:day.optional(),note:content.shape.note.optional()}).safeParse(raw);
   return config.operations.includes("update")&&patch.success&&config.fixtures.some(f=>f.id===patch.data.id)&&(!patch.data.date||(patch.data.date>=config.firstDate&&patch.data.date<=config.lastDate));
  }
  return false;
 }catch{return false;}
}
export function sameEventContent(a:AcceptanceEventContent,b:AcceptanceEventContent){return a.title===b.title&&a.date===b.date&&a.note===b.note;}
export function acceptanceCreateFixture(config:Awaited<ReturnType<typeof acceptanceEventContext>>,input:AcceptanceEventContent){
 return config.operations.includes("create")?config.fixtures.find(f=>sameEventContent(f.create,input)):undefined;
}

import "server-only";
import {z} from "zod";
import {collectCaseEntryPages,type CasePageRead} from "./caseEntryPages";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {listNatoriAdminEvents} from "./eventsService";
import {acceptanceProjectAllowed} from "./caseAcceptance";
import {assertServerAcceptanceTarget} from "@/lib/caseAcceptanceEnvironment";
import type {CaseNoticeIndex,CasePersonalEvent} from "../types/caseEntryIndex";
import {isPaymentTimestamp} from "../lib/clientPayment";

const eventSchema=z.object({id:z.uuid(),title:z.string(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>isPaymentTimestamp(v+"T00:00:00Z")),note:z.string().nullable()});
const noticeSchema=z.object({id:z.uuid(),project_id:z.uuid(),project_title:z.string(),purpose:z.string(),status:z.string(),attempt_no:z.number().int().positive(),sent_at:z.string().nullable(),created_at:z.string(),target_id:z.string().nullable(),target_revision:z.string().nullable()});
export async function readCasePersonalEvents(read?:CasePageRead):Promise<readonly CasePersonalEvent[]>{
 if(assertServerAcceptanceTarget(true)){
  const result=await listNatoriAdminEvents();if(result.kind!=="ok")throw Error("acceptance_events_unconfirmed");
  return result.events.map(raw=>{const row=eventSchema.parse(raw);return{id:row.id,title:row.title,date:row.date,...(row.note===null?{}:{note:row.note})};});
 }
 const {rows}=await collectCaseEntryPages(await resolveNatoriOwnerId(),"events",read);
 return rows.map(raw=>{const row=eventSchema.parse(raw);return {id:row.id,title:row.title,date:row.date,...(row.note===null?{}:{note:row.note})};});
}
export async function readCaseNoticeIndex(read?:CasePageRead):Promise<CaseNoticeIndex>{
 const {revision,rows}=await collectCaseEntryPages(await resolveNatoriOwnerId(),"notices",read),items=[];
 for(const raw of rows){const row=noticeSchema.parse(raw);if(assertServerAcceptanceTarget(true)&&!await acceptanceProjectAllowed(row.project_id))continue;
  const targetId=z.uuid().safeParse(row.target_id);
  const targetRevision=row.purpose==="quote_issue_client"?row.target_revision&&/^[1-9]\d{0,8}$/.test(row.target_revision)?row.target_revision:null
    :["quote_accept_artist","payment_link_client","delivery_issue_client","delivery_accept_client","delivery_accept_artist","rough_ok_artist"].includes(row.purpose)&&row.target_revision&&isPaymentTimestamp(row.target_revision)?row.target_revision:null;
  const supported=["quote_issue_client","quote_accept_artist","payment_link_client","delivery_issue_client","delivery_accept_client","delivery_accept_artist","rough_ok_artist","consultation_client","consultation_staff"].includes(row.purpose);
  items.push({id:row.id,projectId:row.project_id,projectTitle:row.project_title,purpose:row.purpose,status:row.status,attemptNo:row.attempt_no,sentAt:row.sent_at,recordedAt:row.created_at,targetId:supported&&targetId.success?targetId.data:null,targetRevision});
 }
 return {revision,items};
}

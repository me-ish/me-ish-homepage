import "server-only";
import {z} from "zod";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {validConsultationFile} from "../lib/consultationFileRules";
import {getClientProject,getStaffConsultation} from "./consultationService";
export {consultationOperation as prepareConsultationUpload} from "./consultationOperationService";
type Actor={projectId:string;token?:never}|{token:string;projectId?:never};
type FileInput=Actor&{fileName:string;mimeType:string;sizeBytes:number;path:string};
/** Legacy finish is a read-only replay adapter. New/unkeyed uploads require an updated composer. */
export async function finishConsultationUpload(input:FileInput):Promise<{kind:"ok";messageId:string}|{kind:"invalid"|"not-found"|"update-required"}>{
 if(!validConsultationFile(input.fileName,input.mimeType,input.sizeBytes)||!z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|mp3|m4a|wav)$/i).safeParse(input.path).success)return{kind:"invalid"};
 const view="token" in input&&input.token?await getClientProject(input.token):(await getStaffConsultation(input.projectId??""))?.project;
 if(!view||!input.path.startsWith(view.id+"/"))return{kind:"not-found"};
 const replay=await supabaseAdmin().rpc("natori_finalize_consultation_file",{p_project_id:view.id,p_sender:"token" in input?"client":"staff",p_storage_path:input.path,p_file_name:input.fileName,p_mime_type:input.mimeType,p_size_bytes:input.sizeBytes});
 return !replay.error&&replay.data?{kind:"ok",messageId:replay.data}:{kind:"update-required"};
}

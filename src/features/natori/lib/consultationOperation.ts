import {z} from "zod";
import {validConsultationFile} from "./consultationFileRules";

export const consultationDraftFileSchema=z.strictObject({
 id:z.uuid(),fileName:z.string().min(1).max(200),mimeType:z.string().min(1).max(100),
 sizeBytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/),
}).refine(file=>validConsultationFile(file.fileName,file.mimeType,file.sizeBytes),"invalid_file");
export const consultationOperationSchema=z.strictObject({
 operationId:z.uuid(),requestHash:z.string().regex(/^[a-f0-9]{64}$/),
 body:z.string().max(4000),files:z.array(consultationDraftFileSchema).max(10),
}).superRefine((request,ctx)=>{
 if(!request.body.trim()&&!request.files.length)ctx.addIssue({code:"custom",message:"empty_message"});
 if(new Set(request.files.map(file=>file.id)).size!==request.files.length)ctx.addIssue({code:"custom",message:"duplicate_file"});
});
export type ConsultationDraftFile=z.infer<typeof consultationDraftFileSchema>;
export type ConsultationOperation=z.infer<typeof consultationOperationSchema>;
export function canonicalConsultationOperation(input:Pick<ConsultationOperation,"body"|"files">):string{
 return JSON.stringify({body:input.body.trim(),files:input.files.map(file=>({
  id:file.id,fileName:file.fileName,mimeType:file.mimeType,sizeBytes:file.sizeBytes,sha256:file.sha256,
 }))});
}
export async function consultationDigest(bytes:ArrayBuffer):Promise<string>{
 return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),value=>value.toString(16).padStart(2,"0")).join("");
}
export async function freezeConsultationOperation(body:string,files:{id:string;file:File}[]):Promise<ConsultationOperation>{
 const descriptors=await Promise.all(files.map(async({id,file})=>({id,fileName:file.name,mimeType:file.type,sizeBytes:file.size,sha256:await consultationDigest(await file.arrayBuffer())})));
 const canonical=canonicalConsultationOperation({body,files:descriptors});
 return consultationOperationSchema.parse({operationId:crypto.randomUUID(),requestHash:await consultationDigest(Uint8Array.from(new TextEncoder().encode(canonical)).buffer),body:body.trim(),files:descriptors});
}


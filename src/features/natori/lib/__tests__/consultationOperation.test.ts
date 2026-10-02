import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {canonicalConsultationOperation,consultationOperationSchema} from "../consultationOperation";
const file={id:"11111111-2222-4333-8444-555555555555",fileName:"fixture.png",mimeType:"image/png",sizeBytes:4,sha256:"a".repeat(64)};
const operation=(body:string,files:typeof file[]=[])=>{const input={body,files};return{operationId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",requestHash:createHash("sha256").update(canonicalConsultationOperation(input)).digest("hex"),...input};};
describe("consultation immutable operation",()=>{
 it("accepts text-only, file-only and combined without changing the preserved attachment limits",()=>{
  expect(consultationOperationSchema.safeParse(operation("Message")).success).toBe(true);
  expect(consultationOperationSchema.safeParse(operation("",[file])).success).toBe(true);
  expect(consultationOperationSchema.safeParse(operation("Message",[file])).success).toBe(true);
 });
 it("canonicalizes text once and preserves exact file identity/order",()=>{
  expect(canonicalConsultationOperation(operation("  Message\n "))).toBe(canonicalConsultationOperation(operation("Message")));
  expect(operation("Message",[file]).requestHash).not.toBe(operation("Message",[{...file,sha256:"b".repeat(64)}]).requestHash);
 });
 it("rejects empty messages, duplicate files, format/MIME tampering and limit breaches",()=>{
  for(const input of [operation(""),operation("",[file,file]),operation("",[{...file,mimeType:"application/pdf"}]),operation("",[{...file,sizeBytes:10*1024*1024+1}]),operation("",[{...file,fileName:"track.mp3",mimeType:"audio/mpeg",sizeBytes:50*1024*1024+1}])])expect(consultationOperationSchema.safeParse(input).success).toBe(false);
 });
 it("permits a deliberate same-text separate operation while keeping the content hash stable",()=>{
  const first=operation("Same text"),next={...first,operationId:"66666666-7777-4888-8999-aaaaaaaaaaaa"};
  expect(consultationOperationSchema.parse(next).operationId).not.toBe(first.operationId);expect(next.requestHash).toBe(first.requestHash);
 });
});


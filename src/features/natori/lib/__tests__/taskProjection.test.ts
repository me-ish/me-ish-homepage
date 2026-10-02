import { describe, it, expect } from "vitest";
import {applyTaskProjection,overlayTaskIntents,mergeProjectCollection,previewProductionTasks,type NatoriTaskProjection} from "../taskProjection";
import type {NatoriProject} from "../../types/projects";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",stamp="2026-10-01T12:00:00.000Z";
const task=(id:string,done=false)=>({id,label:id,stage:"rough" as const,done});
const project=(extra:Partial<NatoriProject>={}):NatoriProject=>({id,title:"Synthetic",clientName:"Synthetic",amount:12000,type:"illustration",status:"rough",nextAction:"one",dueDate:null,tasks:[task("one"),task("two")],paymentConfirmedAt:stamp,mutationRevision:1,...extra});
const projection=(revision:number,extra:Partial<NatoriTaskProjection>={}):NatoriTaskProjection=>({id,title:"Synthetic",clientName:"Synthetic",clientEmail:null,amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:stamp,note:null,requestData:null,status:"rough",nextAction:"two",mutationRevision:revision,tasks:[task("one",true),task("two")],paymentConfirmedAt:stamp,paidAt:stamp,paidAmount:12000,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null,...extra});
describe("canonical task response fencing",()=>{
 it("retains two independent task commits when network replies arrive backwards",()=>{
  const latest=applyTaskProjection(project(),projection(3,{tasks:[task("one",true),task("two",true)],status:"delivery_prep",nextAction:"Notify delivery"}));
  const final=applyTaskProjection(latest,projection(2));
  expect(final.mutationRevision).toBe(3);expect(final.tasks.every(t=>t.done)).toBe(true);expect(final.status).toBe("delivery_prep");
 });
 it("keeps the latest same-task value when an older reply arrives afterwards",()=>{
  const latest=applyTaskProjection(project(),projection(3,{tasks:[task("one",false),task("two")],nextAction:"one"}));
  expect(applyTaskProjection(latest,projection(2)).tasks[0].done).toBe(false);
 });
 it("pending checkbox intents never replace canonical status or lose another server task",()=>{
  const fresh=applyTaskProjection(project(),projection(2,{tasks:[task("one",true),task("two",true)],status:"delivery_prep"}));
  const result=overlayTaskIntents(fresh,new Map([["two",{sequence:2,done:false}]]));
  expect(result.tasks.map(t=>t.done)).toEqual([true,false]);expect(result.status).toBe("delivery_prep");
 });
 it.each(["closed","completed","delivered"] as const)("does not rewind lifecycle fact %s through a task reply",status=>{
  const current=project({status,mutationRevision:4,...(status==="completed"?{completedAt:stamp,deliveryAcceptedAt:stamp}:{})});
  expect(applyTaskProjection(current,projection(5))).toBe(current);
 });
 it("does not erase payment evidence even if a malformed newer reply claims null",()=>{
  const current=project();expect(applyTaskProjection(current,projection(3,{paymentConfirmedAt:null,paidAt:null,paidAmount:null}))).toBe(current);
 });
 it("uses revisions to prevent an older GET from rewinding a completed task result",()=>{
  const latest=project({mutationRevision:6,tasks:[task("one",true),task("two",true)],status:"delivery_prep"});
  expect(mergeProjectCollection([latest],[project({mutationRevision:4})])[0]).toBe(latest);
 });
 it("same revision task reply cannot overwrite a coherent full snapshot",()=>{
  const current=project({mutationRevision:4,tasks:[task("one",true),task("two",true)],status:"delivery_prep"});
  expect(applyTaskProjection(current,projection(4))).toBe(current);
 });
 it("older absent list keeps projects updated or created after snapshot started",()=>{
  const current=project({mutationRevision:4});
  expect(mergeProjectCollection([current],[],new Map([[id,1]]))).toEqual([current]);
  expect(mergeProjectCollection([current],[],new Map())).toEqual([current]);
  expect(mergeProjectCollection([current],[],new Map([[id,4]]),new Set([id]))).toEqual([current]);
  expect(mergeProjectCollection([current],[],new Map([[id,4]]))).toEqual([]);
 });
 it("legacy unchecked hidden material cannot pin visible finished work",()=>{
  const hidden={...task("material"),stage:"material" as const},current=project();
  const next=previewProductionTasks(current,[hidden,...current.tasks.map(t=>({...t,done:true}))]);
  expect(next.status).toBe("delivery_prep");expect(next.tasks[0].done).toBe(false);
 });
 it("all tasks checked means delivery preparation, never receipt or completion",()=>{
  const current=project(),next=previewProductionTasks(current,current.tasks.map(t=>({...t,done:true})));
  expect(next.status).toBe("delivery_prep");expect(next.completedAt).toBeUndefined();expect(next.deliveryAcceptedAt).toBeUndefined();expect(next.paymentConfirmedAt).toBe(stamp);
 });
 it("preview cannot start unpaid work or change accepted/archived facts",()=>{
  for(const current of [project({paymentConfirmedAt:undefined,status:"awaiting_payment"}),project({completedAt:stamp,status:"completed"}),project({deletedAt:stamp})]){
   expect(previewProductionTasks(current,current.tasks.map(t=>({...t,done:true})))).toBe(current);
  }
 });
 it("the existing production demo remains editable without inventing payment evidence",()=>{
  const demo=project({paymentConfirmedAt:undefined});const result=previewProductionTasks(demo,demo.tasks.map(t=>({...t,done:true})));
  expect(result.status).toBe("delivery_prep");expect(result.paymentConfirmedAt).toBeUndefined();expect(result.completedAt).toBeUndefined();
 });
});

// @vitest-environment jsdom
import React from "react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import PaymentLinkPanel from "../PaymentLinkPanel";
import type {NatoriProject} from "../../../types/projects";
const id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",op="11111111-2222-4333-8444-555555555555";
const project={id,title:"Synthetic",clientName:"Fixture",clientEmail:"client@fixture.invalid",type:"illustration",status:"awaiting_payment",amount:12000,dueDate:null,nextAction:"",tasks:[]} as NatoriProject;
const state={result:"ok",state:"active",attemptId:op,generation:1,revision:1,deadline:"2099-01-01T00:00:00Z",url:"https://buy.stripe.com/fixture",confirmedAt:null,terminal:false,canIssue:true,amount:12000,notificationStatus:"pending"};
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
describe("payment link operation recovery",()=>{
 it("restores a frozen request and retries its exact content after response loss",async()=>{
  const request={projectId:id,operationId:op,action:"renotify",revision:1,to:"client@fixture.invalid",subject:"Frozen subject",body:"Frozen individual comment"};
  sessionStorage.setItem(`natori-payment-link-operation/${id}`,JSON.stringify(request));
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method==="POST"?{ok:true,state}:{enabled:true,state}),{status:200}));vi.stubGlobal("fetch",fetcher);
  const sent=vi.fn();render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={sent}/>);
  await waitFor(()=>expect((screen.getByLabelText("支払案内の本文") as HTMLTextAreaElement).value).toBe(request.body));
  expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"同じ操作で再試行"}));
  await waitFor(()=>expect(sent).toHaveBeenCalledOnce());
  const post=fetcher.mock.calls.find(([,init])=>init?.method==="POST");expect(JSON.parse(post![1]!.body as string)).toEqual(request);
  expect(sessionStorage.getItem(`natori-payment-link-operation/${id}`)).toBeNull();
 });
 it("blocks a new operation when the authoritative read fails",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response('{"error":"synthetic"}',{status:503})));
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByRole("alert");expect((screen.getByRole("button",{name:"選んだ操作を実行"}) as HTMLButtonElement).disabled).toBe(true);
 });
 it("keeps extension separate and refuses it without the explicit confirmation",async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({enabled:true,state}),{status:200}));vi.stubGlobal("fetch",fetcher);
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByText("リンク有効");fireEvent.change(screen.getByLabelText("支払リンク操作"),{target:{value:"extend"}});
  fireEvent.change(screen.getByLabelText("新しい支払期限"),{target:{value:"2099-01-02T12:00"}});
  fireEvent.click(screen.getByRole("button",{name:"選んだ操作を実行"}));await screen.findByRole("alert");
  expect(fetcher).toHaveBeenCalledTimes(1);expect(sessionStorage.getItem(`natori-payment-link-operation/${id}`)).toBeNull();
 });
 it("unfreezes only a matching definitive POST rejection and retries edited input with a new operation",async()=>{
  const absent={...state,state:"absent",attemptId:null,generation:null,revision:null,deadline:null,url:null,notificationStatus:null};
  const nextOperation="66666666-7777-4888-8999-aaaaaaaaaaaa",key="natori-payment-link-operation/"+id;
  vi.stubGlobal("crypto",{randomUUID:vi.fn().mockReturnValueOnce(op).mockReturnValueOnce(nextOperation)});
  const posts:Record<string,unknown>[]=[];
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
   if(init?.method!=="POST")return new Response(JSON.stringify({enabled:true,state:absent}),{status:200});
   const request=JSON.parse(init.body as string) as Record<string,unknown>;posts.push(request);
   return posts.length===1
    ?new Response(JSON.stringify({ok:false,error:"invalid_deadline",operationState:"rejected",operationId:request.operationId}),{status:409})
    :new Response(JSON.stringify({ok:true,state}),{status:200});
  });vi.stubGlobal("fetch",fetcher);
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByText("案内未発行");
  fireEvent.change(screen.getByLabelText("新しい支払期限"),{target:{value:"2000-01-01T12:00"}});
  fireEvent.change(screen.getByLabelText("支払案内の本文"),{target:{value:"Original individual comment"}});
  fireEvent.click(screen.getByRole("button",{name:"選んだ操作を実行"}));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("新しい支払期限").matches(":disabled")).toBe(false);
  expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(false);
  expect(sessionStorage.getItem(key)).toBeNull();
  fireEvent.change(screen.getByLabelText("新しい支払期限"),{target:{value:"2099-01-02T12:00"}});
  fireEvent.change(screen.getByLabelText("支払案内の本文"),{target:{value:"Edited individual comment"}});
  fireEvent.click(screen.getByRole("button",{name:"選んだ操作を実行"}));
  await waitFor(()=>expect(posts).toHaveLength(2));
  expect(posts[0].operationId).toBe(op);expect(posts[1].operationId).toBe(nextOperation);
  expect(posts[1].body).toBe("Edited individual comment");
  await waitFor(()=>expect(sessionStorage.getItem(key)).toBeNull());
 });
 it("reconciles a restored rejected operation on GET and preserves its editable fields",async()=>{
  const request={projectId:id,operationId:op,action:"issue",deadline:"2000-01-01T12:00:00.000Z",to:"client@fixture.invalid",subject:"Saved subject",body:"Saved individual comment"},key="natori-payment-link-operation/"+id;
  sessionStorage.setItem(key,JSON.stringify(request));
  const absent={...state,state:"absent",attemptId:null,generation:null,revision:null,deadline:null,url:null,notificationStatus:null};
  const fetcher=vi.fn(async(_url:unknown)=>new Response(JSON.stringify({enabled:true,state:absent,operationState:"rejected",operationId:op,reason:"invalid_deadline"}),{status:200}));vi.stubGlobal("fetch",fetcher);
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByRole("alert");
  expect(fetcher.mock.calls[0][0]).toBe("/api/natori/admin/payment-link?projectId="+id+"&operationId="+op);
  expect((screen.getByLabelText("支払案内の本文") as HTMLTextAreaElement).value).toBe(request.body);
  expect((screen.getByLabelText("支払案内の件名") as HTMLInputElement).value).toBe(request.subject);
  expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(false);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect((screen.getByRole("button",{name:"選んだ操作を実行"}) as HTMLButtonElement).disabled).toBe(false);
 });
 it("reconciles a pending operation with the manual state reload",async()=>{
  const request={projectId:id,operationId:op,action:"renotify",revision:1,to:"client@fixture.invalid",subject:"Frozen subject",body:"Frozen comment"},key="natori-payment-link-operation/"+id;
  sessionStorage.setItem(key,JSON.stringify(request));
  let reads=0;vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({enabled:true,state,...(++reads===2?{operationState:"rejected",operationId:op,reason:"invalid_state"}:{})}),{status:200})));
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByText("リンク有効");expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"状態を再読込"}));
  await screen.findByRole("alert");expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(false);
  expect(sessionStorage.getItem(key)).toBeNull();
 });
 it.each([
  {operationState:"unknown",operationId:op},
  {operationState:"rejected",operationId:"66666666-7777-4888-8999-aaaaaaaaaaaa"},
  {error:"invalid_deadline"},
 ])("keeps the same request frozen when GET/POST cannot prove rejection: %j",async marker=>{
  const request={projectId:id,operationId:op,action:"renotify",revision:1,to:"client@fixture.invalid",subject:"Frozen subject",body:"Frozen comment"},key="natori-payment-link-operation/"+id;
  sessionStorage.setItem(key,JSON.stringify(request));
  vi.stubGlobal("fetch",vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method==="POST"?{ok:false,error:"conflict",...marker}:{enabled:true,state,...marker}),{status:init?.method==="POST"?409:200})));
  render(<PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>);
  await screen.findByText("リンク有効");
  expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"同じ操作で再試行"}));await screen.findByRole("alert");
  expect(screen.getByLabelText("支払案内の本文").matches(":disabled")).toBe(true);
  expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(request);
 });

});

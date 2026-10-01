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
});

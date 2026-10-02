// @vitest-environment jsdom
import {webcrypto} from "node:crypto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import type {UploadOptions} from "tus-js-client";
import type {ConsultationOperation} from "@/features/natori/lib/consultationOperation";
const tus=vi.hoisted(()=>({files:[] as File[]}));
vi.mock("tus-js-client",()=>({Upload:class{constructor(private file:File,private options:UploadOptions){}start(){tus.files.push(this.file);this.options.onSuccess?.({lastResponse:{getStatus:()=>201,getHeader:()=>undefined,getBody:()=>"",getUnderlyingObject:()=>null}});}}}));
import ConsultationThread from "../ConsultationThread";
const original:ConsultationOperation={operationId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",requestHash:"a".repeat(64),body:"Original body retained",files:[]};
const key="natori-consultation-operation/actor-A";
let posts:{action:string;operation:ConsultationOperation}[],expired:"lookup"|"prepare"|"commit"|null,cancelLost:boolean;
function receipt(operation:ConsultationOperation){return Response.json({kind:"committed",messageId:"66666666-7777-4888-8999-aaaaaaaaaaaa",operationId:operation.operationId,requestHash:operation.requestHash});}
function file(){const value=new File(["fake"],"original.png",{type:"image/png"});Object.defineProperty(value,"arrayBuffer",{value:async()=>new TextEncoder().encode("fake").buffer});return value;}
beforeEach(()=>{
 sessionStorage.clear();posts=[];tus.files=[];expired="lookup";cancelLost=false;let uuid=0;
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://fixture.supabase.invalid");vi.stubGlobal("crypto",{subtle:webcrypto.subtle,randomUUID:()=>`${String(++uuid).padStart(8,"0")}-1111-4111-8111-111111111111`});
 vi.stubGlobal("fetch",vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method!=="POST")return Response.json({messages:[],closed:false});
  const data=JSON.parse(String(init.body)) as {action:string;operation:ConsultationOperation};posts.push(data);
  if(data.action===expired)return Response.json({kind:"notice_expired",ok:false},{status:409});
  if(data.action==="lookup")return Response.json({kind:"reserved"});
  if(data.action==="cancel"){if(cancelLost)throw new Error("SYNTHETIC_CANCEL_ACK_LOST");return Response.json({kind:"cancelled"});}
  if(data.action==="prepare")return Response.json({kind:"prepared",files:data.operation.files.map(item=>({id:item.id,path:data.operation.operationId+"/"+item.id+".png",uploadToken:"synthetic",uploaded:false}))});
  return receipt(data.operation);
 }));
});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
const box=()=>screen.getByRole("textbox") as HTMLTextAreaElement;
const cancel=()=>screen.getByRole("button",{name:"送信の取消を確認"});
const retry=()=>screen.getByRole("button",{name:"同じ送信を確認・再試行"});
async function loaded(){await waitFor(()=>expect(screen.queryByText("履歴を確認中…")).toBeNull());}
function mount(){return render(<ConsultationThread mode="client" token="actor-A" initialMessages={[]} closed={false}/>);}
describe("consultation expired notice preserves original draft",()=>{
 it("shows persistent explicit cancel guidance for an expired restored operation and never starts a new ID on its own",async()=>{
  sessionStorage.setItem(key,JSON.stringify(original));mount();await screen.findByText(/この送信の通知期限が過ぎています/);await loaded();expect(box().value).toBe(original.body);expect(box().disabled).toBe(true);expect((retry() as HTMLButtonElement).disabled).toBe(true);expect((cancel() as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"履歴を更新"}));await loaded();expect(screen.getByText(/この送信の通知期限が過ぎています/)).toBeTruthy();expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(original);expect(posts.map(value=>value.action)).toEqual(["lookup"]);
 });
 it.each(["prepare","commit"] as const)("keeps the exact selected File at %s expiry, then uses it only after confirmed cancellation and a deliberate new send",async stage=>{
  expired=stage;mount();await loaded();const selected=file();fireEvent.change(box(),{target:{value:original.body}});fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"),{target:{files:[selected]}});fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));
  await screen.findByText(/この送信の通知期限が過ぎています/);const saved=JSON.parse(sessionStorage.getItem(key)!) as ConsultationOperation;expect(saved.body).toBe(original.body);expect(saved.files).toHaveLength(1);expect(box().disabled).toBe(true);expect((retry() as HTMLButtonElement).disabled).toBe(true);
  expect(posts.map(value=>value.action)).toEqual(stage==="prepare"?["prepare"]:["prepare","commit"]);
  expired=null;fireEvent.click(cancel());await screen.findByText(/送信を取り消しました/);expect(box().value).toBe(original.body);expect(box().disabled).toBe(false);expect(screen.getByText(/original\.png/)).toBeTruthy();expect(sessionStorage.getItem(key)).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));await screen.findByText(/送信を保存しました/);const final=posts.at(-1)!.operation;expect(final.operationId).not.toBe(saved.operationId);expect(final.requestHash).toBe(saved.requestHash);expect(final.body).toBe(saved.body);expect(final.files).toEqual(saved.files);expect(tus.files.at(-1)).toBe(selected);
 });
 it("keeps the same pending operation and expiry guidance when cancellation acknowledgement is unknown",async()=>{
  sessionStorage.setItem(key,JSON.stringify(original));mount();await screen.findByText(/この送信の通知期限が過ぎています/);cancelLost=true;fireEvent.click(cancel());await screen.findByRole("alert");expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(original);expect(box().value).toBe(original.body);expect(box().disabled).toBe(true);expect((retry() as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText(/この送信の通知期限が過ぎています/)).toBeTruthy();expect(posts.map(value=>value.action)).toEqual(["lookup","cancel"]);
 });
 it("allows cancellation of restored attachment records while explicitly requiring file reselection",async()=>{
  const recorded={...original,files:[{id:"11111111-2222-4333-8444-555555555555",fileName:"original.png",mimeType:"image/png",sizeBytes:4,sha256:"b".repeat(64)}]};sessionStorage.setItem(key,JSON.stringify(recorded));mount();await screen.findByText(/この送信の通知期限が過ぎています/);
  expect(screen.getByText(/添付は同じファイルを選び直してください/)).toBeTruthy();expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(recorded);expect(tus.files).toHaveLength(0);fireEvent.click(cancel());await screen.findByText(/未選択の添付は同じファイルを選び直してください/);expect(box().value).toBe(original.body);expect(box().disabled).toBe(false);expect(tus.files).toHaveLength(0);expect(posts.map(value=>value.action)).toEqual(["lookup","cancel"]);
 });
 it("ignores a late expired lookup for an earlier actor and leaves the new actor draft editable",async()=>{
  let resolve!:(value:Response)=>void;const delayed=new Promise<Response>(yes=>resolve=yes),normal=vi.mocked(fetch).getMockImplementation()!;vi.mocked(fetch).mockImplementation(async(url,init)=>init?.body&&JSON.parse(String(init.body)).action==="lookup"?delayed:normal(url,init));
  sessionStorage.setItem(key,JSON.stringify(original));const view=mount();await loaded();view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();fireEvent.change(box(),{target:{value:"New actor B"}});
  await act(async()=>resolve(Response.json({kind:"notice_expired"},{status:409})));expect(box().value).toBe("New actor B");expect(box().disabled).toBe(false);expect(screen.queryByText(/この送信の通知期限が過ぎています/)).toBeNull();expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(original);
 });
});

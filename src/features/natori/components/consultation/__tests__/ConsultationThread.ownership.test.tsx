// @vitest-environment jsdom
import {StrictMode} from "react";
import {webcrypto} from "node:crypto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import type {UploadOptions} from "tus-js-client";
import type {ConsultationOperation} from "@/features/natori/lib/consultationOperation";
const tus=vi.hoisted(()=>({files:[] as File[],options:[] as UploadOptions[],held:false}));
vi.mock("tus-js-client",()=>({Upload:class{
 constructor(private file:File,private options:UploadOptions){}
 start(){tus.files.push(this.file);tus.options.push(this.options);if(tus.held)return;this.options.onSuccess?.({lastResponse:{getStatus:()=>201,getHeader:()=>undefined,getBody:()=>"",getUnderlyingObject:()=>null}});}
}}));
import ConsultationThread from "../ConsultationThread";

const a:ConsultationOperation={operationId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",requestHash:"a".repeat(64),body:"Original A",files:[]};
const messageId="66666666-7777-4888-8999-aaaaaaaaaaaa";
const key=(token:string)=>"natori-consultation-operation/"+token;
const receipt=(operation:ConsultationOperation)=>Response.json({kind:"committed",messageId,operationId:operation.operationId,requestHash:operation.requestHash});
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
type Handler=(operation:ConsultationOperation,url:string)=>Response|Promise<Response>;
let lookup:Handler,prepare:Handler,commit:Handler,cancel:Handler,read:(url:string)=>Response|Promise<Response>;
let reads:string[],posts:{action:string;operation:ConsultationOperation;url:string}[];
function prepared(operation:ConsultationOperation){return Response.json({kind:"prepared",files:operation.files.map(file=>({id:file.id,path:operation.operationId+"/"+file.id+".png",uploadToken:"synthetic",uploaded:false}))});}
function file(name="B.png",bytes:Promise<ArrayBuffer>|ArrayBuffer=new Uint8Array([102,97,107,101]).buffer){
 const value=new File(["fake"],name,{type:"image/png"});Object.defineProperty(value,"arrayBuffer",{value:()=>Promise.resolve(bytes)});return value;
}
beforeEach(()=>{
 sessionStorage.clear();reads=[];posts=[];tus.files=[];tus.options=[];tus.held=false;let uuid=0;
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://fixture.supabase.invalid");
 vi.stubGlobal("crypto",{subtle:webcrypto.subtle,randomUUID:()=>`${String(++uuid).padStart(8,"0")}-1111-4111-8111-111111111111`});
 lookup=()=>Response.json({kind:"reserved"});prepare=prepared;commit=receipt;cancel=()=>Response.json({kind:"cancelled"});read=()=>Response.json({messages:[],closed:false});
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method!=="POST"){reads.push(url);return read(url);}
  const data=JSON.parse(String(init.body)) as {action:string;operation:ConsultationOperation};posts.push({...data,url});
  return ({lookup,prepare,commit,cancel}[data.action as "lookup"|"prepare"|"commit"|"cancel"])(data.operation,url);
 }));
});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();vi.unstubAllEnvs();vi.restoreAllMocks();});
function mount(token="actor-A"){return render(<ConsultationThread mode="client" token={token} initialMessages={[]} closed={false}/>);}
const textbox=()=>screen.getByRole("textbox") as HTMLTextAreaElement;
const retry=()=>screen.getByRole("button",{name:"\u540c\u3058\u9001\u4fe1\u3092\u78ba\u8a8d\u30fb\u518d\u8a66\u884c"});
const send=()=>screen.getByRole("button",{name:"\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u9001\u4fe1"});
async function loaded(){await waitFor(()=>expect(screen.queryByText("\u5c65\u6b74\u3092\u78ba\u8a8d\u4e2d\u2026")).toBeNull());}
async function completeRetryA(){await loaded();await waitFor(()=>expect((retry() as HTMLButtonElement).disabled).toBe(false));fireEvent.click(retry());await waitFor(()=>expect(textbox().disabled).toBe(false));await waitFor(()=>expect(screen.queryByText("\u9001\u4fe1\u4e2d\u2026")).toBeNull());}
function draftB(attachment=file()){fireEvent.change(textbox(),{target:{value:"New B content"}});fireEvent.change(screen.getByLabelText("\u76f8\u8ac7\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u3076"),{target:{files:[attachment]}});return attachment;}
async function pendingB(){await waitFor(()=>{const raw=sessionStorage.getItem(key("actor-A"));expect(raw).not.toBeNull();expect(JSON.parse(raw!).body).toBe("New B content");});return JSON.parse(sessionStorage.getItem(key("actor-A"))!) as ConsultationOperation;}
async function restoreA(gate:ReturnType<typeof deferred<Response>>){sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=()=>gate.promise;prepare=operation=>operation.operationId===a.operationId?receipt(operation):prepared(operation);mount();await loaded();}

describe("consultation current actor and operation ownership",()=>{
 it("late initial lookup A cannot erase newer pending B or its exact selected File",async()=>{
  const oldLookup=deferred<Response>(),bPrepare=deferred<Response>();await restoreA(oldLookup);await completeRetryA();
  const selected=draftB();prepare=operation=>operation.operationId===a.operationId?receipt(operation):bPrepare.promise;
  fireEvent.click(send());const b=await pendingB();expect(textbox().disabled).toBe(true);const beforeReads=reads.length;
  await act(async()=>oldLookup.resolve(receipt(a)));
  expect(textbox().value).toBe("New B content");expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(b);expect(reads).toHaveLength(beforeReads);expect(screen.getByText(/B\.png/)).toBeTruthy();
  await act(async()=>bPrepare.resolve(prepared(b)));await waitFor(()=>expect(sessionStorage.getItem(key("actor-A"))).toBeNull());
  expect(tus.files).toEqual([selected]);expect(posts.filter(post=>post.action==="commit").map(post=>post.operation)).toEqual([b]);
 });
 it("late lookup A cannot erase an editable B draft while no pending operation exists",async()=>{
  const gate=deferred<Response>();await restoreA(gate);await completeRetryA();const selected=draftB();const beforeReads=reads.length;
  await act(async()=>gate.resolve(receipt(a)));
  expect(textbox().value).toBe("New B content");expect(screen.getByText(/B\.png/)).toBeTruthy();expect(sessionStorage.getItem(key("actor-A"))).toBeNull();expect(reads).toHaveLength(beforeReads);
  fireEvent.click(send());await waitFor(()=>expect(tus.files).toEqual([selected]));
 });
 it("late lookup failure A cannot paint an error over pending B",async()=>{
  const gate=deferred<Response>(),bPrepare=deferred<Response>();await restoreA(gate);await completeRetryA();draftB();prepare=()=>bPrepare.promise;
  fireEvent.click(send());const b=await pendingB();await act(async()=>gate.reject(new Error("SYNTHETIC_OLD_LOOKUP_FAILURE")));
  expect(screen.queryByRole("alert")).toBeNull();expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(b);expect(textbox().value).toBe("New B content");
 });
 it("current same-ID receipt cannot delete a different hash in durable cache",async()=>{
  const gate=deferred<Response>();await restoreA(gate);const newer={...a,requestHash:"b".repeat(64),body:"Different current hash"};sessionStorage.setItem(key("actor-A"),JSON.stringify(newer));
  await act(async()=>gate.resolve(receipt(a)));
  expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(newer);expect(textbox().value).toBe(a.body);expect(reads).toHaveLength(1);
  fireEvent.click(retry());await waitFor(()=>expect(screen.queryByText("\u9001\u4fe1\u4e2d\u2026")).toBeNull());expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(newer);expect(posts.filter(post=>post.action==="prepare"||post.action==="commit")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button",{name:"\u9001\u4fe1\u306e\u53d6\u6d88\u3092\u78ba\u8a8d"}));await waitFor(()=>expect(screen.queryByText("\u9001\u4fe1\u4e2d\u2026")).toBeNull());expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(newer);expect(posts.filter(post=>post.action==="cancel")).toHaveLength(0);
 });
 it("fresh freeze cannot overwrite another durable active envelope",async()=>{
  mount();await loaded();fireEvent.change(textbox(),{target:{value:"New editable draft"}});sessionStorage.setItem(key("actor-A"),JSON.stringify(a));fireEvent.click(send());
  await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeNull());expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(textbox().value).toBe("New editable draft");expect(posts).toHaveLength(0);
 });
 it("a mismatched authoritative receipt keeps the current operation frozen",async()=>{
  const gate=deferred<Response>();await restoreA(gate);await act(async()=>gate.resolve(receipt({...a,requestHash:"c".repeat(64)})));
  expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(textbox().disabled).toBe(true);expect(reads).toHaveLength(1);
 });
 it("actor change with no cache resets scope and retains the old actor operation",async()=>{
  const gate=deferred<Response>();sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=()=>gate.promise;const view=mount();await loaded();
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();
  expect(textbox().disabled).toBe(false);expect(textbox().value).toBe("");draftB();await act(async()=>gate.resolve(receipt(a)));
  expect(textbox().value).toBe("New B content");expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(sessionStorage.getItem(key("actor-B"))).toBeNull();
 });
 it("late pre-freeze file bytes cannot publish into a new actor",async()=>{
  const bytes=deferred<ArrayBuffer>();const view=mount();await loaded();draftB(file("A.png",bytes.promise));fireEvent.click(send());
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();expect(textbox().disabled).toBe(false);fireEvent.change(textbox(),{target:{value:"Actor B survives"}});
  await act(async()=>bytes.resolve(new Uint8Array([102,97,107,101]).buffer));
  expect(textbox().value).toBe("Actor B survives");expect(sessionStorage.getItem(key("actor-A"))).toBeNull();expect(posts).toHaveLength(0);
 });
 it("late pending-file digest A cannot replace B's selected file",async()=>{
  const digestBytes=await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode("fake"));
  const digest=Array.from(new Uint8Array(digestBytes),value=>value.toString(16).padStart(2,"0")).join("");
  vi.spyOn(webcrypto.subtle,"digest").mockResolvedValueOnce(digestBytes);
  const withFile={...a,files:[{id:"11111111-2222-4333-8444-555555555555",fileName:"A.png",mimeType:"image/png",sizeBytes:4,sha256:digest}]};
  sessionStorage.setItem(key("actor-A"),JSON.stringify(withFile));prepare=operation=>receipt(operation);mount();await loaded();const bytes=deferred<ArrayBuffer>();
  fireEvent.change(screen.getByLabelText("\u76f8\u8ac7\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u3076"),{target:{files:[file("A.png",bytes.promise)]}});await completeRetryA();const selected=draftB();
  await act(async()=>bytes.resolve(new Uint8Array([102,97,107,101]).buffer));expect(screen.queryByText(/A\.png/)).toBeNull();expect(screen.getByText(/B\.png/)).toBeTruthy();
  prepare=prepared;fireEvent.click(send());await waitFor(()=>expect(tus.files).toEqual([selected]));
 });
 it("unmount leaves an unknown operation intact without accepting its late receipt",async()=>{
  const gate=deferred<Response>();sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=()=>gate.promise;const view=mount();await loaded();const beforeReads=reads.length;view.unmount();
  await act(async()=>gate.resolve(receipt(a)));expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(reads).toHaveLength(beforeReads);
 });
 it("old actor completion cannot release the new actor's busy job",async()=>{
  const aPrepare=deferred<Response>(),bPrepare=deferred<Response>();
  // Prepare uses a shared endpoint; choose its response by the request body.
  prepare=operation=>operation.body==="A send"?aPrepare.promise:bPrepare.promise;
  const view=mount();await loaded();fireEvent.change(textbox(),{target:{value:"A send"}});fireEvent.click(send());await waitFor(()=>expect(posts.some(post=>post.action==="prepare")).toBe(true));const opA=posts.find(post=>post.action==="prepare")!.operation;
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();fireEvent.change(textbox(),{target:{value:"B send"}});fireEvent.click(send());
  await waitFor(()=>expect(posts.filter(post=>post.action==="prepare")).toHaveLength(2));const opB=posts.filter(post=>post.action==="prepare")[1].operation;
  await act(async()=>aPrepare.resolve(receipt(opA)));
  expect(textbox().value).toBe("B send");expect(textbox().disabled).toBe(true);expect(JSON.parse(sessionStorage.getItem(key("actor-B"))!)).toEqual(opB);expect(screen.queryByRole("alert")).toBeNull();
  await act(async()=>bPrepare.resolve(prepared(opB)));await waitFor(()=>expect(textbox().disabled).toBe(false));expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(opA);
 });
 it("returning to actor A rejects its earlier generation even when ID and hash match",async()=>{
  const first=deferred<Response>(),second=deferred<Response>();let lookups=0;sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=()=>++lookups===1?first.promise:second.promise;
  const view=mount();await loaded();view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();
  view.rerender(<ConsultationThread mode="client" token="actor-A" initialMessages={[]} closed={false}/>);await loaded();const beforeReads=reads.length;
  await act(async()=>first.resolve(receipt(a)));expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(textbox().disabled).toBe(true);expect(reads).toHaveLength(beforeReads);
  await act(async()=>second.resolve(receipt(a)));await waitFor(()=>expect(textbox().disabled).toBe(false));expect(sessionStorage.getItem(key("actor-A"))).toBeNull();
 });
 it("old send response cannot retire a same-ID/hash operation after actor A-B-A",async()=>{
  const oldPrepare=deferred<Response>();prepare=()=>oldPrepare.promise;const view=mount();await loaded();fireEvent.change(textbox(),{target:{value:"Original A send"}});fireEvent.click(send());await waitFor(()=>expect(posts.some(post=>post.action==="prepare")).toBe(true));const original=posts.find(post=>post.action==="prepare")!.operation;
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();view.rerender(<ConsultationThread mode="client" token="actor-A" initialMessages={[]} closed={false}/>);await loaded();
  const beforeReads=reads.length;await act(async()=>oldPrepare.resolve(receipt(original)));expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(original);expect(textbox().value).toBe(original.body);expect(textbox().disabled).toBe(true);expect(reads).toHaveLength(beforeReads);
 });
 it("StrictMode's retired restore callback cannot retire its current generation",async()=>{
  const first=deferred<Response>(),second=deferred<Response>();let lookups=0;sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=()=>++lookups===1?first.promise:second.promise;
  render(<StrictMode><ConsultationThread mode="client" token="actor-A" initialMessages={[]} closed={false}/></StrictMode>);await loaded();expect(lookups).toBe(2);const beforeReads=reads.length;
  await act(async()=>first.resolve(receipt(a)));expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(textbox().disabled).toBe(true);expect(reads).toHaveLength(beforeReads);
  await act(async()=>second.resolve(receipt(a)));await waitFor(()=>expect(textbox().disabled).toBe(false));expect(sessionStorage.getItem(key("actor-A"))).toBeNull();
 });
 it("late cancellation A cannot release B's busy job or remove either unknown operation",async()=>{
  const cancelA=deferred<Response>(),prepareB=deferred<Response>();sessionStorage.setItem(key("actor-A"),JSON.stringify(a));cancel=()=>cancelA.promise;prepare=()=>prepareB.promise;
  const view=mount();await loaded();fireEvent.click(screen.getByRole("button",{name:"\u9001\u4fe1\u306e\u53d6\u6d88\u3092\u78ba\u8a8d"}));await waitFor(()=>expect(posts.some(post=>post.action==="cancel")).toBe(true));
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();fireEvent.change(textbox(),{target:{value:"B while cancellation"}});fireEvent.click(send());await waitFor(()=>expect(posts.some(post=>post.action==="prepare")).toBe(true));const b=posts.find(post=>post.action==="prepare")!.operation;
  await act(async()=>cancelA.resolve(Response.json({kind:"cancelled"})));expect(textbox().value).toBe("B while cancellation");expect(textbox().disabled).toBe(true);expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(a);expect(JSON.parse(sessionStorage.getItem(key("actor-B"))!)).toEqual(b);
  await act(async()=>prepareB.resolve(prepared(b)));await waitFor(()=>expect(textbox().disabled).toBe(false));
 });
 it.each(["rejection","success"] as const)("old upload progress and %s cannot mutate a new actor or continue stale upload/commit",async(outcome)=>{
  tus.held=true;const prepareB=deferred<Response>();prepare=operation=>operation.body==="New B content"?prepared(operation):prepareB.promise;
  const view=mount();await loaded();draftB(file("A.png"));fireEvent.change(screen.getByLabelText("\u76f8\u8ac7\u30d5\u30a1\u30a4\u30eb\u3092\u9078\u3076"),{target:{files:[file("A2.png")]}});fireEvent.click(send());await waitFor(()=>expect(tus.options).toHaveLength(1));const uploadA=tus.options[0],opA=posts.find(post=>post.action==="prepare")!.operation;
  view.rerender(<ConsultationThread mode="client" token="actor-B" initialMessages={[]} closed={false}/>);await loaded();fireEvent.change(textbox(),{target:{value:"New actor busy"}});fireEvent.click(send());await waitFor(()=>expect(posts.filter(post=>post.action==="prepare")).toHaveLength(2));const b=posts.filter(post=>post.action==="prepare")[1].operation;
  await act(async()=>{uploadA.onProgress?.(75,100);if(outcome==="rejection")uploadA.onError?.(new Error("SYNTHETIC_OLD_UPLOAD_FAILURE"));else uploadA.onSuccess?.({lastResponse:{getStatus:()=>201,getHeader:()=>undefined,getBody:()=>"",getUnderlyingObject:()=>null}});});
  expect(screen.queryByText(/75%/)).toBeNull();expect(screen.queryByRole("alert")).toBeNull();expect(textbox().value).toBe("New actor busy");expect(textbox().disabled).toBe(true);expect(JSON.parse(sessionStorage.getItem(key("actor-A"))!)).toEqual(opA);expect(JSON.parse(sessionStorage.getItem(key("actor-B"))!)).toEqual(b);expect(posts.filter(post=>post.action==="commit")).toHaveLength(0);expect(tus.files).toHaveLength(1);
  await act(async()=>prepareB.resolve(prepared(b)));await waitFor(()=>expect(textbox().disabled).toBe(false));
 });
});

describe("consultation read loading ownership",()=>{
 it("fast committed restore and second GET release loading while initial GET is still deferred",async()=>{
  const initial=deferred<Response>();let count=0;read=()=>++count===1?initial.promise:Response.json({messages:[{id:messageId,sender:"staff",body:"Latest accepted history",createdAt:"2026-10-01T00:00:00Z",notificationStatus:"sent",files:[]}],closed:false});
  sessionStorage.setItem(key("actor-A"),JSON.stringify(a));lookup=receipt;mount();await screen.findByText("Latest accepted history");
  fireEvent.change(textbox(),{target:{value:"Usable after accepted restore"}});expect((send() as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText("\u5c65\u6b74\u3092\u78ba\u8a8d\u4e2d\u2026")).toBeNull();
  await act(async()=>initial.resolve(Response.json({messages:[],closed:true})));expect((send() as HTMLButtonElement).disabled).toBe(false);expect(screen.getByText("Latest accepted history")).toBeTruthy();
 });
});

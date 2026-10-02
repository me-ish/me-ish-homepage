// @vitest-environment jsdom
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {webcrypto} from "node:crypto";
import type {UploadOptions} from "tus-js-client";
const tus=vi.hoisted(()=>({calls:0,fail:false}));
vi.mock("tus-js-client",()=>({Upload:class{constructor(_file:unknown,private options:UploadOptions){}start(){tus.calls++;if(tus.fail)this.options.onError?.(new Error("UPLOAD_REFUSED"));else this.options.onSuccess?.({lastResponse:{getStatus:()=>201,getHeader:()=>undefined,getBody:()=>"",getUnderlyingObject:()=>null}});}}}));
import ConsultationThread from "../ConsultationThread";
const opid="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",fileid="11111111-2222-4333-8444-555555555555",messageId="66666666-7777-4888-8999-aaaaaaaaaaaa";
type Operation={operationId:string;requestHash:string;body:string;files:{id:string}[]};
let posts:Record<string,unknown>[],committed:Operation|null,loseCommit:boolean;
let history:unknown[];
function file(){const result=new File(["fake"],"fixture.png",{type:"image/png"});Object.defineProperty(result,"arrayBuffer",{value:async()=>new TextEncoder().encode("fake").buffer});return result;}
beforeEach(()=>{
 sessionStorage.clear();history=[];posts=[];committed=null;loseCommit=false;tus.calls=0;tus.fail=false;
 vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://fixture.supabase.co");
 vi.stubGlobal("crypto",{subtle:webcrypto.subtle,randomUUID:vi.fn(()=>fileid).mockReturnValueOnce(fileid).mockReturnValueOnce(opid)});
 vi.stubGlobal("fetch",vi.fn(async(_url:string,init?:RequestInit)=>{
  if(!init?.body)return Response.json({messages:history});
  const data=JSON.parse(String(init.body)) as Record<string,unknown>;posts.push(data);const operation=data.operation as Operation;
  const receipt={kind:"committed",ok:true,messageId,operationId:operation.operationId,requestHash:operation.requestHash};
  if(data.action==="lookup")return Response.json(committed?receipt:{kind:"reserved"});
  if(data.action==="cancel")return Response.json({kind:"cancelled"});
  if(data.action==="prepare"){
   if(committed)return Response.json(receipt);
   return Response.json({kind:"prepared",ok:true,files:operation.files.map(descriptor=>({id:descriptor.id,path:opid+"/"+descriptor.id+".png",uploadToken:"synthetic",uploaded:false}))});
  }
  committed=operation;if(loseCommit){loseCommit=false;throw new Error("RESPONSE_LOST");}return Response.json(receipt);
 }));
});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();vi.unstubAllEnvs();});
async function mount(){render(<ConsultationThread mode="client" token="synthetic-token" initialMessages={[]} closed={false}/>);await waitFor(()=>expect(screen.queryByText("履歴を確認中…")).toBeNull());}
describe("consultation local draft and exact recovery",()=>{
 it("selecting and cancelling an attachment sends nothing and preserves the text draft",async()=>{
  await mount();fireEvent.change(screen.getByRole("textbox"),{target:{value:"Keep this draft"}});
  fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"),{target:{files:[file()]}});
  await screen.findByRole("button",{name:"fixture.pngの添付を取り消す"});expect(posts).toHaveLength(0);expect(tus.calls).toBe(0);
  fireEvent.click(screen.getByRole("button",{name:"fixture.pngの添付を取り消す"}));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this draft");expect(posts).toHaveLength(0);
 });
 it.each(["text","file","combined"])("commits one unified %s operation only after Send",async mode=>{
  await mount();if(mode!=="file")fireEvent.change(screen.getByRole("textbox"),{target:{value:"Unified message"}});
  if(mode!=="text")fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"),{target:{files:[file()]}});
  fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));
  await screen.findByText(/送信を保存しました/);
  expect(posts.map(post=>post.action)).toEqual(["prepare","commit"]);
  expect(posts[0].operation).toEqual(posts[1].operation);expect(tus.calls).toBe(mode==="text"?0:1);
 });
 it("replays the original operation after a lost commit response without uploading or adding a message again",async()=>{
  await mount();fireEvent.change(screen.getByRole("textbox"),{target:{value:"Keep exact content"}});
  fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"),{target:{files:[file()]}});loseCommit=true;
  fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));await screen.findByRole("alert");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"同じ送信を確認・再試行"}));await screen.findByText(/送信を保存しました/);
  expect(posts.map(post=>post.action)).toEqual(["prepare","commit","prepare"]);expect(posts[0].operation).toEqual(posts[2].operation);expect(tus.calls).toBe(1);
 });
 it("keeps the exact pending operation after upload failure and allows only confirmed cancellation to edit",async()=>{
  await mount();fireEvent.change(screen.getByRole("textbox"),{target:{value:"Keep draft"}});fireEvent.change(screen.getByLabelText("相談ファイルを選ぶ"),{target:{files:[file()]}});tus.fail=true;
  fireEvent.click(screen.getByRole("button",{name:"メッセージを送信"}));await screen.findByRole("alert");
  expect(posts.map(post=>post.action)).toEqual(["prepare"]);expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"送信の取消を確認"}));await screen.findByText(/送信を取り消しました/);
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep draft");expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(false);
 });
 it("retains a signed-link failure row and a distinct attachment-list failure indicator",async()=>{
  history=[{id:messageId,sender:"staff",body:"Saved",createdAt:"2026-10-01T00:00:00Z",notificationStatus:"sent",filesState:"unavailable",attachmentsExist:true,files:[{id:fileid,name:"Submitted.png",sizeBytes:4,url:null,exists:true,acquisitionState:"unavailable"}]}];
  render(<ConsultationThread mode="client" token="synthetic-token" closed initialMessages={[]}/>);
  await waitFor(()=>expect(screen.getByText(/Submitted.png.*提出済みの添付/)).toBeTruthy());expect(screen.getByText(/添付一覧を取得できません/)).toBeTruthy();
 });
});


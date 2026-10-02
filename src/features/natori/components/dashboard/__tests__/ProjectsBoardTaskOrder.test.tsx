// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import type {NatoriProject} from "@/features/natori/types/projects";
import type {NatoriTaskProjection} from "@/features/natori/lib/taskProjection";
const api=vi.hoisted(()=>({fetch:vi.fn(),toggle:vi.fn(),events:vi.fn()}));
vi.mock("@/features/natori/data/supabaseProjects",()=>({
 fetchNatoriProjectCollection:api.fetch,toggleNatoriTaskDone:api.toggle,
 NatoriTaskConflictError:class extends Error{},
 confirmNatoriProjectPayment:vi.fn(),deleteNatoriProject:vi.fn(),restoreNatoriProject:vi.fn(),
 updateNatoriProjectDetails:vi.fn(),updateNatoriProjectStatus:vi.fn(),
}));
vi.mock("@/features/natori/data/supabaseEvents",()=>({fetchNatoriEvents:api.events,createNatoriEvent:vi.fn(),deleteNatoriEvent:vi.fn(),updateNatoriEvent:vi.fn()}));
vi.mock("@/features/natori/components/dashboard/ProjectCard",()=>({default:({project,onToggleTask}:{project:NatoriProject;onToggleTask:(id:string,task:string)=>void})=>
 <article><output data-testid="canonical">{project.status}/{project.nextAction}/{project.mutationRevision}</output>
  {project.tasks.map(task=><button key={task.id} aria-label={task.id} aria-pressed={task.done} onClick={()=>onToggleTask(project.id,task.id)}>{task.id}</button>)}</article>}));
vi.mock("@/features/natori/components/dashboard/ProjectMonthCalendar",()=>({default:()=>null}));
vi.mock("@/features/natori/components/dashboard/ProjectDayDetail",()=>({default:()=>null}));
vi.mock("@/features/natori/components/dashboard/ProjectPriorityList",()=>({default:()=>null}));
vi.mock("@/features/natori/components/dashboard/ClosedProjectsSection",()=>({default:()=>null}));
vi.mock("@/features/natori/components/dashboard/ArchivedProjectsSection",()=>({default:()=>null}));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm",()=>({default:({onCreated}:{onCreated:()=>void})=><button onClick={onCreated}>Reload fixture</button>}));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel",()=>({default:()=>null}));
import ProjectsBoard from "../ProjectsBoard";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",stamp="2026-10-01T12:00:00.000Z";
const task=(id:string,done=false)=>({id,label:id,stage:"rough" as const,done});
const base:NatoriProject={id,title:"Synthetic",clientName:"Synthetic",amount:12000,type:"illustration",status:"rough",nextAction:"one",dueDate:null,tasks:[task("one"),task("two")],paymentConfirmedAt:stamp,mutationRevision:1};
const projection=(revision:number,tasks=base.tasks,status:NatoriTaskProjection["status"]="rough"):NatoriTaskProjection=>({id,title:"Synthetic",clientName:"Synthetic",clientEmail:null,amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:stamp,note:null,requestData:null,status,nextAction:tasks.find(t=>!t.done)?.label??"Notify delivery",mutationRevision:revision,tasks,paymentConfirmedAt:stamp,paidAt:stamp,paidAmount:12000,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function board(){api.fetch.mockResolvedValue({projects:[base],archivedProjects:[]});api.events.mockResolvedValue([]);render(<ProjectsBoard/>);await screen.findByRole("button",{name:"one"});}
describe("ProjectsBoard authoritative task results",()=>{
 it("merges two separate tasks and ignores older reversed canonical reply",async()=>{
  const first=deferred<NatoriTaskProjection>(),second=deferred<NatoriTaskProjection>();api.toggle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await board();fireEvent.click(screen.getByRole("button",{name:"one"}));fireEvent.click(screen.getByRole("button",{name:"two"}));
  expect(api.toggle.mock.calls.map(call=>call.slice(1))).toEqual([["one",true],["two",true]]);
  await act(async()=>second.resolve(projection(3,[task("one",true),task("two",true)],"delivery_prep")));
  await act(async()=>first.resolve(projection(2,[task("one",true),task("two")])));
  expect(screen.getByTestId("canonical").textContent).toBe("delivery_prep/Notify delivery/3");
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
 });
 it("rapid same-task true/false intents keep the latest server result",async()=>{
  const first=deferred<NatoriTaskProjection>(),second=deferred<NatoriTaskProjection>();api.toggle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await board();fireEvent.click(screen.getByRole("button",{name:"one"}));fireEvent.click(screen.getByRole("button",{name:"one"}));
  expect(api.toggle.mock.calls.map(call=>call[2])).toEqual([true,false]);
  await act(async()=>second.resolve(projection(3)));await act(async()=>first.resolve(projection(2,[task("one",true),task("two")])));
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("false");expect(screen.getByTestId("canonical").textContent).toBe("rough/one/3");
 });
 it("failed save reloads latest terminal state instead of retaining optimistic task status",async()=>{
  api.toggle.mockRejectedValueOnce(new Error("synthetic unavailable"));await board();
  api.fetch.mockResolvedValueOnce({projects:[{...base,status:"completed",mutationRevision:8,completedAt:stamp,deliveryAcceptedAt:stamp}],archivedProjects:[]});
  fireEvent.click(screen.getByRole("button",{name:"one"}));
  await waitFor(()=>expect(screen.getByTestId("canonical").textContent).toBe("completed/one/8"));expect(api.fetch).toHaveBeenCalledTimes(2);
 });
 it("older GET omitting a project cannot erase its task response committed while loading",async()=>{
  const oldRead=deferred<{projects:NatoriProject[];archivedProjects:NatoriProject[]}>(),update=deferred<NatoriTaskProjection>();
  await board();api.fetch.mockReturnValueOnce(oldRead.promise);api.toggle.mockReturnValueOnce(update.promise);
  fireEvent.click(screen.getByRole("button",{name:"Reload fixture"}));fireEvent.click(screen.getByRole("button",{name:"one"}));
  await act(async()=>update.resolve(projection(2,[task("one",true),task("two")])));
  await act(async()=>oldRead.resolve({projects:[],archivedProjects:[]}));
  expect(screen.getByTestId("canonical").textContent).toBe("rough/two/2");
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("true");
 });
 it("a pending same-task intent cannot contaminate confirmed rows when an older response is released",async()=>{
  const older=deferred<NatoriTaskProjection>(),newer=deferred<NatoriTaskProjection>();await board();
  api.toggle.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  fireEvent.click(screen.getByRole("button",{name:"one"}));fireEvent.click(screen.getByRole("button",{name:"one"}));
  await act(async()=>older.resolve(projection(2,[task("one",true),task("two")])));
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("false");
  await act(async()=>newer.resolve(projection(3,[task("one",true),task("two")])));
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTestId("canonical").textContent).toBe("rough/two/3");
 });
 it("failed task and failed reload remove its optimistic checkbox without inventing a status",async()=>{
  await board();api.toggle.mockRejectedValueOnce(new Error("synthetic task unavailable"));api.fetch.mockRejectedValueOnce(new Error("synthetic snapshot unavailable"));
  fireEvent.click(screen.getByRole("button",{name:"one"}));
  await waitFor(()=>expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.getByRole("button",{name:"one"}).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByTestId("canonical").textContent).toBe("rough/one/1");
 });
 it("an older successful request cannot remove a new pending-intent map",async()=>{
  const older=deferred<NatoriTaskProjection>(),newer=deferred<NatoriTaskProjection>(),latest=deferred<NatoriTaskProjection>();
  await board();api.toggle.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise).mockReturnValueOnce(latest.promise);
  fireEvent.click(screen.getByRole("button",{name:"one"}));fireEvent.click(screen.getByRole("button",{name:"one"}));
  await act(async()=>newer.resolve(projection(3)));
  fireEvent.click(screen.getByRole("button",{name:"two"}));
  expect(api.toggle.mock.calls.map(call=>call.slice(1))).toEqual([["one",true],["one",false],["two",true]]);
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
  await act(async()=>older.resolve(projection(2,[task("one",true),task("two")])));
  expect(screen.getByTestId("canonical").textContent).toBe("rough/one/3");
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
  await act(async()=>latest.resolve(projection(4,[task("one"),task("two",true)])));
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByTestId("canonical").textContent).toBe("rough/one/4");
 });
 it("an older failed request and its reload cannot remove a new pending-intent map",async()=>{
  const older=deferred<NatoriTaskProjection>(),newer=deferred<NatoriTaskProjection>(),latest=deferred<NatoriTaskProjection>();
  await board();
  api.toggle.mockReturnValueOnce(older.promise.then(()=>{throw new Error("synthetic older unavailable");})).mockReturnValueOnce(newer.promise).mockReturnValueOnce(latest.promise);
  fireEvent.click(screen.getByRole("button",{name:"one"}));fireEvent.click(screen.getByRole("button",{name:"one"}));
  await act(async()=>newer.resolve(projection(3)));
  api.fetch.mockResolvedValueOnce({projects:[{...base,mutationRevision:3}],archivedProjects:[]});
  fireEvent.click(screen.getByRole("button",{name:"two"}));
  await act(async()=>older.resolve(projection(2,[task("one",true),task("two")])));
  await waitFor(()=>expect(api.fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("canonical").textContent).toBe("rough/one/3");
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
  await act(async()=>latest.resolve(projection(4,[task("one"),task("two",true)])));
  expect(screen.getByRole("button",{name:"two"}).getAttribute("aria-pressed")).toBe("true");
 });
});

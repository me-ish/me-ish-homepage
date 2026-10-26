import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const {load}=vi.hoisted(()=>({load:vi.fn(async()=>({published:true}))}));
vi.mock("@/features/natori/server/portfolioSiteService",()=>({loadPortfolioContent:load,canEditNatoriPortfolio:vi.fn(),savePortfolioContent:vi.fn()}));
vi.mock("@/features/natori/server/natoriManagementRoute",()=>({withNatoriManagement:(_operation:string,_mutation:boolean,handler:unknown)=>handler}));
import {GET} from "./route";

describe("preserved production 1174cc45 runtime observation",()=>{
 it("logs only the runtime once per module and preserves public read/no-store",async()=>{
  const log=vi.spyOn(console,"info").mockImplementation(()=>{});
  try {
   const first=await GET(),second=await GET();
   expect(await first.json()).toEqual({content:{published:true}});
   expect(await second.json()).toEqual({content:{published:true}});
   expect(first.headers.get("Cache-Control")).toBe("no-store");
   expect(load).toHaveBeenCalledTimes(2);
   expect(log).toHaveBeenCalledExactlyOnceWith("[node-runtime]",process.version);
  } finally {log.mockRestore();}
 });
});

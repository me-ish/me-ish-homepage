// @vitest-environment jsdom
// Actual form and hashing client; deferred mock POST never leaves this process.
import {webcrypto} from "node:crypto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PortfolioCommissionForm from "@/features/natori/components/portfolio/PortfolioCommissionForm";
import {defaultPortfolioContent} from "@/features/natori/constants/portfolioContent";
import {createInitialPortfolioRequestFormState,portfolioOptionChoices} from "@/features/natori/lib/portfolioRequestForm";
import {readFrozenPortfolioSubmission,validatePortfolioForm} from "@/features/natori/lib/portfolioFormValidation";
import {canonicalizeIntake,intakeTextFields} from "@/features/natori/lib/intakeOperation";
const track=vi.hoisted(()=>vi.fn());
vi.mock("@/features/natori/data/pageEvents",()=>({trackNatoriPageEvent:track}));
const fetchMock=vi.fn();
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();vi.stubGlobal("crypto",webcrypto);vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
const samples=[
 {raw:"https://EXAMPLE.com:443/refs#pose",url:"https://example.com/refs"},
 {raw:"https://例え.テスト/資料?向き=右#ポーズ",url:"https://xn--r8jz45g.xn--zckzah/%E8%B3%87%E6%96%99?%E5%90%91%E3%81%8D=%E5%8F%B3"},
 {raw:" \nhttps://EXAMPLE.com:443/refs#pose\n ",url:"https://example.com/refs"},
];
describe("Phase5 new reference URL and immutable original agreement",()=>{
 it.each(samples)("canonicalizes validated new URL $raw without changing the editable input",({raw,url})=>{
  const state={...createInitialPortfolioRequestFormState(),message:"資料付き相談",referenceLinks:[{url:raw,label:" 衣装\n背面 "}]};
  const original=JSON.stringify(state);
  const result=validatePortfolioForm(state,portfolioOptionChoices(defaultPortfolioContent),"依頼者","client@example.com");
  expect(result.success).toBe(true);if(!result.success)throw Error("valid fixture rejected");
  expect(result.referenceLinks).toEqual([{url,label:"衣装\n背面"}]);
  const canonical=canonicalizeIntake({name:result.data.clientName,email:result.data.clientEmail,formVersion:"etorie-request-v1",requestData:JSON.stringify(result.data.requestData),referenceLinks:JSON.stringify(state.referenceLinks)},[]);
  expect(canonical.referenceLinks.map(row=>({url:row.url,label:row.label}))).toEqual(result.referenceLinks);
  expect(JSON.stringify(state)).toBe(original);
 });
 it("does not rewrite an earlier frozen raw URL or historical Japanese/multiline label",()=>{
  const state={...createInitialPortfolioRequestFormState(),message:"前回の資料付き相談"};
  const validated=validatePortfolioForm(state,portfolioOptionChoices(defaultPortfolioContent),"依頼者","client@example.com");
  if(!validated.success)throw Error("valid fixture rejected");
  const rawReferences=[{url:"https://EXAMPLE.com:443/refs#pose",label:"過去の衣装\n背面"}];
  const frozen={name:"依頼者",email:"client@example.com",requestData:JSON.stringify(validated.data.requestData),referenceLinks:JSON.stringify(rawReferences)};
  const original=JSON.stringify(frozen);const result=readFrozenPortfolioSubmission(frozen);
  expect(result.success).toBe(true);if(!result.success)throw Error("historical fixture rejected");
  expect(result.referenceLinks).toEqual(rawReferences);expect(JSON.stringify(frozen)).toBe(original);
 });
 it.each(samples.slice(0,2))("keeps canonical confirmation and POST equal after editing actual input $raw",async({raw,url})=>{
  fetchMock.mockReset();fetchMock.mockReturnValue(new Promise<Response>(()=>undefined));
  render(<PortfolioCommissionForm content={defaultPortfolioContent} structuredIntake/>);
  fireEvent.change(screen.getByLabelText(/お名前/),{target:{value:"依頼者"}});
  fireEvent.change(screen.getByLabelText(/メールアドレス/),{target:{value:"client@example.com"}});
  fireEvent.change(screen.getByLabelText(/ご相談・ご依頼の内容/),{target:{value:"資料付き相談です。"}});
  for(const title of["詳しい条件を追加する","資料"]){
   const details=Array.from(document.querySelectorAll("details")).find(row=>row.querySelector("summary")?.textContent?.includes(title));
   if(!details)throw Error("missing actual details");if(!details.open)await userEvent.click(details.querySelector("summary")!);
  }
  fireEvent.change(screen.getByLabelText("参考URL 1"),{target:{value:raw}});
  fireEvent.change(screen.getByLabelText("このURLの内容（任意）"),{target:{value:" 衣装の資料 "}});
  await userEvent.click(screen.getByRole("button",{name:"内容を確認する"}));
  let review=await screen.findByRole("region",{name:"送信前の確認"});
  expect(review.querySelector("a")?.getAttribute("href")).toBe(url);expect(review.textContent).toContain("衣装の資料");
  expect(fetchMock).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button",{name:"資料を修正する"}));
  expect((screen.getByLabelText("参考URL 1") as HTMLInputElement).value).toBe(raw);
  await userEvent.click(screen.getByRole("button",{name:"内容を確認する"}));
  review=await screen.findByRole("region",{name:"送信前の確認"});expect(review.querySelector("a")?.getAttribute("href")).toBe(url);
  await userEvent.click(screen.getByRole("button",{name:"相談内容を送信する"}));
  await waitFor(()=>expect(fetchMock.mock.calls.some(([endpoint,options])=>endpoint==="/api/natori/portfolio/contact"&&(options as RequestInit).method==="POST")).toBe(true));
  const call=fetchMock.mock.calls.find(([endpoint,options])=>endpoint==="/api/natori/portfolio/contact"&&(options as RequestInit).method==="POST");
  if(!call)throw Error("actual form POST missing");const body=(call[1] as RequestInit).body;
  expect(body).toBeInstanceOf(FormData);if(!(body instanceof FormData))throw Error("unexpected body");
  expect(JSON.parse(String(body.get("referenceLinks")))).toEqual([{url,label:"衣装の資料"}]);
  expect(canonicalizeIntake(intakeTextFields(body),[]).referenceLinks.map(row=>({url:row.url,label:row.label}))).toEqual([{url,label:"衣装の資料"}]);
  expect(JSON.parse(String(body.get("requestData"))).message).toBe("資料付き相談です。");
 });
});

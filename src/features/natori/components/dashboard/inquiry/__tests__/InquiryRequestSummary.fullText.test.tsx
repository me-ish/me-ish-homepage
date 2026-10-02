// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import InquiryRequestSummary from "@/features/natori/components/dashboard/inquiry/InquiryRequestSummary";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
function view(message:string) {return buildNatoriInquiryRequestView({schemaVersion:1,formVersion:"etorie-request-v1",inquiryMode:"consultation",requestType:"undecided",requestTypeOther:null,commissionScope:"undecided",commissionScopeOther:null,options:[],usageTypes:[],usageTypeOther:null,commercialUse:"unknown",publicationPolicy:"unknown",budget:{kind:"undecided",min:null,max:null,currency:"JPY"},deadline:{kind:"undecided",date:null,note:""},characterFeatures:"",expressionMood:"",composition:"",colorDirection:"",referenceNotes:"",message,legacySource:null});}
afterEach(cleanup);
describe("original inquiry reply visibility",()=>{
  it("shows every line of a six-line reply below 140 characters",()=>{
    const message="一枚絵を希望\n胸上でお願いします\n配信で使用します\n商用利用です\n公開は未定です\n公開日は相談してください";
    expect(message.length).toBeLessThanOrEqual(140);
    expect(message.split("\n")).toHaveLength(6);
    const source=view(message),before=JSON.stringify(source),{container}=render(<InquiryRequestSummary view={source}/>);
    const paragraph=container.querySelector('[data-field="message"]');
    expect(paragraph?.textContent).toBe(message);
    expect(paragraph?.className).not.toMatch(/line-clamp|overflow-hidden|max-h-/);
    expect(paragraph?.className).toContain("whitespace-pre-wrap");
    expect(screen.queryByRole("button",{name:"全文を見る"})).toBeNull();
    expect(JSON.stringify(source)).toBe(before);
  });
  it("keeps Japanese newlines and the final condition visible for long replies and rerenders",()=>{
    const message="かわいい雰囲気でお願いします。\n".repeat(40)+"最後の条件：AI学習は禁止です。";
    const {container,rerender}=render(<InquiryRequestSummary view={view(message)}/>);
    expect(container.querySelector('[data-field="message"]')?.textContent).toBe(message);
    rerender(<InquiryRequestSummary view={view("新しい条件\n公開日は11月1日です")}/>);
    expect(container.querySelector('[data-field="message"]')?.textContent).toBe("新しい条件\n公開日は11月1日です");
  });
  it("preserves legacy and unsupported branches",()=>{
    const {container,rerender}=render(<InquiryRequestSummary view={{kind:"legacy"}}/>);expect(container.textContent).toBe("");
    rerender(<InquiryRequestSummary view={{kind:"unsupported",issue:"request_data_unknown_version",message:"表示を確認してください"}}/>);
    expect(screen.getByRole("status").textContent).toContain("表示を確認してください");
  });
});

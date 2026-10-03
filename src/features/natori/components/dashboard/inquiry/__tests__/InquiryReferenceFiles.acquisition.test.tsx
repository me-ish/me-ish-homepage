// @vitest-environment jsdom
import {afterEach,it,expect} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import InquiryReferenceFiles from "../InquiryReferenceFiles";
afterEach(cleanup);
it("retains submitted rows when signing fails, with their saved name and a retry explanation",()=>{
 render(<InquiryReferenceFiles files={[{name:"Saved reference",url:null,exists:true,acquisitionState:"unavailable"}]} expectedCount={1} acquisitionState="ready"/>);
 expect(screen.getByText("Saved reference")).toBeTruthy();expect(screen.getByText(/提出済みの資料/)).toBeTruthy();expect(screen.getByRole("heading").textContent).toContain("1件");
});
it("shows failed acquisition even when no list could be acquired instead of implying no attachments",()=>{
 render(<InquiryReferenceFiles files={[]} acquisitionState="unavailable"/>);
 expect(screen.getByText(/資料一覧の取得に失敗/)).toBeTruthy();expect(screen.getByRole("heading")).toBeTruthy();
});

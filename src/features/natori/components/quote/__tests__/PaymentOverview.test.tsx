// @vitest-environment jsdom
import {afterEach,describe,it,expect} from "vitest";
import {render,screen,cleanup} from "@testing-library/react";
import QuoteAcceptCard from "../QuoteAcceptCard";
afterEach(cleanup);
const props={token:"synthetic",title:"Fixture",clientName:"Synthetic",amount:12000,acceptedAt:"2026-10-01T00:00:00Z",expiresAt:"2099-10-01T00:00:00Z"};
describe("quote payment facts",()=>{
 it("shows confirmed payment instead of perpetual guide waiting, retaining review warning",()=>{render(<QuoteAcceptCard {...props} payment={{available:true,confirmedAt:"2026-10-01T01:00:00Z",requiresReview:true,processing:false}}/>);expect(screen.getByText(/入金確認済みです/)).toBeTruthy();expect(screen.getByText(/お支払いの記録に確認が必要/)).toBeTruthy();expect(screen.queryByText(/今しばらくお待ち/)).toBeNull();});
 it("shows unavailable payment facts without asserting unpaid",()=>{render(<QuoteAcceptCard {...props} payment={{available:false,confirmedAt:null,requiresReview:false,processing:false}}/>);expect(screen.getByText(/入金状況を確認できませんでした/)).toBeTruthy();expect(screen.queryByText(/今しばらくお待ち/)).toBeNull();});
});

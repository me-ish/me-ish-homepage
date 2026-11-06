// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExternalCaseMoney } from "../ExternalCaseMoney";
afterEach(()=>cleanup());
const items=(...amounts:(number|null)[])=>amounts.map(amount=>({amount}));
it("shows the amount and that no payment is recorded yet, and opens 金額・入金",()=>{
 const open=vi.fn();
 render(<ExternalCaseMoney amount={30000} payment={null} items={items(10000,10000,10000)} onOpen={open}/>);
 expect(screen.getByText("30,000円")).toBeTruthy();
 expect(screen.getByText("まだ記録していません")).toBeTruthy();
 expect(screen.queryByText(/品目の合計/)).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"入金を記録する"}));
 expect(open).toHaveBeenCalledTimes(1);
});
it("warns when the items no longer add up to the case amount",()=>{
 render(<ExternalCaseMoney amount={29000} payment={null} items={items(10000,10000,10000)} onOpen={()=>{}}/>);
 expect(screen.getByText("品目の合計（30,000円）と違います。")).toBeTruthy();
 expect(screen.getByRole("button",{name:"金額を決める"})).toBeTruthy();
});
it("shows a recorded payment",()=>{
 render(<ExternalCaseMoney amount={30000} payment={{at:null}} items={null}/>);
 expect(screen.getByText("入金済み")).toBeTruthy();
 expect(screen.queryByRole("button")).toBeNull();
});
it("also checks a single item against the case amount",()=>{
 render(<ExternalCaseMoney amount={8000} payment={null} items={items(10000)} onOpen={()=>{}}/>);
 expect(screen.getByText("品目の合計（10,000円）と違います。")).toBeTruthy();
});

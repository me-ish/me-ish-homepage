// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PortfolioCommissionForm from "../PortfolioCommissionForm";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("legacy public intake steps", () => {
  it("requires contact details before review and retains a selected plan while moving back", () => {
    render(<PortfolioCommissionForm content={defaultPortfolioContent} demoMode />);
    fireEvent.click(screen.getByRole("button", { name: "見積もりを希望" }));
    fireEvent.change(screen.getByLabelText("サイズ / プラン"), { target: { value: "未定・相談して決めたい" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ進む" }));
    expect(screen.getByText(/ステップ 2 \/ 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ進む" }));
    expect(screen.queryByRole("button", { name: "この内容で送信する" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/お名前/), { target: { value: "テスト" } });
    fireEvent.change(screen.getByLabelText(/メールアドレス/), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ進む" }));
    expect(screen.getByRole("button", { name: "この内容で送信する" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    expect((screen.getByLabelText(/お名前/) as HTMLInputElement).value).toBe("テスト");
  });
});

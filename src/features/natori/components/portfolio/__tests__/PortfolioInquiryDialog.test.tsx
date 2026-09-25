// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../PortfolioCommissionForm", () => ({
  default: ({ initialMode, opening }: { initialMode?: string; opening?: number }) => (
    <div data-testid="inquiry-form" data-mode={initialMode} data-opening={opening}>
      <input aria-label="途中入力" />
    </div>
  ),
}));
vi.mock("../portfolioFonts", () => ({
  portfolioFontEn: { variable: "" },
  portfolioFontJp: { className: "", variable: "" },
}));

import PortfolioInquiryDialog from "../PortfolioInquiryDialog";
import { OPEN_PORTFOLIO_INQUIRY } from "../portfolioInquiryEvents";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("portfolio inquiry dialog", () => {
  it("opens from the page CTA, keeps input on close, and opens the requested quote mode", async () => {
    render(<PortfolioInquiryDialog content={defaultPortfolioContent} structuredIntake />);
    expect(screen.getByRole("button", { name: "まず相談したい" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "まず相談したい" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("途中入力"), { target: { value: "書きかけ" } });

    fireEvent.click(screen.getByRole("button", { name: "フォームを閉じる" }));
    window.history.replaceState({}, "", "/");
    fireEvent.popState(window);
    await waitFor(() => expect(screen.getByRole("dialog", { hidden: true }).getAttribute("data-state")).toBe("closed"));

    fireEvent(window, new CustomEvent(OPEN_PORTFOLIO_INQUIRY, { detail: { mode: "quote", fromPlan: true } }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("inquiry-form").getAttribute("data-mode")).toBe("quote");
    expect((screen.getByLabelText("途中入力") as HTMLInputElement).value).toBe("書きかけ");
  });
});

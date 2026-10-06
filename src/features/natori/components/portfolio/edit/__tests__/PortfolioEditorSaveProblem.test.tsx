// @vitest-environment jsdom
// 保存できない値があるとき、どのセクションか示して画面を動かす（Q-12）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import PortfolioEditor from "../PortfolioEditor";

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  scrollIntoView.mockReset();
});

function saveButton() {
  return screen.getByRole("button", { name: "保存する" });
}

describe("PortfolioEditor save problem (Q-12)", () => {
  it("names the section, flags it and scrolls there when a value cannot be saved", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    const nameInput = screen.getByDisplayValue(defaultPortfolioContent.artistName);
    fireEvent.change(nameInput, { target: { value: "あ".repeat(201) } });
    fireEvent.click(saveButton());

    const status = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(status.textContent).toContain("入力内容に保存できない値があります。");
    expect(status.textContent).toContain("「基本情報」に、文字数が上限（200文字）を超えている欄があります。");
    const section = document.getElementById("section-basic") as HTMLElement;
    expect(section.getAttribute("data-save-problem")).toBe("true");
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // もう一度ジャンプできる
    fireEvent.click(within(status).getByRole("button", { name: "該当箇所へ移動" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("clears the flag as soon as the value is edited", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    const nameInput = screen.getByDisplayValue(defaultPortfolioContent.artistName);
    fireEvent.change(nameInput, { target: { value: "あ".repeat(201) } });
    fireEvent.click(saveButton());
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(1);
    fireEvent.change(nameInput, { target: { value: "ナトリ" } });
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(0);
    fireEvent.click(saveButton());
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(0);
  });
});

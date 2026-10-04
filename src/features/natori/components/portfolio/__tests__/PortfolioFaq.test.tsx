// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));

import PortfolioFaq from "@/features/natori/components/portfolio/PortfolioFaq";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioFaq", () => {
  it("既定の質問を、閉じた状態の見出しつきの一覧として出す", () => {
    render(<PortfolioFaq content={defaultPortfolioContent} />);

    expect(screen.getByRole("heading", { level: 2, name: "よくある質問" })).toBeTruthy();
    const details = Array.from(document.querySelectorAll("#faq details"));
    expect(details).toHaveLength(defaultPortfolioContent.faqs?.length ?? 0);
    expect(details.length).toBeGreaterThan(0);
    for (const item of details) expect((item as HTMLDetailsElement).open).toBe(false);
    // 質問は summary の名前になり、先頭の「Q」の飾りは名前に含めない
    expect(screen.getByText("予算が決まっていなくても相談できますか？").closest("summary")).toBeTruthy();
    expect(document.querySelector("#faq summary")?.textContent).toMatch(/^Q/u);
  });

  it("質問と答えがそろった項目だけ出し、前後の空白は取り、答えの改行は残す", () => {
    render(
      <PortfolioFaq
        content={{
          ...defaultPortfolioContent,
          faqs: [
            { question: "  質問1  ", answer: "  答え1\n2行目  " },
            { question: "質問だけ", answer: "" },
            { question: "", answer: "答えだけ" },
            { question: "   ", answer: "   " },
          ],
        }}
      />,
    );

    expect(document.querySelectorAll("#faq details")).toHaveLength(1);
    expect(screen.getByText("質問1")).toBeTruthy();
    const answer = screen.getByText(/答え1/u);
    expect(answer.textContent).toBe("答え1\n2行目");
    expect(answer.className).toContain("whitespace-pre-line");
    expect(screen.queryByText("質問だけ")).toBeNull();
  });

  it("出せる項目がなければセクションごと出さない（旧データ・編集で空にしたとき）", () => {
    const { container, rerender } = render(
      <PortfolioFaq content={{ ...defaultPortfolioContent, faqs: [] }} />,
    );
    expect(container.innerHTML).toBe("");
    const { faqs: _faqs, ...legacy } = defaultPortfolioContent;
    rerender(<PortfolioFaq content={legacy} />);
    expect(container.innerHTML).toBe("");
  });
});

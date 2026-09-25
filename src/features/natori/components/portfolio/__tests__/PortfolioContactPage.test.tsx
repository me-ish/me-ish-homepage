// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PortfolioContactPage from "../PortfolioContactPage";
import { defaultPortfolioContent, planChoiceLabel } from "@/features/natori/constants/portfolioContent";

vi.mock("../portfolioFonts", () => ({ portfolioFontEn: { variable: "" }, portfolioFontJp: { variable: "", className: "" } }));
afterEach(cleanup);

it("restores a legacy plan selected from the pricing page", () => {
  const plan = { ...defaultPortfolioContent.plans[0], id: null };
  const content = { ...defaultPortfolioContent, plans: [plan] };
  render(<PortfolioContactPage content={content} mode="quote" planLabel={planChoiceLabel(plan)} />);
  expect((screen.getByLabelText("サイズ / プラン") as HTMLSelectElement).value).toBe(planChoiceLabel(plan));
  expect(screen.getByRole("heading", { level: 1, name: "ご相談・ご依頼" }).className).toContain("text-2xl");
  expect(screen.queryByRole("heading", { name: "ご依頼フォーム" })).toBeNull();
  expect(screen.queryByText("CONTACT")).toBeNull();
  expect(screen.getByText("アトリエ").style.color).toBe("rgb(236, 72, 153)");
});

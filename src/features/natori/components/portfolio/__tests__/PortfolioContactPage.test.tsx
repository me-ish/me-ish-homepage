// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  expect(screen.getByText("あとりえ").style.color).toBe("rgb(236, 72, 153)");
});

const works = [
  { ...defaultPortfolioContent.works[0], id: "shown", title: "八木かぷら様", image: "https://example.com/shown.webp", published: true },
  { ...defaultPortfolioContent.works[1], id: "hidden", title: "非公開の作品", image: "https://example.com/hidden.webp", published: false },
  { ...defaultPortfolioContent.works[2], id: "noimage", title: "画像なし", image: null, published: true },
];
const contentWithWorks = { ...defaultPortfolioContent, works };

it("puts the work chosen in the lightbox into the structured form's message, still editable", () => {
  render(<PortfolioContactPage content={contentWithWorks} mode="consultation" work="shown" structuredIntake />);
  const message = screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement;
  expect(message.value).toBe("掲載作品「八木かぷら様」の雰囲気で相談したいです。");
  fireEvent.change(message, { target: { value: "別の相談にします" } });
  expect(message.value).toBe("別の相談にします");
});

it("puts the work chosen in the lightbox above the legacy details template", () => {
  render(<PortfolioContactPage content={contentWithWorks} mode="consultation" work="shown" />);
  const details = screen.getByLabelText(/ご依頼の詳細/) as HTMLTextAreaElement;
  expect(details.value.startsWith("【参考にしたい作品】\n掲載作品「八木かぷら様」\n\n【キャラクターの特徴】")).toBe(true);
});

it("ignores works that are unpublished, have no image or do not exist, so the URL cannot name them", () => {
  for (const work of ["hidden", "noimage", "missing", undefined]) {
    render(<PortfolioContactPage content={contentWithWorks} mode="consultation" work={work} structuredIntake />);
    expect((screen.getByLabelText(/ご相談・ご依頼の内容/) as HTMLTextAreaElement).value).toBe("");
    cleanup();
  }
  render(<PortfolioContactPage content={contentWithWorks} mode="consultation" work="hidden" />);
  expect((screen.getByLabelText(/ご依頼の詳細/) as HTMLTextAreaElement).value.startsWith("【キャラクターの特徴】")).toBe(true);
});

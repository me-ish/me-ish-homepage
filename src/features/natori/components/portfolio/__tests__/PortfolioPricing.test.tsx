// @vitest-environment jsdom

import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} />
  ),
}));

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));

import PortfolioPricing from "@/features/natori/components/portfolio/PortfolioPricing";
import {
  PLAN_SELECT_EVENT,
  defaultPortfolioContent,
} from "@/features/natori/constants/portfolioContent";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE } from "@/features/natori/lib/portfolioRequestForm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortfolioPricing", () => {
  it("shows each fixed plan price as a starting price without altering ranges", () => {
    render(
      <PortfolioPricing
        content={{
          ...defaultPortfolioContent,
          plans: [
            ...defaultPortfolioContent.plans.slice(0, 2),
            { ...defaultPortfolioContent.plans[2], price: "6,000円〜8,000円" },
            { ...defaultPortfolioContent.plans[3], price: "応相談" },
          ],
        }}
      />
    );

    expect(screen.getAllByText("3,000円～")).toHaveLength(2);
    expect(screen.getAllByText("4,000円～")).toHaveLength(2);
    expect(screen.getAllByText("6,000円〜8,000円")).toHaveLength(2);
    expect(screen.getAllByText("応相談")).toHaveLength(2);
  });

  it("uses compact mobile selection rows and labels common conditions as normal-illustration only", () => {
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const pricing = document.getElementById("pricing") as HTMLElement;
    expect(pricing.className).toContain("pt-6");
    expect(pricing.className).toContain("pb-12");
    expect(pricing.className).toContain("md:py-16");

    for (const plan of defaultPortfolioContent.plans) {
      expect(screen.getByRole("link", { name: `${plan.name}を選ぶ` })).toBeTruthy();
    }

    const commonNote = screen.getByText("通常イラスト共通").parentElement as HTMLElement;
    expect(commonNote.className.split(/\s+/)).not.toContain("border");
    expect(commonNote.style.borderColor).toBe("");
    expect(screen.getByText(/リテイク2回まで、簡単な小物・簡易背景/)).toBeTruthy();
  });

  it("records both the pricing CTA and selected public plan name", () => {
    const planEvent = vi.fn();
    window.addEventListener(PLAN_SELECT_EVENT, planEvent);
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const firstPlan = defaultPortfolioContent.plans[0];
    fireEvent.click(screen.getAllByRole("link", { name: "このプランで相談" })[0]);

    expect(trackNatoriPageEvent).toHaveBeenNthCalledWith(
      1,
      "portfolio_primary_cta_click",
      "pricing"
    );
    expect(trackNatoriPageEvent).toHaveBeenNthCalledWith(
      2,
      "portfolio_plan_click",
      firstPlan.name
    );
    expect(planEvent).toHaveBeenCalledOnce();
    window.removeEventListener(PLAN_SELECT_EVENT, planEvent);
  });

  it("shows mass-production illustration from 1,500 yen with its different included conditions", () => {
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    expect(screen.getByRole("heading", { name: "量産イラスト" })).toBeTruthy();
    expect(screen.getByText("1,500円～")).toBeTruthy();
    expect(screen.getByText(/リテイク・小物・背景は基本料金に含まれません/)).toBeTruthy();
  });

  it("shows the two compact mass-production samples", () => {
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const samples = screen.getByRole("group", { name: "量産イラスト作例" });
    expect(samples.className).toContain("grid-cols-2");
    expect(samples.className).toContain("max-w-[18rem]");

    const obake = within(samples).getByRole("img", { name: "量産イラスト作例「おばけ」" });
    const majo = within(samples).getByRole("img", { name: "量産イラスト作例「魔女」" });
    expect(obake.getAttribute("src")).toBe("/natori/portfolio/mass-production/obake.webp");
    expect(majo.getAttribute("src")).toBe("/natori/portfolio/mass-production/majo.webp");
    expect(within(samples).getByText("おばけ")).toBeTruthy();
    expect(within(samples).getByText("魔女")).toBeTruthy();
  });

  it("dispatches the mass-production request value from its CTA", () => {
    const planEvent = vi.fn();
    window.addEventListener(PLAN_SELECT_EVENT, planEvent);
    render(<PortfolioPricing content={defaultPortfolioContent} />);

    const massCta = screen.getAllByRole("link", { name: "このプランで相談" }).at(-1);
    expect(massCta).toBeTruthy();
    fireEvent.click(massCta as HTMLAnchorElement);

    expect(planEvent).toHaveBeenCalledOnce();
    const event = planEvent.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toMatchObject({
      id: NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
      label: "量産イラスト（1,500円）",
    });
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_plan_click",
      "量産イラスト"
    );
    window.removeEventListener(PLAN_SELECT_EVENT, planEvent);
  });

  it("shows paused state instead of a mass-production CTA when intake is closed", () => {
    render(
      <PortfolioPricing
        content={{ ...defaultPortfolioContent, massProductionIllustrationOpen: false }}
      />
    );

    expect(screen.getByText("現在受付停止中")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "このプランで相談" })).toHaveLength(
      defaultPortfolioContent.plans.length
    );
  });
});

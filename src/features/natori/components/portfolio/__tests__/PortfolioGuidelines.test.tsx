// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PortfolioGuidelines from "@/features/natori/components/portfolio/PortfolioGuidelines";
import PortfolioWorkflow from "@/features/natori/components/portfolio/PortfolioWorkflow";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PF-01 guideline responsibility split", () => {
  it("keeps workflow and delivery together with level-two section headings", () => {
    render(<PortfolioWorkflow content={defaultPortfolioContent} />);
    const flow = document.getElementById("flow");

    expect(flow).not.toBeNull();
    expect(within(flow as HTMLElement).getByRole("heading", { level: 2, name: "制作の流れ" })).toBeTruthy();
    expect(within(flow as HTMLElement).getByRole("heading", { level: 2, name: "納期について" })).toBeTruthy();
    expect(within(flow as HTMLElement).getByText(defaultPortfolioContent.workflow[0].title)).toBeTruthy();
    expect(within(flow as HTMLElement).getByText(defaultPortfolioContent.deliveryLead)).toBeTruthy();
    expect(within(flow as HTMLElement).queryByText(defaultPortfolioContent.requests[0])).toBeNull();
    const firstStepNumber = flow?.querySelector("ol > li > span") as HTMLElement;
    expect(firstStepNumber.className).toContain("h-10 w-10");
    expect(firstStepNumber.className).toContain("text-base font-black");
    expect(firstStepNumber.style.background).toBe("rgb(213, 46, 113)");
    expect(firstStepNumber.style.color).toBe("rgb(255, 255, 255)");
  });

  it("keeps existing request guidance separate without adding FAQ content", () => {
    render(<PortfolioGuidelines content={defaultPortfolioContent} />);
    const requests = document.getElementById("requests");

    expect(requests).not.toBeNull();
    expect(
      within(requests as HTMLElement).getByRole("heading", {
        level: 2,
        name: "購入者へのお願い",
      })
    ).toBeTruthy();
    expect(within(requests as HTMLElement).getByText(defaultPortfolioContent.requests[0])).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /FAQ/i })).toBeNull();
  });
});

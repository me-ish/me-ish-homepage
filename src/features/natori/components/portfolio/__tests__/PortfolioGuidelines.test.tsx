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
    const flow = document.getElementById("flow") as HTMLElement;

    expect(flow).not.toBeNull();
    expect(flow.className).toContain("pt-16");
    expect(flow.className).toContain("pb-6");
    expect(flow.className).toContain("md:py-16");
    expect(within(flow).getByRole("heading", { level: 2, name: "制作の流れ" })).toBeTruthy();
    expect(within(flow).getByRole("heading", { level: 2, name: "納期について" })).toBeTruthy();
    expect(within(flow).getByText(defaultPortfolioContent.workflow[0].title)).toBeTruthy();
    expect(within(flow).getByText(defaultPortfolioContent.deliveryLead)).toBeTruthy();
    expect(within(flow).getByText("お急ぎ納品")).toBeTruthy();
    expect(within(flow).queryByText("サンプル使用不可")).toBeNull();
    expect(within(flow).queryByText("完全非公開")).toBeNull();
    expect(within(flow).queryByText(defaultPortfolioContent.requests[0])).toBeNull();
    const firstStepNumber = flow.querySelector("ol > li > span") as HTMLElement;
    expect(firstStepNumber.className).toContain("h-10 w-10");
    expect(firstStepNumber.className).toContain("text-base font-black");
    expect(firstStepNumber.className).toContain("border-2");
    expect(firstStepNumber.style.background).toBe("rgb(230, 106, 169)");
    expect(firstStepNumber.style.borderColor).toBe("rgb(201, 75, 137)");
    expect(firstStepNumber.style.color).toBe("rgb(255, 255, 255)");
  });

  it("keeps existing request guidance separate without adding FAQ content", () => {
    render(<PortfolioGuidelines content={defaultPortfolioContent} />);
    const requests = document.getElementById("requests") as HTMLElement;

    expect(requests).not.toBeNull();
    expect(requests.className).toContain("pt-6");
    expect(requests.className).toContain("pb-16");
    expect(requests.className).toContain("md:py-16");
    expect(
      within(requests).getByRole("heading", {
        level: 2,
        name: "購入者へのお願い",
      })
    ).toBeTruthy();
    expect(within(requests).getByText(defaultPortfolioContent.requests[0])).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /FAQ/i })).toBeNull();
  });
});

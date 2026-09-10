// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PortfolioAbout from "@/features/natori/components/portfolio/PortfolioAbout";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioAbout service cards", () => {
  it("uses a balanced responsive grid and centers an odd final item", () => {
    const { container } = render(
      <PortfolioAbout
        content={{
          ...defaultPortfolioContent,
          services: [
            "SNSアイコン",
            "配信用立ち絵",
            "オリジナルキャラクター",
            "TRPG立ち絵",
            "動画サムネイル",
            "一枚絵",
            "SDキャラ",
          ],
        }}
      />
    );

    const list = container.querySelector("#about ul");
    const items = Array.from(container.querySelectorAll("#about ul > li"));
    const last = items.at(-1);

    expect(list?.className).toContain("grid-cols-2");
    expect(list?.className).toContain("md:grid-cols-3");
    expect(items).toHaveLength(7);
    expect(last?.className).toContain("col-span-2");
    expect(last?.className).toContain("justify-self-center");
    expect(last?.className).toContain("md:col-start-2");
    expect(last?.className).toContain("min-h-11");
    expect(last?.className).toContain("text-center");
  });
});

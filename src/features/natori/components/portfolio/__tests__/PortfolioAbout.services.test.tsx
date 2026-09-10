// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent: vi.fn() }));

import PortfolioAbout from "@/features/natori/components/portfolio/PortfolioAbout";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioAbout service pills", () => {
  it("keeps the current seven services in two compact rows with short labels first", () => {
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

    const about = container.querySelector("#about") as HTMLElement;
    const rows = Array.from(container.querySelectorAll("#about ul"));
    const rowLabels = rows.map((row) =>
      Array.from(row.querySelectorAll("li")).map((item) => item.textContent)
    );
    const firstPill = rows[0]?.querySelector("li") as HTMLElement;

    expect(about.className).toContain("pb-6");
    expect(about.className).toContain("md:py-16");
    expect(rows).toHaveLength(2);
    expect(rowLabels[0]).toEqual(["SNSアイコン", "配信用立ち絵", "TRPG立ち絵", "一枚絵"]);
    expect(rowLabels[1]).toEqual(["オリジナルキャラクター", "動画サムネイル", "SDキャラ"]);
    expect(firstPill.className).toContain("rounded-full");
    expect(firstPill.className).toContain("text-[11px]");
    expect(firstPill.className).toContain("whitespace-nowrap");
  });
});

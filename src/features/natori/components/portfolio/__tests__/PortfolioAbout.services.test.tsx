// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent: vi.fn() }));

import PortfolioAbout from "@/features/natori/components/portfolio/PortfolioAbout";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

afterEach(cleanup);

describe("PortfolioAbout service pills", () => {
  it("keeps the current seven services as 13px pills with short labels first", () => {
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
    const lists = Array.from(container.querySelectorAll("#about ul"));
    const labels = Array.from(lists[0]?.querySelectorAll("li") ?? []).map((item) => item.textContent);
    const firstPill = lists[0]?.querySelector("li") as HTMLElement;

    expect(about.className).toContain("pt-6");
    expect(about.className).toContain("pb-6");
    expect(about.className).toContain("md:py-16");
    // スマホでも 13px にしたため、決まった2段ではなく1つのリストで自然に折り返す。
    expect(lists).toHaveLength(1);
    expect(labels).toEqual([
      "SNSアイコン",
      "配信用立ち絵",
      "TRPG立ち絵",
      "一枚絵",
      "オリジナルキャラクター",
      "動画サムネイル",
      "SDキャラ",
    ]);
    expect(lists[0]?.className).toContain("flex-wrap");
    expect(firstPill.className).toContain("rounded-full");
    expect(firstPill.className).toContain("text-[13px]");
    expect(firstPill.className).toContain("whitespace-nowrap");
  });
});

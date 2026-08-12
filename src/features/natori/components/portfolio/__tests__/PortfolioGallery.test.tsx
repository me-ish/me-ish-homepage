// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PortfolioGallery from "@/features/natori/components/portfolio/PortfolioGallery";
import type { PortfolioWork } from "@/features/natori/types/portfolio";

function work(id: string, options: Partial<PortfolioWork> = {}): PortfolioWork {
  return {
    id,
    title: `作品${id}`,
    tags: [],
    image: null,
    collectionId: "sd",
    featured: false,
    published: true,
    ...options,
  };
}

const collections = [
  {
    id: "sd",
    name: "SDキャラ",
    description: "小さく可愛いキャラクター",
    color: "#D9F3EE",
  },
];

describe("PortfolioGallery collections", () => {
  it("代表作品を優先して3件だけ表示し、残りをその場で展開する", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[
          work("1"),
          work("2", { featured: true }),
          work("3"),
          work("4", { featured: true }),
          work("hidden", { published: false }),
        ]}
      />,
    );

    const collection = screen.getByRole("region", { name: "SDキャラ" });
    expect(within(collection).getByText("作品2")).toBeTruthy();
    expect(within(collection).getByText("作品4")).toBeTruthy();
    expect(within(collection).getByText("作品1")).toBeTruthy();
    expect(within(collection).queryByText("作品3")).toBeNull();
    expect(screen.queryByText("作品hidden")).toBeNull();

    fireEvent.click(
      within(collection).getByRole("button", { name: "4作品をすべて見る" }),
    );
    expect(within(collection).getByText("作品3")).toBeTruthy();
    expect(
      within(collection).getByRole("button", { name: "代表作品だけ表示" }),
    ).toBeTruthy();
  });

  it("受注経路タグは公開カードに表示しない", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[work("1", { tags: ["つなぐ", "商用実績"] })]}
      />,
    );

    expect(screen.queryByText("つなぐ")).toBeNull();
    expect(screen.getByText("商用実績")).toBeTruthy();
  });
});

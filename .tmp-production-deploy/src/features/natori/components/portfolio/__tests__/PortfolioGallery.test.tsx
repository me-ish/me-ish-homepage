// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackNatoriPageEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/natori/data/pageEvents", () => ({ trackNatoriPageEvent }));

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

beforeEach(() => vi.clearAllMocks());

describe("PortfolioGallery collections", () => {
  it("カテゴリを混ぜて代表6件を表示し、全件表示と絞り込みを切り替える", () => {
    render(
      <PortfolioGallery
        collections={[...collections, { id: "single", name: "一枚絵", description: "", color: "#F2D9E0" }]}
        works={[
          work("1"),
          work("2", { featured: true }),
          work("3"),
          work("4", { featured: true }),
          work("5"),
          work("6"),
          work("single", { collectionId: "single" }),
          work("unassigned", { collectionId: "missing" }),
          work("hidden", { published: false }),
        ]}
      />,
    );

    const results = document.getElementById("portfolio-gallery-results") as HTMLElement;
    expect(results.children).toHaveLength(6);
    expect(results.children[0].textContent).toContain("作品2");
    expect(screen.getByText("作品single")).toBeTruthy();
    expect(screen.getByText("作品unassigned")).toBeTruthy();
    expect(screen.queryByText("作品6")).toBeNull();
    expect(screen.queryByText("作品hidden")).toBeNull();
    expect(screen.queryByText("ジャンルごとに代表作品をご覧いただけます。")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "全8作品を見る" }));
    expect(results.children).toHaveLength(8);
    expect(screen.getByText("作品6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "代表作品だけ表示" }));
    expect(results.children).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "一枚絵" }));
    expect(results.children).toHaveLength(1);
    expect(screen.queryByText("作品2")).toBeNull();
    expect(screen.getByRole("button", { name: "一枚絵" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(results.children).toHaveLength(6);
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

  it("モーダル内へフォーカスを移し、Tabを閉じ込め、閉じた後に作品へ戻す", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[work("1", { image: "https://example.com/work.webp" })]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "作品1 を拡大表示" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_gallery_open",
      "SDキャラ / 作品1",
    );

    const dialog = screen.getByRole("dialog", { name: "作品1" });
    const closeButton = within(dialog).getByRole("button", { name: "閉じる" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Gallery画像をLCP候補として先読みしない", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[work("1", { image: "https://example.com/work.webp" })]}
      />,
    );

    expect(screen.getByRole("img", { name: "作品1" }).getAttribute("fetchpriority")).not.toBe(
      "high",
    );
  });
});

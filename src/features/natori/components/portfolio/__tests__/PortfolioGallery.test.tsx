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
  it("編集画面の保存順を維持したまま初期6件・全件表示・カテゴリ絞り込みを切り替える", () => {
    render(
      <PortfolioGallery
        collections={[...collections, { id: "single", name: "一枚絵", description: "", color: "#F2D9E0" }]}
        works={[
          work("1"),
          work("single", { collectionId: "single" }),
          work("2", { featured: true }),
          work("unassigned", { collectionId: "missing" }),
          work("3"),
          work("4", { featured: true }),
          work("5"),
          work("6"),
          work("hidden", { published: false }),
        ]}
      />,
    );

    const results = document.getElementById("portfolio-gallery-results") as HTMLElement;
    expect(results.children).toHaveLength(6);
    expect(Array.from(results.children).map((child) => child.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("作品1"),
        expect.stringContaining("作品single"),
        expect.stringContaining("作品2"),
        expect.stringContaining("作品unassigned"),
        expect.stringContaining("作品3"),
        expect.stringContaining("作品4"),
      ]),
    );
    expect(results.children[0].textContent).toContain("作品1");
    expect(results.children[1].textContent).toContain("作品single");
    expect(results.children[2].textContent).toContain("作品2");
    expect(results.children[3].textContent).toContain("作品unassigned");
    expect(results.children[4].textContent).toContain("作品3");
    expect(results.children[5].textContent).toContain("作品4");
    expect(screen.queryByText("作品5")).toBeNull();
    expect(screen.queryByText("作品hidden")).toBeNull();
    expect(screen.queryByText("ジャンルごとに代表作品をご覧いただけます。")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "全8作品を見る" }));
    expect(results.children).toHaveLength(8);
    expect(results.children[6].textContent).toContain("作品5");
    expect(results.children[7].textContent).toContain("作品6");
    fireEvent.click(screen.getByRole("button", { name: "最初の6作品だけ表示" }));
    expect(results.children).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "SDキャラ" }));
    expect(results.children).toHaveLength(6);
    expect(Array.from(results.children).map((child) => child.textContent)).toEqual([
      expect.stringContaining("作品1"),
      expect.stringContaining("作品2"),
      expect.stringContaining("作品3"),
      expect.stringContaining("作品4"),
      expect.stringContaining("作品5"),
      expect.stringContaining("作品6"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "一枚絵" }));
    expect(results.children).toHaveLength(1);
    expect(screen.queryByText("作品2")).toBeNull();
    expect(screen.getByRole("button", { name: "一枚絵" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(results.children).toHaveLength(6);
    expect(results.children[0].textContent).toContain("作品1");
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

  it("公開ポートフォリオの拡大画面だけに関連リンクを表示してクリックを計測する", () => {
    const linkedWork = work("1", {
      image: "https://example.com/work.webp",
      relatedLinks: [
        {
          id: "work-link-client",
          kind: "client",
          label: "YouTubeチャンネル",
          href: "https://www.youtube.com/@example",
        },
        {
          id: "work-link-usage",
          kind: "usage",
          label: "グッズページ",
          href: "https://example.com/goods",
        },
      ],
    });

    const { unmount } = render(
      <PortfolioGallery collections={collections} works={[linkedWork]} variant="full" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));

    expect(screen.getByText("ご依頼者様")).toBeTruthy();
    expect(screen.getByText("制作物の使用例")).toBeTruthy();
    const youtube = screen.getByRole("link", { name: /YouTubeチャンネル/u });
    expect(youtube.getAttribute("href")).toBe("https://www.youtube.com/@example");
    fireEvent.click(youtube);
    expect(trackNatoriPageEvent).toHaveBeenCalledWith(
      "portfolio_work_link_click",
      "作品1 / client / YouTubeチャンネル",
    );

    unmount();
    vi.clearAllMocks();

    render(
      <PortfolioGallery collections={collections} works={[linkedWork]} variant="showcase" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    expect(screen.queryByText("ご依頼者様")).toBeNull();
    expect(screen.queryByRole("link", { name: /YouTubeチャンネル/u })).toBeNull();
  });

  it("表示名が空ならURLからサービス名を補う", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[
          work("1", {
            image: "https://example.com/work.webp",
            relatedLinks: [
              {
                id: "work-link-youtube",
                kind: "client",
                label: "",
                href: "https://youtu.be/example",
              },
            ],
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    expect(screen.getByRole("link", { name: /YouTube/u })).toBeTruthy();
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
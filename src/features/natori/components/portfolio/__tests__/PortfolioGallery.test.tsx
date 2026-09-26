// @vitest-environment jsdom

import type { ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} />
  ),
}));

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
  it("横長画像はカードを全幅にし、縦長画像は通常の比率を保つ", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[
          work("wide", { image: "https://example.com/wide.webp" }),
          work("tall", { image: "https://example.com/tall.webp" }),
        ]}
      />,
    );

    const wideImage = screen.getByRole("img", { name: "作品wide" });
    const tallImage = screen.getByRole("img", { name: "作品tall" });
    Object.defineProperties(wideImage, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } });
    Object.defineProperties(tallImage, { naturalWidth: { value: 900 }, naturalHeight: { value: 1600 } });
    fireEvent.load(wideImage);
    fireEvent.load(tallImage);

    expect(wideImage.closest(".pf-pin-card")?.className).toContain("col-span-2 lg:col-span-3");
    expect(wideImage.closest("#portfolio-gallery-results")?.className).toContain("lg:grid-cols-6");
    expect(wideImage.parentElement?.className).toContain("aspect-video");
    expect(tallImage.closest(".pf-pin-card")?.className).not.toContain("col-span-2");
    expect(tallImage.parentElement?.className).toContain("aspect-[3/4]");
  });

  it("卵商品をつなぐのカテゴリとして案内する", () => {
    render(<PortfolioGallery collections={[{ id: "egg", name: "卵商品", description: "", color: "#FFF0C9" }]} works={[work("egg", { collectionId: "egg" })]} />);
    expect(screen.getByRole("button", { name: "つなぐ 卵商品" })).toBeTruthy();
  });

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

  it.each(["full", "showcase"] as const)("%s: 詳細をキーボードで操作でき、Tabを閉じ込め、Esc後に作品へ戻す", async (variant) => {
    const user = userEvent.setup();
    render(
      <PortfolioGallery
        collections={collections}
        works={[work("1", { image: "https://example.com/work.webp" })]}
        variant={variant}
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
    const details = within(dialog).getByRole("region", { name: "作品画像と詳細" });
    expect(document.activeElement).toBe(closeButton);
    expect(document.body.style.overflow).toBe("hidden");

    await user.tab();
    expect(document.activeElement).toBe(details);
    await user.tab();
    expect(document.activeElement).toBe(closeButton);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(details);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("絞り込み後に拡大できる画像があるときだけ案内する", () => {
    render(
      <PortfolioGallery
        collections={[...collections, { id: "empty", name: "準備中", description: "", color: "#F2D9E0" }]}
        works={[
          work("1", { image: "https://example.com/work.webp" }),
          work("2", { collectionId: "empty" }),
        ]}
      />,
    );
    expect(screen.getByText("画像をタップ・クリックで拡大できます。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "準備中" }));
    expect(screen.queryByText("画像をタップ・クリックで拡大できます。")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(screen.getByText("画像をタップ・クリックで拡大できます。")).toBeTruthy();
  });

  it("長い作品名と関連リンクを詳細領域に表示し、末尾のリンクからフォーカスを循環する", async () => {
    const user = userEvent.setup();
    const title = "配信活動の周年記念イラストとオリジナルグッズのための描き下ろし作品";
    render(
      <PortfolioGallery
        collections={collections}
        works={[work("1", {
          title,
          image: "https://example.com/work.webp",
          relatedLinks: [{ id: "usage", kind: "usage", label: "グッズページ", href: "https://example.com/goods" }],
        })]}
      />,
    );
    const trigger = screen.getByRole("button", { name: `${title} を拡大表示` });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: title });
    const details = within(dialog).getByRole("region", { name: "作品画像と詳細" });
    expect(within(details).getByRole("heading", { name: title })).toBeTruthy();
    const link = within(details).getByRole("link", { name: /グッズページ/u });
    const close = within(dialog).getByRole("button", { name: "閉じる" });
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(link);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    fireEvent.click(screen.getByRole("dialog"));
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

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
vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));

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
    expect(tallImage.closest(".pf-pin-card")?.className).toContain("lg:col-span-2");
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

describe("PortfolioGallery pick-up and lightbox browsing", () => {
  const withImage = (id: string, options: Partial<PortfolioWork> = {}) =>
    work(id, { image: `https://example.com/${id}.webp`, ...options });

  it("先頭の1枚をピックアップとして大きく見せ、2枚目以降は通常の大きさにして、どのカードも傾けない", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1"), withImage("2"), withImage("3")]}
      />,
    );

    const cards = Array.from(document.querySelectorAll("#portfolio-gallery-results .pf-pin-card"));
    expect(cards).toHaveLength(3);
    expect(cards[0].className).toContain("col-span-2 lg:col-span-4 lg:row-span-2");
    expect(cards[0].textContent).toContain("PICK UP");
    expect(cards[1].className).toContain("lg:col-span-2");
    expect(cards[1].className).not.toContain("lg:row-span-2");
    expect(cards[1].textContent).not.toContain("PICK UP");
    for (const card of cards) {
      expect(card.className).not.toMatch(/(?:^|\s)-?rotate-/u);
    }
  });

  it("紹介文が入っているときだけ見出しの下に出し、空や空白だけなら何も出さない", () => {
    const { rerender } = render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1")]}
        intro={"  これまでのご依頼の一部です。\n2行目です。  "}
      />,
    );
    const gallery = document.getElementById("gallery") as HTMLElement;
    const heading = gallery.querySelector("h2") as HTMLElement;
    const intro = heading.parentElement?.querySelector("p") as HTMLElement;
    expect(intro.textContent).toBe("これまでのご依頼の一部です。\n2行目です。");
    expect(intro.className).toContain("whitespace-pre-line");
    expect(gallery.querySelectorAll("h2")).toHaveLength(1);

    rerender(
      <PortfolioGallery collections={collections} works={[withImage("1")]} intro={"   "} />,
    );
    expect(heading.parentElement?.querySelector("p")).toBeNull();
    rerender(<PortfolioGallery collections={collections} works={[withImage("1")]} />);
    expect(heading.parentElement?.querySelector("p")).toBeNull();
  });

  it("カテゴリの件数は見た目の補足にとどめ、ボタン名は変えない", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1"), withImage("2"), work("3")]}
      />,
    );

    const all = screen.getByRole("button", { name: "すべて" });
    expect(all.textContent).toBe("すべて3");
    expect(screen.getByRole("button", { name: "SDキャラ" }).textContent).toBe("SDキャラ3");
    expect(screen.getByRole("status").textContent).toBe("すべての作品：3作品中3作品を表示");
  });

  it("拡大表示から前後の作品へ移れ、端では反対側へ回り、閉じると最後に見た作品のカードへ戻る", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1"), withImage("2"), withImage("3")]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    let dialog = screen.getByRole("dialog", { name: "作品1" });
    expect(within(dialog).getAllByRole("button", { name: "閉じる" })).toHaveLength(1);
    expect(dialog.textContent).toContain("1 / 3");

    const next = within(dialog).getByRole("button", { name: "次の作品を表示" });
    fireEvent.click(next);
    dialog = screen.getByRole("dialog", { name: "作品2" });
    expect(dialog.textContent).toContain("2 / 3");

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "作品3" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "作品1" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    dialog = screen.getByRole("dialog", { name: "作品3" });
    fireEvent.click(within(dialog).getByRole("button", { name: "前の作品を表示" }));
    expect(screen.getByRole("dialog", { name: "作品2" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "作品2 を拡大表示" }));
  });

  it("一覧に未表示の作品も前後移動で見られ、閉じると開いたカードへ戻る", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={["1", "2", "3", "4", "5", "6", "7", "8"].map((id) => withImage(id))}
      />,
    );

    const sixth = screen.getByRole("button", { name: "作品6 を拡大表示" });
    fireEvent.click(sixth);
    fireEvent.click(screen.getByRole("button", { name: "次の作品を表示" }));
    const dialog = screen.getByRole("dialog", { name: "作品7" });
    expect(dialog.textContent).toContain("7 / 8");
    expect(screen.queryByRole("button", { name: "作品7 を拡大表示" })).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(sixth);
  });

  it("画像のない作品と、選んでいないカテゴリの作品は前後移動に含めない", () => {
    render(
      <PortfolioGallery
        collections={[...collections, { id: "single", name: "一枚絵", description: "", color: "#F2D9E0" }]}
        works={[
          withImage("1"),
          work("2"),
          withImage("3", { collectionId: "single" }),
          withImage("4"),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "SDキャラ" }));
    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    expect(screen.getByRole("dialog", { name: "作品1" }).textContent).toContain("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: "次の作品を表示" }));
    expect(screen.getByRole("dialog", { name: "作品4" }).textContent).toContain("2 / 2");
  });

  it("画像付きの作品が1つだけなら前後のボタンと位置を出さない", () => {
    render(
      <PortfolioGallery collections={collections} works={[withImage("1"), work("2")]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    const dialog = screen.getByRole("dialog", { name: "作品1" });
    expect(within(dialog).queryByRole("button", { name: "次の作品を表示" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "前の作品を表示" })).toBeNull();
    expect(dialog.textContent).not.toContain("1 / 1");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "作品1" })).toBeTruthy();
  });
});

describe("PortfolioGallery consultation from the lightbox", () => {
  const withImage = (id: string, options: Partial<PortfolioWork> = {}) =>
    work(id, { image: `https://example.com/${id}.webp`, ...options });
  const consultation = { contactPath: "/natori/portfolio/contact", query: "" };

  it("開いている作品のIDを付けて相談フォームへ誘導し、前後に移るとその作品のIDに変わる", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1"), withImage("a&b/2")]}
        consultation={consultation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    const dialog = screen.getByRole("dialog", { name: "作品1" });
    const link = within(dialog).getByRole("link", { name: "この雰囲気で相談する" });
    expect(link.getAttribute("href")).toBe("/natori/portfolio/contact?mode=consultation&work=1");

    fireEvent.click(within(dialog).getByRole("button", { name: "次の作品を表示" }));
    expect(
      within(screen.getByRole("dialog", { name: "作品a&b/2" }))
        .getByRole("link", { name: "この雰囲気で相談する" })
        .getAttribute("href"),
    ).toBe("/natori/portfolio/contact?mode=consultation&work=a%26b%2F2");
  });

  it("デモの構造化フォームの指定をそのまま引き継ぎ、クリックを計測する", () => {
    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1")]}
        consultation={{ contactPath: "/etorie/demo/app/portfolio/contact", query: "&structured=1" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    const link = screen.getByRole("link", { name: "この雰囲気で相談する" });
    expect(link.getAttribute("href")).toBe(
      "/etorie/demo/app/portfolio/contact?mode=consultation&work=1&structured=1",
    );
    // jsdom は画面遷移を実装していないので、遷移そのものは止めてクリックの計測だけを見る。
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(trackNatoriPageEvent).toHaveBeenCalledWith("portfolio_primary_cta_click", "gallery");
  });

  it("相談先を渡さないとき、作品集（showcase）では渡されても、リンクを出さない", () => {
    const { unmount } = render(
      <PortfolioGallery collections={collections} works={[withImage("1")]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    expect(screen.queryByRole("link", { name: "この雰囲気で相談する" })).toBeNull();
    unmount();

    render(
      <PortfolioGallery
        collections={collections}
        works={[withImage("1")]}
        variant="showcase"
        consultation={consultation}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "作品1 を拡大表示" }));
    expect(screen.getByRole("dialog", { name: "作品1" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "この雰囲気で相談する" })).toBeNull();
    expect(document.querySelector('a[href*="/contact"]')).toBeNull();
  });
});

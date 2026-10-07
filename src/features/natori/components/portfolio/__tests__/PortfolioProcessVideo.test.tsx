// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PortfolioProcessVideo from "@/features/natori/components/portfolio/PortfolioProcessVideo";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PROCESS_VIDEO_DEFAULT_CAPTION } from "@/features/natori/constants/portfolioProcessVideo";
import type { PortfolioContent, PortfolioProcessVideo as ProcessVideo } from "@/features/natori/types/portfolio";

afterEach(cleanup);

const ID = "dQw4w9WgXcQ";
const baseWork = defaultPortfolioContent.works[0];

function contentWith(processVideo: ProcessVideo | undefined, works = defaultPortfolioContent.works): PortfolioContent {
  return { ...defaultPortfolioContent, works, ...(processVideo ? { processVideo } : {}) };
}

describe("PortfolioProcessVideo", () => {
  it("動画が未設定・URLが空・URLを読めないときは、セクションごと出さない", () => {
    for (const processVideo of [undefined, { url: "" }, { url: "https://example.com/movie.mp4" }]) {
      const { container } = render(<PortfolioProcessVideo content={contentWith(processVideo)} />);
      expect(container.innerHTML).toBe("");
      cleanup();
    }
  });

  it("再生ボタンを押すまでYouTubeには何も読み込まず、見出し・説明・開くリンクを出す", () => {
    render(<PortfolioProcessVideo content={contentWith({ url: `https://youtu.be/${ID}?si=abc` })} />);

    expect(screen.getByRole("heading", { level: 2, name: "制作過程" })).toBeTruthy();
    expect(document.querySelector("#process")).not.toBeNull();
    expect(screen.getByText(PROCESS_VIDEO_DEFAULT_CAPTION)).toBeTruthy();
    expect(screen.getByRole("button", { name: "制作過程の動画を再生する" })).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector("img")).toBeNull();

    // 外部へ出る入口は「YouTubeで開く」リンクだけ。追跡用のパラメータは落とした標準のURLに向ける
    const link = screen.getByRole("link", { name: "YouTubeで開く" });
    expect(link.getAttribute("href")).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText(/再生するとYouTubeに接続します。/u)).toBeTruthy();
  });

  it("再生ボタンを押すと、nocookie のプレイヤーを差し込んで再生を始め、焦点も移す", () => {
    render(<PortfolioProcessVideo content={contentWith({ url: `https://www.youtube.com/watch?v=${ID}` })} />);
    fireEvent.click(screen.getByRole("button", { name: "制作過程の動画を再生する" }));

    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`
    );
    expect(frame.getAttribute("title")).toBe("制作過程の動画");
    expect(frame.getAttribute("allow")).toContain("autoplay");
    expect(frame.getAttribute("allow")).toContain("fullscreen");
    expect(frame.hasAttribute("allowfullscreen")).toBe(true);
    // YouTube は参照元が無いと再生を拒むことがあるため、同一オリジンのときだけ全文、他は origin だけ送る既定にする
    expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(screen.queryByRole("button", { name: "制作過程の動画を再生する" })).toBeNull();
    expect(document.activeElement).toBe(frame);
  });

  it("書いた説明を出し、動画を差し替えたら再生前の表示に戻る", () => {
    const { rerender } = render(
      <PortfolioProcessVideo content={contentWith({ url: `https://youtu.be/${ID}`, caption: " 下描きから仕上げまで " })} />
    );
    expect(screen.getByText("下描きから仕上げまで")).toBeTruthy();
    expect(screen.queryByText(PROCESS_VIDEO_DEFAULT_CAPTION)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "制作過程の動画を再生する" }));
    expect(document.querySelector("iframe")).not.toBeNull();

    rerender(<PortfolioProcessVideo content={contentWith({ url: "https://youtu.be/a-B_c1D2e3F" })} />);
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "制作過程の動画を再生する" })).toBeTruthy();
  });

  it("再生前の画像は、公開中で画像のある作品だけ使う", () => {
    const works = [
      { ...baseWork, id: "shown", image: "https://example.com/shown.webp", published: true },
      { ...baseWork, id: "hidden", image: "https://example.com/hidden.webp", published: false },
    ];
    const url = `https://youtu.be/${ID}`;

    render(<PortfolioProcessVideo content={contentWith({ url, posterWorkId: "shown" }, works)} />);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("https://example.com/shown.webp");
    // 装飾の画像なので、ボタンの名前は「再生する」のまま
    expect(document.querySelector("img")?.getAttribute("alt")).toBe("");
    cleanup();

    render(<PortfolioProcessVideo content={contentWith({ url, posterWorkId: "hidden" }, works)} />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "制作過程の動画を再生する" })).toBeTruthy();
  });

  it("動画の形に合わせて枠の縦横比を変える（未設定は横長）", () => {
    const frameRatio = () =>
      (document.querySelector("#process button")?.parentElement as HTMLElement | null)?.style.aspectRatio;
    const url = `https://youtu.be/${ID}`;

    render(<PortfolioProcessVideo content={contentWith({ url })} />);
    expect(frameRatio()).toBe("16 / 9");
    cleanup();
    render(<PortfolioProcessVideo content={contentWith({ url, shape: "square" })} />);
    expect(frameRatio()).toBe("1 / 1");
    cleanup();
    render(<PortfolioProcessVideo content={contentWith({ url, shape: "portrait" })} />);
    expect(frameRatio()).toBe("9 / 16");
  });
});

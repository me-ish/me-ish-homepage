// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PROCESS_VIDEO_DEFAULT_CAPTION } from "@/features/natori/constants/portfolioProcessVideo";
import type { PortfolioProcessVideo, PortfolioWork } from "@/features/natori/types/portfolio";
import PortfolioProcessVideoEditor from "./PortfolioProcessVideoEditor";

afterEach(cleanup);

const ID = "dQw4w9WgXcQ";
const base = defaultPortfolioContent.works[0];
const works: PortfolioWork[] = [
  { ...base, id: "w1", title: "作品1", image: "https://example.com/w1.webp", published: true },
  { ...base, id: "w2", title: "非公開の作品", image: "https://example.com/w2.webp", published: false },
  { ...base, id: "w3", title: "画像なし", image: null, published: true },
];

function renderEditor(value: PortfolioProcessVideo | undefined, onChange = vi.fn()) {
  render(<PortfolioProcessVideoEditor value={value} works={works} onChange={onChange} />);
  return {
    onChange,
    url: screen.getByLabelText("YouTubeの動画URL") as HTMLInputElement,
    shape: screen.getByLabelText("動画の形") as HTMLSelectElement,
    poster: screen.getByLabelText("再生前に見せる画像（ご依頼実績から1枚）") as HTMLSelectElement,
    caption: screen.getByLabelText("見出しの下の説明（任意）") as HTMLInputElement,
  };
}

describe("PortfolioProcessVideoEditor", () => {
  it("未設定のときは空欄で、入力するとURLだけの設定を渡す", () => {
    const { url, shape, poster, caption, onChange } = renderEditor(undefined);
    expect(url.value).toBe("");
    expect(shape.value).toBe("landscape");
    expect(poster.value).toBe("");
    expect(caption.value).toBe("");
    // 既定の一文は入力欄ではなく、下の補足に書く（スマホでは入力欄の例が途中で切れるため）
    expect(caption.placeholder).toBe("例: 下描きから仕上げまでの様子です。");
    expect(screen.getByText(`空欄なら「${PROCESS_VIDEO_DEFAULT_CAPTION}」と表示します。`)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "YouTubeで開いて確認する" })).toBeNull();

    fireEvent.change(url, { target: { value: `https://youtu.be/${ID}` } });
    expect(onChange).toHaveBeenLastCalledWith({ url: `https://youtu.be/${ID}` });
  });

  it("YouTubeのURLとして読めるときだけ確認リンクを出し、読めないURLには理由を出す", () => {
    renderEditor({ url: `https://youtu.be/${ID}?si=abc` });
    const link = screen.getByRole("link", { name: "YouTubeで開いて確認する" });
    expect(link.getAttribute("href")).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByText(/読み取れません/u)).toBeNull();
    cleanup();

    const { url } = renderEditor({ url: "https://example.com/movie.mp4" });
    expect(screen.queryByRole("link", { name: "YouTubeで開いて確認する" })).toBeNull();
    expect(screen.getByText(/YouTubeの動画URLとして読み取れません/u)).toBeTruthy();
    expect(url.getAttribute("aria-invalid")).toBe("true");
    cleanup();

    // 空欄は「動画なし」なので、エラーにしない
    const empty = renderEditor({ url: "" });
    expect(screen.queryByText(/読み取れません/u)).toBeNull();
    expect(empty.url.getAttribute("aria-invalid")).toBeNull();
  });

  it("動画の形を選ぶと、ほかの設定を残したまま渡す", () => {
    const { shape, onChange } = renderEditor({ url: `https://youtu.be/${ID}`, caption: "説明", posterWorkId: "w1" });
    expect(Array.from(shape.options, (option) => option.textContent)).toEqual([
      "横長（16:9）",
      "正方形",
      "縦長（9:16）",
    ]);
    fireEvent.change(shape, { target: { value: "portrait" } });
    expect(onChange).toHaveBeenLastCalledWith({
      url: `https://youtu.be/${ID}`,
      caption: "説明",
      posterWorkId: "w1",
      shape: "portrait",
    });
  });

  it("再生前の画像には画像のある作品だけ並べ、非公開は印を付ける", () => {
    const { poster, onChange } = renderEditor({ url: `https://youtu.be/${ID}` });
    expect(Array.from(poster.options, (option) => option.textContent)).toEqual([
      "なし（無地の背景）",
      "作品1",
      "非公開の作品（非公開）",
    ]);
    expect(screen.getByText(/選ばないときは無地の背景です/u)).toBeTruthy();

    fireEvent.change(poster, { target: { value: "w1" } });
    expect(onChange).toHaveBeenLastCalledWith({ url: `https://youtu.be/${ID}`, posterWorkId: "w1" });
    fireEvent.change(poster, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ url: `https://youtu.be/${ID}`, posterWorkId: null });
  });

  it("選んだ作品が公開ページで使えないときは、無地の背景になると伝える", () => {
    renderEditor({ url: `https://youtu.be/${ID}`, posterWorkId: "w1" });
    expect(screen.getByText("再生ボタンを押す前に、この作品の画像が出ます。")).toBeTruthy();
    cleanup();

    renderEditor({ url: `https://youtu.be/${ID}`, posterWorkId: "w2" });
    expect(screen.getByText("この作品は非公開のため、無地の背景になります。")).toBeTruthy();
    cleanup();

    const { poster } = renderEditor({ url: `https://youtu.be/${ID}`, posterWorkId: "deleted" });
    expect(screen.getByText("選んでいた作品が見つからないか、画像がありません。無地の背景になります。")).toBeTruthy();
    expect(Array.from(poster.options, (option) => option.textContent)).toContain("（見つからない作品）");
    expect(poster.value).toBe("deleted");
  });

  it("見出しの下の説明は、書いたとおりに渡す（空欄なら既定の一文が出る）", () => {
    const { caption, onChange } = renderEditor({ url: `https://youtu.be/${ID}`, caption: "既存の説明" });
    expect(caption.value).toBe("既存の説明");
    fireEvent.change(caption, { target: { value: "新しい説明" } });
    expect(onChange).toHaveBeenLastCalledWith({ url: `https://youtu.be/${ID}`, caption: "新しい説明" });
    expect(screen.getByText(`空欄なら「${PROCESS_VIDEO_DEFAULT_CAPTION}」と表示します。`)).toBeTruthy();
  });
});

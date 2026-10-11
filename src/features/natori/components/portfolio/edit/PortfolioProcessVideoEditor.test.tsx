// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PROCESS_VIDEO_DEFAULT_CAPTION } from "@/features/natori/constants/portfolioProcessVideo";
import type { PortfolioProcessVideo, PortfolioWork } from "@/features/natori/types/portfolio";
import PortfolioProcessVideoEditor from "./PortfolioProcessVideoEditor";

const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProcessVideo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/natori/data/supabaseProcessVideo")>();
  return { ...actual, uploadProcessVideoFile: (...args: unknown[]) => uploadMock(...args) };
});

import { ProcessVideoUploadError } from "@/features/natori/data/supabaseProcessVideo";

beforeEach(() => {
  uploadMock.mockReset();
});

afterEach(cleanup);

const ID = "dQw4w9WgXcQ";
const FILE_URL =
  "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";
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

/** 親が値を持つ実際の使い方に近づけるための入れ物 */
function Harness({
  initial,
  onChange,
  onUploadingChange,
  uploadDisabled,
}: {
  initial: PortfolioProcessVideo | undefined;
  onChange: (next: PortfolioProcessVideo) => void;
  onUploadingChange?: (uploading: boolean) => void;
  uploadDisabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PortfolioProcessVideoEditor
      value={value}
      works={works}
      uploadDisabled={uploadDisabled}
      onUploadingChange={onUploadingChange}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

const sourceButton = (name: "YouTubeのURL" | "動画ファイル") => screen.getByRole("button", { name });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const mp4 = () => new File([new Uint8Array(8)], "timelapse.mp4", { type: "video/mp4" });

describe("PortfolioProcessVideoEditor 動画ファイル", () => {
  it("動画の入れ方は、保存されているURLの種類に合わせて開く", () => {
    render(<Harness initial={undefined} onChange={vi.fn()} />);
    expect(sourceButton("YouTubeのURL").getAttribute("aria-pressed")).toBe("true");
    expect(sourceButton("動画ファイル").getAttribute("aria-pressed")).toBe("false");
    cleanup();

    render(<Harness initial={{ url: `https://youtu.be/${ID}` }} onChange={vi.fn()} />);
    expect(sourceButton("YouTubeのURL").getAttribute("aria-pressed")).toBe("true");
    cleanup();

    render(<Harness initial={{ url: FILE_URL }} onChange={vi.fn()} />);
    expect(sourceButton("動画ファイル").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("YouTubeの動画URL")).toBeNull();
    const preview = screen.getByLabelText("アップロードした動画の確認") as HTMLVideoElement;
    expect(preview.getAttribute("src")).toBe(FILE_URL);
    expect(screen.getByRole("button", { name: "別のファイルに差し替える" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "動画を外す" })).toBeTruthy();
  });

  it("動画ファイルがまだないときは、選ぶボタンと形式・大きさの案内を出す", () => {
    render(<Harness initial={undefined} onChange={vi.fn()} />);
    fireEvent.click(sourceButton("動画ファイル"));
    expect(screen.getByRole("button", { name: "動画ファイルを選ぶ" })).toBeTruthy();
    expect(screen.queryByLabelText("アップロードした動画の確認")).toBeNull();
    expect(screen.getByText(/MP4（H.264）形式、50MBまでです/u)).toBeTruthy();
    expect(fileInput().accept).toBe("video/mp4");
  });

  it("切り替えると公開されるURLも切り替わり、外したほうの入力は戻すと元に戻る", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ url: `https://youtu.be/${ID}`, caption: "説明" }} onChange={onChange} />);

    fireEvent.click(sourceButton("動画ファイル"));
    expect(onChange).toHaveBeenLastCalledWith({ url: "", caption: "説明" });
    expect(screen.queryByLabelText("YouTubeの動画URL")).toBeNull();

    fireEvent.click(sourceButton("YouTubeのURL"));
    expect(onChange).toHaveBeenLastCalledWith({ url: `https://youtu.be/${ID}`, caption: "説明" });
    expect((screen.getByLabelText("YouTubeの動画URL") as HTMLInputElement).value).toBe(`https://youtu.be/${ID}`);
  });

  it("同じ側をもう一度押しても、設定を変えない", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ url: `https://youtu.be/${ID}` }} onChange={onChange} />);
    fireEvent.click(sourceButton("YouTubeのURL"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("何も設定していないときに切り替えただけでは、設定を作らない", () => {
    const onChange = vi.fn();
    render(<Harness initial={undefined} onChange={onChange} />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.click(sourceButton("YouTubeのURL"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("選んだファイルをアップロードし、できたURLを他の設定を残したまま渡す", async () => {
    uploadMock.mockResolvedValue(FILE_URL);
    const onChange = vi.fn();
    render(<Harness initial={{ url: "", caption: "説明", shape: "portrait" }} onChange={onChange} />);
    fireEvent.click(sourceButton("動画ファイル"));

    const file = mp4();
    fireEvent.change(fileInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({ url: FILE_URL, caption: "説明", shape: "portrait" })
    );
    expect(uploadMock).toHaveBeenCalledWith(file, expect.objectContaining({ onProgress: expect.any(Function) }));
    expect((screen.getByLabelText("アップロードした動画の確認") as HTMLVideoElement).getAttribute("src")).toBe(FILE_URL);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("アップロード中は進み具合を出し、切り替えと再選択を止める", async () => {
    let finish: (url: string) => void = () => {};
    let report: (ratio: number) => void = () => {};
    uploadMock.mockImplementation(
      (_file: File, options: { onProgress: (ratio: number) => void }) =>
        new Promise<string>((resolve) => {
          report = options.onProgress;
          finish = resolve;
        })
    );
    render(<Harness initial={undefined} onChange={vi.fn()} />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });

    const bar = await screen.findByRole("progressbar", { name: "動画のアップロードの進み具合" });
    act(() => report(0.4));
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByRole("status").textContent).toContain("アップロード中です（40%）");
    expect((screen.getByRole("button", { name: "アップロード中…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((sourceButton("YouTubeのURL") as HTMLButtonElement).disabled).toBe(true);
    expect((sourceButton("動画ファイル") as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      finish(FILE_URL);
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect((sourceButton("YouTubeのURL") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "別のファイルに差し替える" })).toBeTruthy();
  });

  it("アップロード中に直した他の欄を、終わったときに巻き戻さない", async () => {
    let finish: (url: string) => void = () => {};
    uploadMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    const onChange = vi.fn();
    render(<Harness initial={undefined} onChange={onChange} />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });
    await screen.findByRole("progressbar");

    fireEvent.change(screen.getByLabelText("見出しの下の説明（任意）"), { target: { value: "待っている間に書いた説明" } });
    await act(async () => {
      finish(FILE_URL);
    });

    expect(onChange).toHaveBeenLastCalledWith({ url: FILE_URL, caption: "待っている間に書いた説明" });
  });

  it("アップロードの始まりと終わりを親に知らせる（成功しても失敗しても、終わったら false に戻す）", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let finish: (url: string) => void = () => {};
    uploadMock.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        })
    );
    const onUploadingChange = vi.fn();
    render(<Harness initial={undefined} onChange={vi.fn()} onUploadingChange={onUploadingChange} />);
    fireEvent.click(sourceButton("動画ファイル"));
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(fileInput(), { target: { files: [mp4()] } });
    await screen.findByRole("progressbar");
    expect(onUploadingChange).toHaveBeenLastCalledWith(true);
    await act(async () => {
      finish(FILE_URL);
    });
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);

    uploadMock.mockRejectedValueOnce(new ProcessVideoUploadError("アップロードに失敗しました。"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });
    await screen.findByRole("alert");
    expect(onUploadingChange.mock.calls.map(([uploading]) => uploading)).toEqual([false, true, false, true, false]);
    consoleError.mockRestore();
  });

  it("アップロードの途中でこの欄が消えても、親には終わったと知らせる", async () => {
    uploadMock.mockImplementation(() => new Promise<string>(() => {}));
    const onUploadingChange = vi.fn();
    const { unmount } = render(<Harness initial={undefined} onChange={vi.fn()} onUploadingChange={onUploadingChange} />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });
    await screen.findByRole("progressbar");
    expect(onUploadingChange).toHaveBeenLastCalledWith(true);

    unmount();
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
  });

  it("アップロードに失敗したら理由を出し、いまの設定は変えない", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    uploadMock.mockRejectedValue(new ProcessVideoUploadError("動画は50MBまでです（選んだ動画は63.2MB）。"));
    const onChange = vi.fn();
    render(<Harness initial={undefined} onChange={onChange} />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });

    expect((await screen.findByRole("alert")).textContent).toBe("動画は50MBまでです（選んだ動画は63.2MB）。");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "動画ファイルを選ぶ" })).toBeTruthy();

    // 想定外のエラーでも、画面には日本語の案内だけを出す
    uploadMock.mockRejectedValue(new Error("TypeError: Failed to fetch"));
    fireEvent.change(fileInput(), { target: { files: [mp4()] } });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "アップロードに失敗しました。通信状況を確認して、もう一度お試しください。"
      )
    );
    consoleError.mockRestore();
  });

  it("動画を外すと、動画ファイルの側のまま空にする", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ url: FILE_URL, caption: "説明" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "動画を外す" }));

    expect(onChange).toHaveBeenLastCalledWith({ url: "", caption: "説明" });
    expect(sourceButton("動画ファイル").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "動画ファイルを選ぶ" })).toBeTruthy();
  });

  it("アップロードした動画をブラウザで再生できなかったときは、形式の確認を促す", () => {
    render(<Harness initial={{ url: FILE_URL }} onChange={vi.fn()} />);
    expect(screen.queryByText(/再生できませんでした/u)).toBeNull();
    fireEvent.error(screen.getByLabelText("アップロードした動画の確認"));
    expect(screen.getByText(/この動画をブラウザで再生できませんでした。MP4（H.264）で書き出した動画か確認してください/u)).toBeTruthy();
  });

  it("デモ環境ではアップロードせず、案内だけを出す", () => {
    render(<Harness initial={undefined} onChange={vi.fn()} uploadDisabled />);
    fireEvent.click(sourceButton("動画ファイル"));
    fireEvent.click(screen.getByRole("button", { name: "動画ファイルを選ぶ" }));

    expect(screen.getByRole("alert").textContent).toBe("デモ環境のため、動画のアップロードはできません。");
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

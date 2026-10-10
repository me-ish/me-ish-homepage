import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PROCESS_VIDEO_DEFAULT_CAPTION } from "@/features/natori/constants/portfolioProcessVideo";
import type { PortfolioWork } from "@/features/natori/types/portfolio";
import {
  normalizeProcessVideoForSave,
  parseYoutubeVideoId,
  resolveProcessVideoView,
  youtubeEmbedSrc,
  youtubeWatchUrl,
} from "../portfolioProcessVideo";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeVideoId", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&list=PL123456&t=45s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abcdef`,
    `https://youtu.be/${ID}/`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `http://www.youtube.com/watch?v=${ID}`,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`,
    `  https://www.youtube.com/watch?v=${ID}  `,
  ])("%s から動画IDを取り出す", (url) => {
    expect(parseYoutubeVideoId(url)).toBe(ID);
  });

  it("ハイフンとアンダースコアを含む11文字のIDも通す", () => {
    expect(parseYoutubeVideoId("https://youtu.be/a-B_c1D2e3F")).toBe("a-B_c1D2e3F");
  });

  it.each([
    "",
    "   ",
    ID,
    "not a url",
    `https://vimeo.com/${ID}`,
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${ID}x`,
    "https://www.youtube.com/watch",
    "https://www.youtube.com/playlist?list=PL1234567890A",
    "https://www.youtube.com/channel/UC12345678901234567890",
    "https://youtu.be/",
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://www.youtube.com@evil.example/watch?v=${ID}`,
    `https://evil.example/https://www.youtube.com/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `javascript:alert(1)//www.youtube.com/watch?v=${ID}`,
  ])("%s は動画のURLとして読まない", (url) => {
    expect(parseYoutubeVideoId(url)).toBeNull();
  });
});

describe("YouTube のURL組み立て", () => {
  it("再生後に差し込むプレイヤーは nocookie ドメインで、押した直後に再生を始める", () => {
    expect(youtubeEmbedSrc(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`
    );
  });

  it("「YouTubeで開く」は標準の視聴URLに向ける", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it("動画IDは検証済みの値だけを渡す前提だが、念のためURLに埋め込む前にエスケープする", () => {
    expect(youtubeEmbedSrc("a/b?c")).toContain("/embed/a%2Fb%3Fc?");
    expect(youtubeWatchUrl("a&b")).toBe("https://www.youtube.com/watch?v=a%26b");
  });
});

describe("normalizeProcessVideoForSave", () => {
  it("未設定・URLが空（空白だけ）なら動画なしにして、他の設定も残さない", () => {
    expect(normalizeProcessVideoForSave(undefined)).toBeUndefined();
    expect(normalizeProcessVideoForSave({ url: "" })).toBeUndefined();
    expect(
      normalizeProcessVideoForSave({ url: "  \n", caption: "説明", posterWorkId: "w1", shape: "portrait" })
    ).toBeUndefined();
  });

  it("読めたURLは追跡用パラメータを落とした標準の形にし、説明の空白を取る", () => {
    expect(
      normalizeProcessVideoForSave({
        url: ` https://youtu.be/${ID}?si=tracking `,
        caption: "  早送りです  ",
        posterWorkId: "w1",
        shape: "portrait",
      })
    ).toEqual({
      url: `https://www.youtube.com/watch?v=${ID}`,
      caption: "早送りです",
      posterWorkId: "w1",
      shape: "portrait",
    });
  });

  it("書いていない項目は足さず、作品の指定だけ null で明示する", () => {
    expect(normalizeProcessVideoForSave({ url: `https://youtu.be/${ID}` })).toEqual({
      url: `https://www.youtube.com/watch?v=${ID}`,
      posterWorkId: null,
    });
  });

  it("読めないURLはそのまま残し、保存前検証で弾けるようにする", () => {
    expect(normalizeProcessVideoForSave({ url: " https://example.com/video " })?.url).toBe(
      "https://example.com/video"
    );
  });
});

describe("resolveProcessVideoView", () => {
  const work = defaultPortfolioContent.works[0];
  const works: PortfolioWork[] = [
    { ...work, id: "w1", title: "作品1", image: "https://example.com/w1.webp", published: true },
    { ...work, id: "w2", title: "非公開", image: "https://example.com/w2.webp", published: false },
    { ...work, id: "w3", title: "画像なし", image: null, published: true },
  ];
  const view = (processVideo: Parameters<typeof resolveProcessVideoView>[0]["processVideo"]) =>
    resolveProcessVideoView({ processVideo, works });

  it("動画が未設定、またはURLを動画として読めなければ出さない", () => {
    expect(view(undefined)).toBeNull();
    expect(view({ url: "" })).toBeNull();
    expect(view({ url: "https://example.com/video" })).toBeNull();
  });

  it("説明・形が未設定なら既定（既定の一文・横長）で補う", () => {
    expect(view({ url: `https://youtu.be/${ID}` })).toEqual({
      videoId: ID,
      caption: PROCESS_VIDEO_DEFAULT_CAPTION,
      shape: "landscape",
      posterImage: null,
    });
    expect(view({ url: `https://youtu.be/${ID}`, caption: "   " })?.caption).toBe(PROCESS_VIDEO_DEFAULT_CAPTION);
  });

  it("書いた説明と形はそのまま使う", () => {
    expect(view({ url: `https://youtu.be/${ID}`, caption: " 下描きから仕上げまで ", shape: "square" })).toMatchObject({
      caption: "下描きから仕上げまで",
      shape: "square",
    });
  });

  it("再生前の画像は、公開中で画像のある作品だけ使う", () => {
    const url = `https://youtu.be/${ID}`;
    expect(view({ url, posterWorkId: "w1" })?.posterImage).toBe("https://example.com/w1.webp");
    expect(view({ url, posterWorkId: "w2" })?.posterImage).toBeNull();
    expect(view({ url, posterWorkId: "w3" })?.posterImage).toBeNull();
    expect(view({ url, posterWorkId: "deleted" })?.posterImage).toBeNull();
    expect(view({ url, posterWorkId: null })?.posterImage).toBeNull();
  });
});

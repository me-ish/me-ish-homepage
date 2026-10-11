import { describe, expect, it } from "vitest";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { PROCESS_VIDEO_DEFAULT_CAPTION } from "@/features/natori/constants/portfolioProcessVideo";
import type { PortfolioWork } from "@/features/natori/types/portfolio";
import {
  checkProcessVideoFile,
  describeProcessVideoFileProblem,
  formatProcessVideoSize,
  normalizeProcessVideoForSave,
  parseProcessVideoFileUrl,
  parseProcessVideoSource,
  parseYoutubeVideoId,
  resolveProcessVideoView,
  youtubeEmbedSrc,
  youtubeWatchUrl,
} from "../portfolioProcessVideo";

const ID = "dQw4w9WgXcQ";
const FILE_URL = "https://abcdefgh.supabase.co/storage/v1/object/public/natori-portfolio/videos/3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b.mp4";

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
      source: { kind: "youtube", videoId: ID },
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

describe("parseProcessVideoFileUrl", () => {
  it("動画用のフォルダにある .mp4 の公開URLを、標準の形で返す", () => {
    expect(parseProcessVideoFileUrl(FILE_URL)).toBe(FILE_URL);
    expect(parseProcessVideoFileUrl(`  ${FILE_URL}  `)).toBe(FILE_URL);
    expect(parseProcessVideoFileUrl(FILE_URL.replace("https://abcdefgh.supabase.co", "HTTPS://ABCDEFGH.supabase.co"))).toBe(FILE_URL);
  });

  it("ローカルの Supabase（http・ポート付き）の公開URLも通す", () => {
    const local = "http://127.0.0.1:54321/storage/v1/object/public/natori-portfolio/videos/a-b_c1.mp4";
    expect(parseProcessVideoFileUrl(local)).toBe(local);
  });

  it.each([
    ["空", ""],
    ["空白だけ", "   "],
    ["URLではない", "videos/a.mp4"],
    ["拡張子が違う", FILE_URL.replace(".mp4", ".mov")],
    ["拡張子の大文字", FILE_URL.replace(".mp4", ".MP4")],
    ["別のフォルダ", FILE_URL.replace("/videos/", "/images/")],
    ["別のバケット", FILE_URL.replace("/natori-portfolio/", "/natori-deliveries/")],
    ["公開URLではない（非公開の取得口）", FILE_URL.replace("/object/public/", "/object/sign/")],
    ["フォルダの入れ子", FILE_URL.replace("/videos/", "/videos/nested/")],
    ["フォルダの外へ出る", FILE_URL.replace("/videos/", "/videos/%2e%2e/")],
    ["クエリ付き", `${FILE_URL}?t=1`],
    ["フラグメント付き", `${FILE_URL}#t=10`],
    ["認証情報付き", FILE_URL.replace("https://", "https://user:pass@")],
    ["ftp", FILE_URL.replace("https://", "ftp://")],
    ["javascript", `javascript:alert(1)//${FILE_URL}`],
    ["ファイル名に記号", FILE_URL.replace("3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b", "a%20b")],
    ["ファイル名が長すぎる", FILE_URL.replace("3f2b8c1e-9d4a-4b7e-8a1f-0c5d6e7f8a9b", "a".repeat(81))],
    ["YouTube の動画", `https://youtu.be/${ID}`],
  ])("%s は動画ファイルのURLとして読まない", (_label, url) => {
    expect(parseProcessVideoFileUrl(url)).toBeNull();
  });
});

describe("parseProcessVideoSource", () => {
  it("YouTube と動画ファイルを見分ける", () => {
    expect(parseProcessVideoSource(`https://youtu.be/${ID}`)).toEqual({ kind: "youtube", videoId: ID });
    expect(parseProcessVideoSource(FILE_URL)).toEqual({ kind: "file", url: FILE_URL });
  });

  it("どちらでもないURLは null", () => {
    expect(parseProcessVideoSource("")).toBeNull();
    expect(parseProcessVideoSource("https://example.com/video.mp4")).toBeNull();
  });
});

describe("checkProcessVideoFile", () => {
  const mp4 = { name: "timelapse.mp4", type: "video/mp4", size: 30_000_000 };

  it("MP4 で上限以内なら問題なし", () => {
    expect(checkProcessVideoFile(mp4)).toBeNull();
    expect(checkProcessVideoFile({ ...mp4, size: 50_000_000 })).toBeNull();
    expect(checkProcessVideoFile({ type: " Video/MP4 ", size: 1 })).toBeNull();
  });

  it("種類が空のブラウザでは、拡張子が .mp4 のときだけ通す", () => {
    expect(checkProcessVideoFile({ name: "A.MP4", type: "", size: 10 })).toBeNull();
    expect(checkProcessVideoFile({ name: "a.mov", type: "", size: 10 })).toBe("not-mp4");
    expect(checkProcessVideoFile({ type: "", size: 10 })).toBe("not-mp4");
  });

  it("MP4 以外は not-mp4（名前が .mp4 でも種類が違えば通さない）", () => {
    expect(checkProcessVideoFile({ ...mp4, type: "video/quicktime" })).toBe("not-mp4");
    expect(checkProcessVideoFile({ ...mp4, type: "video/webm" })).toBe("not-mp4");
    expect(checkProcessVideoFile({ ...mp4, type: "image/png" })).toBe("not-mp4");
  });

  it("空のファイルは empty、上限を1バイトでも超えたら too-large", () => {
    expect(checkProcessVideoFile({ ...mp4, size: 0 })).toBe("empty");
    expect(checkProcessVideoFile({ ...mp4, size: Number.NaN })).toBe("empty");
    expect(checkProcessVideoFile({ ...mp4, size: 50_000_001 })).toBe("too-large");
  });
});

describe("動画ファイルの案内文", () => {
  it("バイト数は 1MB = 1,000,000 バイトで数える", () => {
    expect(formatProcessVideoSize(63_200_000)).toBe("63.2MB");
    expect(formatProcessVideoSize(50_000_000)).toBe("50.0MB");
  });

  it("理由ごとに、直し方のわかる日本語を返す", () => {
    expect(describeProcessVideoFileProblem("not-mp4")).toBe("MP4形式（.mp4）の動画を選んでください。");
    expect(describeProcessVideoFileProblem("empty")).toContain("空");
    expect(describeProcessVideoFileProblem("too-large", 63_200_000)).toBe(
      "動画は50MBまでです（選んだ動画は63.2MB）。書き出しの画質やサイズを下げてから、もう一度選んでください。"
    );
    expect(describeProcessVideoFileProblem("too-large")).toBe(
      "動画は50MBまでです。書き出しの画質やサイズを下げてから、もう一度選んでください。"
    );
  });
});

describe("動画ファイルの保存前整形と表示内容", () => {
  const work = defaultPortfolioContent.works[0];
  const works: PortfolioWork[] = [
    { ...work, id: "w1", title: "作品1", image: "https://example.com/w1.webp", published: true },
  ];

  it("動画ファイルのURLは空白を取った標準の形にして残す", () => {
    expect(normalizeProcessVideoForSave({ url: ` ${FILE_URL} `, shape: "portrait" })).toEqual({
      url: FILE_URL,
      posterWorkId: null,
      shape: "portrait",
    });
  });

  it("動画ファイルのURLは file として表示内容に出し、再生前の画像・説明・形も使う", () => {
    expect(
      resolveProcessVideoView({
        processVideo: { url: FILE_URL, caption: "仕上げまで", posterWorkId: "w1", shape: "square" },
        works,
      })
    ).toEqual({
      source: { kind: "file", url: FILE_URL },
      caption: "仕上げまで",
      shape: "square",
      posterImage: "https://example.com/w1.webp",
    });
  });

  it("他のサイトの .mp4 は動画として読まない（セクションごと出さない）", () => {
    expect(
      resolveProcessVideoView({ processVideo: { url: "https://example.com/video.mp4" }, works })
    ).toBeNull();
  });
});

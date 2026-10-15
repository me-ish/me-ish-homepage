// features/natori/lib/portfolioProcessVideo.ts
// 制作過程の動画の純関数。YouTube のURL判定、動画ファイル（Storage の公開URL）の判定、
// アップロード前のファイル検査、保存前の整形、公開側の表示内容。
import {
  PROCESS_VIDEO_BUCKET,
  PROCESS_VIDEO_DEFAULT_CAPTION,
  PROCESS_VIDEO_DEFAULT_SHAPE,
  PROCESS_VIDEO_FILE_MAX_BYTES,
  PROCESS_VIDEO_FILE_MAX_LABEL,
  PROCESS_VIDEO_FOLDER,
} from "@/features/natori/constants/portfolioProcessVideo";
import {parsePortfolioAssetUrl,portfolioAssetUrl} from "./portfolioAssetUrl";
import type {
  PortfolioContent,
  PortfolioProcessVideo,
  PortfolioProcessVideoShape,
  PortfolioWork,
} from "@/features/natori/types/portfolio";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const YOUTUBE_HOSTS = new Set(["youtube.com", "youtu.be", "youtube-nocookie.com"]);
/** /shorts/<id> のように、パスの2つ目が動画IDになるURLの1つ目 */
const VIDEO_ID_AFTER_SEGMENT = new Set(["shorts", "embed", "live", "v"]);

/**
 * YouTube の動画URLから11文字の動画IDを取り出す。
 * watch?v= / youtu.be/ / shorts / embed / live の形を受け付け、YouTube 以外のURLや形式の違うURLは null。
 */
export function parseYoutubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./u, "");
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  let candidate: string | null | undefined;
  if (host === "youtu.be") {
    candidate = segments[0];
  } else if (segments[0] === "watch") {
    candidate = url.searchParams.get("v");
  } else if (segments[0] !== undefined && VIDEO_ID_AFTER_SEGMENT.has(segments[0])) {
    candidate = segments[1];
  }
  return candidate != null && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * 再生ボタンを押したあとに差し込むプレイヤーのURL。
 * 閲覧情報の保存を再生するまで抑える nocookie ドメインを使い、関連動画は同じチャンネルのものに絞る。
 */
export function youtubeEmbedSrc(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`;
}

/** 「YouTubeで開く」リンクの行き先 */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/* ---------- 動画ファイル（Supabase Storage の公開URL） ---------- */

/** 公開URLのパスのうち、ファイル名より前の部分（/storage/v1/object/public/<バケット>/<フォルダ>/） */
const FILE_PATH_PREFIX = `/storage/v1/object/public/${PROCESS_VIDEO_BUCKET}/${PROCESS_VIDEO_FOLDER}/`;
/** アップロードで付けるファイル名（UUID + .mp4）を含む、英数字・ハイフン・アンダースコアだけの名前 */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.mp4$/u;

/**
 * アップロードした動画ファイルの公開URLかどうかを判定し、標準の形（クエリ・フラグメントなし）で返す。
 * 動画用のバケットとフォルダにある .mp4 だけを受け付け、それ以外（他のサイトの動画など）は null。
 * ホスト名は見ない（Supabase のドメインは環境ごとに違うため）。URLを組み立てるのはサーバー側だけ。
 */
export function parseProcessVideoFileUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const managed=parsePortfolioAssetUrl(trimmed);
  if (managed?.kind==="video") return portfolioAssetUrl(managed.id,managed.kind,managed.management);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (!url.pathname.startsWith(FILE_PATH_PREFIX)) return null;
  if (!FILE_NAME.test(url.pathname.slice(FILE_PATH_PREFIX.length))) return null;
  return `${url.origin}${url.pathname}`;
}

/** 制作過程の動画のもと。YouTube の動画か、アップロードした動画ファイルのどちらか */
export type ProcessVideoSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; url: string };

/** 保存されているURLが何の動画かを読み取る。どちらにも読めなければ null。 */
export function parseProcessVideoSource(value: string): ProcessVideoSource | null {
  const videoId = parseYoutubeVideoId(value);
  if (videoId) return { kind: "youtube", videoId };
  const fileUrl = parseProcessVideoFileUrl(value);
  return fileUrl ? { kind: "file", url: fileUrl } : null;
}

export type ProcessVideoFileProblem = "empty" | "not-mp4" | "too-large";

/**
 * アップロード前のファイル検査。問題がなければ null。
 * 形式は種類（video/mp4）で見る。種類が空のブラウザもあるので、そのときだけ拡張子で補う。
 */
export function checkProcessVideoFile(file: {
  name?: string;
  type: string;
  size: number;
}): ProcessVideoFileProblem | null {
  const type = file.type.trim().toLowerCase();
  const isMp4 = type === "video/mp4" || (type === "" && (file.name ?? "").toLowerCase().endsWith(".mp4"));
  if (!isMp4) return "not-mp4";
  if (!Number.isFinite(file.size) || file.size <= 0) return "empty";
  if (file.size > PROCESS_VIDEO_FILE_MAX_BYTES) return "too-large";
  return null;
}

/** バイト数を「63.2MB」の形にする（上限の「50MB」と同じ 1MB = 1,000,000 バイトで数える） */
export function formatProcessVideoSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

/** アップロードできない理由を、編集画面にそのまま出せる日本語にする */
export function describeProcessVideoFileProblem(problem: ProcessVideoFileProblem, size?: number): string {
  switch (problem) {
    case "not-mp4":
      return "MP4形式（.mp4）の動画を選んでください。";
    case "empty":
      return "中身が空のファイルです。別の動画を選んでください。";
    case "too-large":
      return `動画は${PROCESS_VIDEO_FILE_MAX_LABEL}までです${
        size !== undefined ? `（選んだ動画は${formatProcessVideoSize(size)}）` : ""
      }。書き出しの画質やサイズを下げてから、もう一度選んでください。`;
  }
}

/* ---------- 保存前の整形・公開側の表示内容 ---------- */

/**
 * 保存前の整形。URLが空なら動画なし（undefined）として設定ごと保存しない。
 * YouTube のURLとして読めたものは、追跡用のパラメータなどを落として標準の形に直す。
 * 動画ファイルのURLとして読めたものも、標準の形（クエリなし）にそろえる。
 * どちらにも読めないURLはそのまま残し、保存前検証（portfolioContentSchema）で弾く。
 */
export function normalizeProcessVideoForSave(
  video: PortfolioProcessVideo | undefined
): PortfolioProcessVideo | undefined {
  if (!video) return undefined;
  const url = video.url.trim();
  if (url.length === 0) return undefined;
  const source = parseProcessVideoSource(url);
  const normalizedUrl = !source ? url : source.kind === "youtube" ? youtubeWatchUrl(source.videoId) : source.url;
  return {
    url: normalizedUrl,
    ...(video.published !== undefined ? { published: video.published } : {}),
    ...(video.caption !== undefined ? { caption: video.caption.trim() } : {}),
    posterWorkId: video.posterWorkId ?? null,
    ...(video.posterHeroImage ? { posterHeroImage: video.posterHeroImage } : {}),
    ...(video.shape !== undefined ? { shape: video.shape } : {}),
  };
}

/**
 * 再生前に見せる画像のURL。HERO画像の指定があり、いまもHEROに入っていればそれを使う。
 * そうでなければ、公開中で画像のある作品だけを使い、未設定・非公開・削除済み・画像なしなら null。
 */
function processVideoPosterImage(
  video: Pick<PortfolioProcessVideo, "posterWorkId" | "posterHeroImage">,
  works: PortfolioWork[],
  heroImages: readonly string[]
): string | null {
  if (video.posterHeroImage) return heroImages.includes(video.posterHeroImage) ? video.posterHeroImage : null;
  if (!video.posterWorkId) return null;
  const work = works.find((candidate) => candidate.id === video.posterWorkId);
  return work && work.published && work.image ? work.image : null;
}

export type PortfolioProcessVideoView = {
  source: ProcessVideoSource;
  /** 空にならない（書いていなければ既定の一文） */
  caption: string;
  shape: PortfolioProcessVideoShape;
  posterImage: string | null;
};

/** 公開ページに出す内容。動画が未設定、またはURLを動画として読めないときは null（セクションごと出さない）。 */
export function resolveProcessVideoView(
  content: Pick<PortfolioContent, "processVideo" | "works"> & Partial<Pick<PortfolioContent, "heroImages" | "heroImage">>
): PortfolioProcessVideoView | null {
  const video = content.processVideo;
  if (!video) return null;
  const source = parseProcessVideoSource(video.url);
  if (!source) return null;
  return {
    source,
    caption: video.caption?.trim() || PROCESS_VIDEO_DEFAULT_CAPTION,
    shape: video.shape ?? PROCESS_VIDEO_DEFAULT_SHAPE,
    posterImage: processVideoPosterImage(
      video,
      content.works,
      content.heroImages ?? (content.heroImage ? [content.heroImage] : [])
    ),
  };
}

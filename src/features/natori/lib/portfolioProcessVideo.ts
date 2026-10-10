// features/natori/lib/portfolioProcessVideo.ts
// 制作過程の動画（YouTube）の純関数。URLの判定・プレイヤーURLの組み立て・保存前の整形・公開側の表示内容。
import {
  PROCESS_VIDEO_DEFAULT_CAPTION,
  PROCESS_VIDEO_DEFAULT_SHAPE,
} from "@/features/natori/constants/portfolioProcessVideo";
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

/**
 * 保存前の整形。URLが空なら動画なし（undefined）として設定ごと保存しない。
 * YouTube のURLとして読めたものは、追跡用のパラメータなどを落として標準の形に直す。
 * 読めないURLはそのまま残し、保存前検証（portfolioContentSchema）で弾く。
 */
export function normalizeProcessVideoForSave(
  video: PortfolioProcessVideo | undefined
): PortfolioProcessVideo | undefined {
  if (!video) return undefined;
  const url = video.url.trim();
  if (url.length === 0) return undefined;
  const videoId = parseYoutubeVideoId(url);
  return {
    url: videoId ? youtubeWatchUrl(videoId) : url,
    ...(video.caption !== undefined ? { caption: video.caption.trim() } : {}),
    posterWorkId: video.posterWorkId ?? null,
    ...(video.shape !== undefined ? { shape: video.shape } : {}),
  };
}

/** 再生前に見せる画像のURL。公開中で画像のある作品だけを使い、未設定・非公開・削除済み・画像なしなら null。 */
function processVideoPosterImage(
  video: Pick<PortfolioProcessVideo, "posterWorkId">,
  works: PortfolioWork[]
): string | null {
  if (!video.posterWorkId) return null;
  const work = works.find((candidate) => candidate.id === video.posterWorkId);
  return work && work.published && work.image ? work.image : null;
}

export type PortfolioProcessVideoView = {
  videoId: string;
  /** 空にならない（書いていなければ既定の一文） */
  caption: string;
  shape: PortfolioProcessVideoShape;
  posterImage: string | null;
};

/** 公開ページに出す内容。動画が未設定、またはURLを動画として読めないときは null（セクションごと出さない）。 */
export function resolveProcessVideoView(
  content: Pick<PortfolioContent, "processVideo" | "works">
): PortfolioProcessVideoView | null {
  const video = content.processVideo;
  if (!video) return null;
  const videoId = parseYoutubeVideoId(video.url);
  if (!videoId) return null;
  return {
    videoId,
    caption: video.caption?.trim() || PROCESS_VIDEO_DEFAULT_CAPTION,
    shape: video.shape ?? PROCESS_VIDEO_DEFAULT_SHAPE,
    posterImage: processVideoPosterImage(video, content.works),
  };
}

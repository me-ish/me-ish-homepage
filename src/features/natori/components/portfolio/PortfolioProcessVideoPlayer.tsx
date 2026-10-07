"use client";

// features/natori/components/portfolio/PortfolioProcessVideoPlayer.tsx
// 制作過程の動画のプレイヤー。再生ボタンを押すまでYouTubeには接続せず、押したときにだけ埋め込みを読み込む。
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { youtubeEmbedSrc } from "@/features/natori/lib/portfolioProcessVideo";
import type { PortfolioProcessVideoShape } from "@/features/natori/types/portfolio";

/** 縦長・正方形は、スマホでも画面に収まるよう幅を抑える */
const FRAME_BY_SHAPE: Record<PortfolioProcessVideoShape, { aspectRatio: string; maxWidth: string }> = {
  landscape: { aspectRatio: "16 / 9", maxWidth: "100%" },
  square: { aspectRatio: "1 / 1", maxWidth: "min(100%, 32rem)" },
  portrait: { aspectRatio: "9 / 16", maxWidth: "min(100%, 22rem)" },
};

export default function PortfolioProcessVideoPlayer({
  videoId,
  shape,
  posterImage,
}: {
  videoId: string;
  shape: PortfolioProcessVideoShape;
  /** 再生前に見せる画像。null なら無地の背景 */
  posterImage: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 再生ボタンが消えたあとも、キーボード操作の続きがプレイヤーから始まるようにする
  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  return (
    <div className="relative mx-auto" style={FRAME_BY_SHAPE[shape]}>
      <div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${c.actionSoft}, ${c.accentSoft})`,
          boxShadow: `0 10px 22px ${c.shadowSoft}`,
        }}
      >
        {playing ? (
          <iframe
            ref={iframeRef}
            src={youtubeEmbedSrc(videoId)}
            title="制作過程の動画"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        ) : posterImage ? (
          // アップロード画像は公開Storage URLなので next/image のhost設定に依存させない
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterImage} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      {playing ? null : (
        // 枠の外に出る焦点リングが切れないよう、ボタンは角丸でクリップする枠の外に重ねる
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="制作過程の動画を再生する"
          className="pf-cute-focus group absolute inset-0 grid place-items-center rounded-2xl"
        >
          <span
            aria-hidden="true"
            className="grid h-16 w-16 place-items-center rounded-full transition-transform group-hover:scale-105 motion-reduce:transition-none md:h-20 md:w-20"
            style={{ background: c.surface, boxShadow: `0 8px 20px ${c.shadowHover}` }}
          >
            <Play
              className="h-7 w-7 translate-x-0.5 md:h-9 md:w-9"
              style={{ color: c.actionTextSmall }}
              fill="currentColor"
            />
          </span>
        </button>
      )}
    </div>
  );
}

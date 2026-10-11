"use client";

// features/natori/components/portfolio/PortfolioProcessVideoPlayer.tsx
// 制作過程の動画（YouTube）のプレイヤー。再生ボタンを押すまでYouTubeには接続せず、押したときにだけ埋め込みを読み込む。
import { useEffect, useRef, useState } from "react";
import { youtubeEmbedSrc } from "@/features/natori/lib/portfolioProcessVideo";
import type { PortfolioProcessVideoShape } from "@/features/natori/types/portfolio";
import PortfolioProcessVideoFrame from "./PortfolioProcessVideoFrame";
import PortfolioProcessVideoPlayButton from "./PortfolioProcessVideoPlayButton";

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
    <PortfolioProcessVideoFrame
      shape={shape}
      posterImage={playing ? null : posterImage}
      overlay={playing ? null : <PortfolioProcessVideoPlayButton onClick={() => setPlaying(true)} />}
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
      ) : null}
    </PortfolioProcessVideoFrame>
  );
}

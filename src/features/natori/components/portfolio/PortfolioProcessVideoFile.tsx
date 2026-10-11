"use client";

// features/natori/components/portfolio/PortfolioProcessVideoFile.tsx
// 制作過程の動画（アップロードした動画ファイル）。YouTube と同じ見た目の再生ボタンを出し、押すまで動画は読み込まない。
// 動画の要素は最初から置き、再生はボタンを押した操作の中で始める（iPhone は、操作の外から始める再生を止めるため）。
import { useEffect, useRef, useState } from "react";
import type { PortfolioProcessVideoShape } from "@/features/natori/types/portfolio";
import PortfolioProcessVideoFrame from "./PortfolioProcessVideoFrame";
import PortfolioProcessVideoPlayButton from "./PortfolioProcessVideoPlayButton";

export default function PortfolioProcessVideoFile({
  url,
  shape,
  posterImage,
}: {
  url: string;
  shape: PortfolioProcessVideoShape;
  /** 再生前に見せる画像。null なら無地の背景 */
  posterImage: string | null;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const start = () => {
    setStarted(true);
    // 再生できなかったとき（読み込み失敗・自動再生の制限）は、ブラウザ標準の操作部分から押してもらう
    void videoRef.current?.play()?.catch(() => {});
  };

  // 再生ボタンが消えたあとも、キーボード操作の続きが動画から始まるようにする
  useEffect(() => {
    if (started) videoRef.current?.focus();
  }, [started]);

  return (
    <PortfolioProcessVideoFrame
      shape={shape}
      posterImage={started ? null : posterImage}
      overlay={started ? null : <PortfolioProcessVideoPlayButton onClick={start} />}
    >
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        preload="none"
        aria-label="制作過程の動画"
        // 押すまでは見せない（動画の要素が出す暗い背景ではなく、枠のグラデーションや再生前の画像を見せる）
        className={`h-full w-full object-contain ${started ? "" : "invisible"}`}
      >
        お使いのブラウザでは動画を再生できません。
      </video>
    </PortfolioProcessVideoFrame>
  );
}

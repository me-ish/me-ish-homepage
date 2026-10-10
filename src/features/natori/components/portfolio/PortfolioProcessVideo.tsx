// features/natori/components/portfolio/PortfolioProcessVideo.tsx
// 制作過程の動画（タイムラプス）。ご依頼実績のすぐ下に置く。動画が未設定、またはURLを動画として読めないときは何も出さない。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { resolveProcessVideoView, youtubeWatchUrl } from "@/features/natori/lib/portfolioProcessVideo";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import PortfolioProcessVideoPlayer from "./PortfolioProcessVideoPlayer";

export default function PortfolioProcessVideo({ content }: { content: PortfolioContent }) {
  const view = resolveProcessVideoView(content);
  if (!view) return null;

  return (
    <section id="process" className="mx-auto max-w-3xl px-5 pb-6 md:pb-4">
      <h2 className="text-center text-2xl font-black md:text-3xl">制作過程</h2>
      {/* 本文の既定が大きいので、スマホは 15px に下げる（PC は既定のまま） */}
      <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed md:text-base" style={{ color: c.textSoft }}>
        {view.caption}
      </p>
      <div className="mt-6 md:mt-8">
        {/* RSC ペイロードに載せるのは再生に要る最小限だけ（掲載内容の全体は渡さない） */}
        <PortfolioProcessVideoPlayer
          key={view.videoId}
          videoId={view.videoId}
          shape={view.shape}
          posterImage={view.posterImage}
        />
      </div>
      <p className="mt-3 text-center text-[13px] leading-relaxed" style={{ color: c.textSoft }}>
        再生するとYouTubeに接続します。
        <a
          href={youtubeWatchUrl(view.videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="pf-cute-focus ml-2 font-bold underline underline-offset-4"
        >
          YouTubeで開く
        </a>
      </p>
    </section>
  );
}

"use client";

// features/natori/components/portfolio/PortfolioProcessVideoPlayButton.tsx
// 制作過程の動画の再生ボタン。YouTube でも動画ファイルでも、同じ見た目・同じ名前にそろえる。
import { Play } from "lucide-react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export default function PortfolioProcessVideoPlayButton({ onClick }: { onClick: () => void }) {
  return (
    // 枠の外に出る焦点リングが切れないよう、ボタンは角丸でクリップする枠の外に重ねる
    <button
      type="button"
      onClick={onClick}
      aria-label="制作過程の動画を再生する"
      className="pf-cute-focus group absolute inset-0 grid place-items-center rounded-2xl"
    >
      <span
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-full border-2 transition-transform group-hover:scale-105 motion-reduce:transition-none md:h-20 md:w-20"
        style={{ background: c.surface, borderColor: c.sketchLine }}
      >
        <Play
          className="h-7 w-7 translate-x-0.5 md:h-9 md:w-9"
          style={{ color: c.actionTextSmall }}
          fill="currentColor"
        />
      </span>
    </button>
  );
}

// features/natori/components/portfolio/PortfolioProcessVideoFrame.tsx
// 制作過程の動画の枠。YouTube でも動画ファイルでも、同じ形・角丸・影・背景・再生前の画像にそろえる。
import type { ReactNode } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioProcessVideoShape } from "@/features/natori/types/portfolio";

/** 縦長・正方形は、スマホでも画面に収まるよう幅を抑える */
const FRAME_BY_SHAPE: Record<PortfolioProcessVideoShape, { aspectRatio: string; maxWidth: string }> = {
  landscape: { aspectRatio: "16 / 9", maxWidth: "100%" },
  square: { aspectRatio: "1 / 1", maxWidth: "min(80%, 28rem)" },
  portrait: { aspectRatio: "9 / 16", maxWidth: "min(64%, 18rem)" },
};

export default function PortfolioProcessVideoFrame({
  shape,
  posterImage,
  overlay,
  children,
}: {
  shape: PortfolioProcessVideoShape;
  /** 再生前に見せる画像。null なら出さない（再生が始まったら null にして外す）。無地のときは背景のグラデーションが見える */
  posterImage?: string | null;
  /** 枠の外側に重ねるもの（再生ボタン）。角丸で切り抜かないので、焦点リングが切れない */
  overlay?: ReactNode;
  /** 角丸で切り抜く内側（プレイヤー・動画） */
  children?: ReactNode;
}) {
  return (
    <div className="relative mx-auto" style={FRAME_BY_SHAPE[shape]}>
      <div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${c.actionSoft}, ${c.accentSoft})`,
          boxShadow: `0 10px 22px ${c.shadowSoft}`,
        }}
      >
        {children}
        {posterImage ? (
          // アップロード画像は公開Storage URLなので next/image のhost設定に依存させない
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterImage} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
      </div>
      {overlay}
    </div>
  );
}

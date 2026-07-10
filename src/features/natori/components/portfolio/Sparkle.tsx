// features/natori/components/portfolio/Sparkle.tsx
// ヒーローの装飾用きらきらSVG
import type { CSSProperties } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

type Props = {
  style?: CSSProperties;
  color?: string;
  size?: number;
};

export default function Sparkle({ style, color = c.yellow, size = 22 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ position: "absolute", ...style }}
      aria-hidden="true"
    >
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill={color} />
    </svg>
  );
}

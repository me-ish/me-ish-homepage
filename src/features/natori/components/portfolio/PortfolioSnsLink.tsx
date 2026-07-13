"use client";

// features/natori/components/portfolio/PortfolioSnsLink.tsx
// クリック計測付きの外部SNSリンク。サーバーコンポーネント
// （PortfolioAbout など）から onClick 計測を使うための小さな client 部品。
import type { CSSProperties, ReactNode } from "react";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";

export default function PortfolioSnsLink({
  href,
  label,
  className,
  style,
  children,
}: {
  href: string;
  /** 計測ラベル（例: X / つなぐ） */
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackNatoriPageEvent("portfolio_sns_click", label)}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}

"use client";

import type { CSSProperties } from "react";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";

export default function PortfolioHeroPrimaryCta({
  className,
  style,
  href = "/natori/portfolio/contact",
}: {
  className: string;
  style: CSSProperties;
  href?: string;
}) {
  return (
    <a
      href={href}
      onClick={() => trackNatoriPageEvent("portfolio_primary_cta_click", "hero")}
      className={className}
      style={style}
    >
      相談・見積もり
    </a>
  );
}

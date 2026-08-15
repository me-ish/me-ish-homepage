"use client";

import type { CSSProperties } from "react";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";

export default function PortfolioHeroPrimaryCta({
  className,
  style,
}: {
  className: string;
  style: CSSProperties;
}) {
  return (
    <a
      href="#form"
      onClick={() => trackNatoriPageEvent("portfolio_primary_cta_click", "hero")}
      className={className}
      style={style}
    >
      相談・見積もり
    </a>
  );
}

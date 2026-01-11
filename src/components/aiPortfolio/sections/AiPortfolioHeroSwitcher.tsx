"use client";

// src/components/aiPortfolio/sections/AiPortfolioHeroSwitcher.tsx
// Hero 切り替えスイッチャー（worldview + heroLayout対応）
//
// いまは全 worldviews を「スクショ型 1スクリーンHero」に統一。
// 世界観差分はHero内の装飾と theme/variant で表現する。
// 将来 worldview ごとに差し替えたくなったら HERO_BY_WORLDVIEW を分岐。

import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import type { HeroProps } from "./hero/HeroTypes";
import { AiPortfolioHeroMinimal } from "./hero/AiPortfolioHeroMinimal";

const HERO_BY_WORLDVIEW: Record<string, React.FC<HeroProps>> = {
  minimal: AiPortfolioHeroMinimal,
  modern: AiPortfolioHeroMinimal,
  business: AiPortfolioHeroMinimal,
  cute: AiPortfolioHeroMinimal,
  pop: AiPortfolioHeroMinimal,
  dark: AiPortfolioHeroMinimal,
  cyber: AiPortfolioHeroMinimal,
  natural: AiPortfolioHeroMinimal,
  luxury: AiPortfolioHeroMinimal,
  retro: AiPortfolioHeroMinimal,
};

type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
  /** LayoutDecision.layoutType（AIのレイアウト指示） */
  layoutType?: string;
  /** Hero layout hint: centerBasic / splitHero / galleryFocus / stacked */
  heroLayout?: string;
};

export const AiPortfolioHeroSwitcher: React.FC<Props> = ({
  section,
  theme,
  variant,
  layoutType,
  heroLayout,
}) => {
  const worldviewKey = (variant.worldview as string) || "minimal";
  const HeroComp = HERO_BY_WORLDVIEW[worldviewKey] ?? AiPortfolioHeroMinimal;

  return (
    <HeroComp
      section={section}
      theme={theme}
      variant={variant}
      layoutType={layoutType}
      heroLayout={heroLayout}
    />
  );
};

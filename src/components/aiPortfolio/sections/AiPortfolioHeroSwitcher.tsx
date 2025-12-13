// src/components/aiPortfolio/sections/AiPortfolioHeroSwitcher.tsx
// Hero 切り替えスイッチャー（worldview + heroLayout対応拡張版）

import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import type { HeroProps } from "./hero/HeroTypes";
import { AiPortfolioHeroMinimal } from "./hero/AiPortfolioHeroMinimal";

// 将来：worldviewごとに別Heroを登録できるようにする前提
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

  // worldview で Hero コンポーネントを切り替え
  const HeroComp = HERO_BY_WORLDVIEW[worldviewKey] ?? AiPortfolioHeroMinimal;

  // Hero に layoutType / heroLayout をそのまま渡す
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

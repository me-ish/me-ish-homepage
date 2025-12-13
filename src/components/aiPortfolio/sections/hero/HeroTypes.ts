// src/components/aiPortfolio/sections/hero/HeroTypes.ts
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";
import type { HeroLayoutHint } from "@/lib/aiPortfolio/aiPortfolio.layout";

export type HeroProps = {
  /** type: "hero" セクションがそのまま入る想定 */
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;

  /** LayoutDecision.layoutType など、全体レイアウトの種類（任意） */
  layoutType?: string;

  /** Heroレイアウトのヒント（centerBasic / splitHero / galleryFocus / stacked など） */
  heroLayout?: HeroLayoutHint | string;
};

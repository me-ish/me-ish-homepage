// src/components/aiPortfolio/sections/aiPortfolioContactCTA.tsx
import React from "react";
import type { Design, Content } from "@/lib/aiPortfolio/aiPortfolio.schema";
import type { VariantSpec } from "@/lib/aiPortfolio/aiPortfolio.variant.base";

// Contact に統合したため、現状は表示しないダミーコンポーネント。
// 将来「特別なキャンペーン CTA」を追加したくなったら、ここを復活させる想定。
type Props = {
  section: Content["sections"][number];
  theme: Design["theme"];
  variant: VariantSpec;
};

export const AiPortfolioContactCTA: React.FC<Props> = () => {
  return null;
};

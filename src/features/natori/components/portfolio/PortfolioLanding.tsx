// features/natori/components/portfolio/PortfolioLanding.tsx
// /natori/portfolio の全セクションを束ねるルートコンポーネント。
// 掲載内容 (content) は DB から読み込んだものが page.tsx 経由で渡ってくる。
// 既存の /natori (VGen向け) とは完全に独立したページ。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import PortfolioAbout from "./PortfolioAbout";
import PortfolioCommissionForm from "./PortfolioCommissionForm";
import PortfolioFooter from "./PortfolioFooter";
import PortfolioGallery from "./PortfolioGallery";
import PortfolioGuidelines from "./PortfolioGuidelines";
import PortfolioHeader from "./PortfolioHeader";
import PortfolioHero from "./PortfolioHero";
import PortfolioPricing from "./PortfolioPricing";
import PortfolioStyles from "./PortfolioStyles";
import { portfolioFontEn, portfolioFontJp } from "./portfolioFonts";

export default function PortfolioLanding({ content }: { content: PortfolioContent }) {
  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} min-h-screen`}
      style={{ background: c.paper, color: c.ink }}
    >
      <PortfolioStyles />
      <PortfolioHeader content={content} />
      <PortfolioHero content={content} />
      <PortfolioGallery content={content} />
      <PortfolioAbout content={content} />
      <PortfolioPricing content={content} />
      <PortfolioGuidelines content={content} />
      <PortfolioCommissionForm content={content} />
      <PortfolioFooter content={content} />
    </main>
  );
}

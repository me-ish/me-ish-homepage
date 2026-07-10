// features/natori/components/portfolio/PortfolioLanding.tsx
// /natori/portfolio の全セクションを束ねるルートコンポーネント。
// 既存の /natori (VGen向け) とは完全に独立したページ。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
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

export default function PortfolioLanding() {
  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} min-h-screen`}
      style={{ background: c.paper, color: c.ink }}
    >
      <PortfolioStyles />
      <PortfolioHeader />
      <PortfolioHero />
      <PortfolioGallery />
      <PortfolioAbout />
      <PortfolioPricing />
      <PortfolioGuidelines />
      <PortfolioCommissionForm />
      <PortfolioFooter />
    </main>
  );
}

// features/natori/components/portfolio/PortfolioLanding.tsx
// /natori/portfolio の全セクションを束ねるルートコンポーネント。
// 掲載内容 (content) は DB から読み込んだものが page.tsx 経由で渡ってくる。
// 既存の /natori (VGen向け) とは完全に独立したページ。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
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

export default function PortfolioLanding({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  const showcase = variant === "showcase";
  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} min-h-screen`}
      style={{ background: c.paper, color: c.ink }}
    >
      <PortfolioStyles />
      <PortfolioHeader content={content} variant={variant} />
      <PortfolioHero content={content} variant={variant} />
      <PortfolioGallery works={content.works} />
      <PortfolioAbout content={content} variant={variant} />
      {showcase ? null : (
        <>
          <PortfolioPricing content={content} />
          <PortfolioGuidelines content={content} />
          <PortfolioCommissionForm content={content} />
        </>
      )}
      <PortfolioFooter content={content} variant={variant} />
    </main>
  );
}

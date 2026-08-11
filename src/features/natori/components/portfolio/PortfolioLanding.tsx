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
import PortfolioMobileCta from "./PortfolioMobileCta";
import PortfolioPricing from "./PortfolioPricing";
import PortfolioStyles from "./PortfolioStyles";
import PortfolioWorkflow from "./PortfolioWorkflow";
import { portfolioFontEn, portfolioFontJp } from "./portfolioFonts";

export default function PortfolioLanding({
  content,
  variant = "full",
  demoContact,
  flatPlaceholders,
  structuredIntake,
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
  /** エトリエのデモ環境用。依頼フォームの送信をシミュレーションにする */
  demoContact?: boolean;
  /** 画像なしのプレースホルダーをキャラSVGではなくベタ塗りにする（デモ用） */
  flatPlaceholders?: boolean;
  /** P1-06 構造化受付の rollout guard。server component から渡す */
  structuredIntake?: boolean;
}) {
  const showcase = variant === "showcase";
  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} pf-portfolio-root min-h-screen`}
      style={{ background: c.page, color: c.text }}
    >
      <PortfolioStyles />
      <PortfolioHeader content={content} variant={variant} />
      <PortfolioHero content={content} variant={variant} />
      <PortfolioGallery works={content.works} flatPlaceholders={flatPlaceholders} />
      {showcase ? (
        <PortfolioAbout content={content} variant={variant} flatPlaceholders={flatPlaceholders} />
      ) : (
        <>
          <PortfolioPricing content={content} />
          <PortfolioWorkflow content={content} />
          <PortfolioAbout content={content} variant={variant} flatPlaceholders={flatPlaceholders} />
          <PortfolioGuidelines content={content} />
          <PortfolioCommissionForm
            content={content}
            demoMode={demoContact}
            structuredIntake={structuredIntake}
          />
          {content.commissionOpen ? <PortfolioMobileCta /> : null}
        </>
      )}
      <PortfolioFooter content={content} variant={variant} />
    </main>
  );
}

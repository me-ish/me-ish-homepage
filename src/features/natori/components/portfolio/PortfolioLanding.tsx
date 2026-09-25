// features/natori/components/portfolio/PortfolioLanding.tsx
// /natori/portfolio の全セクションを束ねるルートコンポーネント。
// 掲載内容 (content) は DB から読み込んだものが page.tsx 経由で渡ってくる。
// 既存の /natori (VGen向け) とは完全に独立したページ。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import PortfolioAbout from "./PortfolioAbout";
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
  const contactPath = demoContact ? "/etorie/demo/app/portfolio/contact" : "/natori/portfolio/contact";
  const demoStructuredQuery = demoContact && structuredIntake ? "&structured=1" : "";
  const directContactPath = `${contactPath}${demoStructuredQuery ? "?structured=1" : ""}`;
  // /natori/works は外部プラットフォーム提出用。関連URLを描画しないだけでなく、
  // Client Component のRSCペイロードにもURL値を載せない。
  const galleryWorks = showcase
    ? content.works.map((work) => ({ ...work, relatedLinks: undefined }))
    : content.works;

  return (
    <main
      className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} pf-portfolio-root min-h-screen`}
      style={{ background: c.page, color: c.text }}
    >
      <PortfolioStyles />
      <PortfolioHeader content={content} variant={variant} contactPath={directContactPath} />
      <PortfolioHero content={content} variant={variant} contactPath={directContactPath} />
      <PortfolioGallery
        works={galleryWorks}
        collections={content.collections}
        variant={variant}
        flatPlaceholders={flatPlaceholders}
      />
      {showcase ? (
        <PortfolioAbout content={content} variant={variant} flatPlaceholders={flatPlaceholders} />
      ) : (
        <>
          <PortfolioPricing content={content} contactPath={contactPath} structuredIntake={Boolean(demoStructuredQuery)} />
          <PortfolioWorkflow content={content} />
          <PortfolioAbout content={content} variant={variant} flatPlaceholders={flatPlaceholders} />
          <PortfolioGuidelines content={content} />
          <section id="form" className="mx-auto max-w-3xl px-5 py-14 text-center md:py-20">
            <h2 className="text-2xl font-black md:text-3xl">ご相談・ご依頼</h2>
            <p className="mt-3 leading-relaxed" style={{ color: c.textSoft }}>
              {content.commissionOpen ? "イメージが決まっていなくても大丈夫。まずは気軽にお話を聞かせてください。" : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
            </p>
            {content.commissionOpen && <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a href={`${contactPath}?mode=consultation${demoStructuredQuery}`} className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-full border-2 px-6 py-2 font-bold" style={{ borderColor: c.actionDisplay, background: c.action, color: c.onAction }}>まず相談したい</a>
              <a href={`${contactPath}?mode=quote${demoStructuredQuery}`} className="pf-cute-focus inline-flex min-h-12 items-center justify-center rounded-full border-2 px-6 py-2 font-bold" style={{ borderColor: c.borderStrong, background: c.surface, color: c.text }}>見積もりをお願いしたい</a>
            </div>}
          </section>
          {content.commissionOpen ? <PortfolioMobileCta href={directContactPath} /> : null}
        </>
      )}
      <PortfolioFooter content={content} variant={variant} />
    </main>
  );
}

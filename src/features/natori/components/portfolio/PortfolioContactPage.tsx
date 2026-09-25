import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { planChoiceLabel } from "@/features/natori/constants/portfolioContent";
import { NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE } from "@/features/natori/lib/portfolioRequestForm";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import PortfolioCommissionForm from "./PortfolioCommissionForm";
import PortfolioStyles from "./PortfolioStyles";
import { portfolioFontEn, portfolioFontJp } from "./portfolioFonts";

export default function PortfolioContactPage({ content, mode, plan, planLabel, structuredIntake, demoMode, backHref = "/natori/portfolio" }: {
  content: PortfolioContent;
  mode?: string;
  plan?: string;
  planLabel?: string;
  structuredIntake?: boolean;
  demoMode?: boolean;
  backHref?: string;
}) {
  const initialPlan = plan === NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE || content.plans.some((item) => item.id === plan) ? plan : undefined;
  const legacyPlan = content.plans.find((item) => item.id === null && planChoiceLabel(item) === planLabel);
  return <main className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} pf-portfolio-root min-h-screen pb-[env(safe-area-inset-bottom)]`} style={{ background: c.page, color: c.text }}>
    <PortfolioStyles />
    <header className="border-b px-5 py-4" style={{ borderColor: c.borderSubtle }}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <a className="pf-cute-focus inline-flex min-h-11 items-center text-sm font-bold" href={backHref}>← 作品と料金に戻る</a>
        <span className="text-sm font-bold"><span style={{ color: c.text }}>ナトリの</span><span style={{ color: c.actionText }}>あとりえ</span></span>
      </div>
    </header>
    <div className="mx-auto max-w-2xl px-5 pt-8 text-center md:pt-12">
      <h1 className="text-2xl font-black md:text-3xl">ご相談・ご依頼</h1>
    </div>
    <PortfolioCommissionForm content={content} demoMode={demoMode} structuredIntake={structuredIntake} hideHeading initialMode={mode === "quote" || initialPlan || legacyPlan ? "quote" : "consultation"} initialPlan={initialPlan} initialPlanLabel={legacyPlan ? planChoiceLabel(legacyPlan) : undefined} fromPlan={Boolean(initialPlan || legacyPlan)} opening={1} />
  </main>;
}

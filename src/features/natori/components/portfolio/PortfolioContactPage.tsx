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
        <span className="text-sm font-bold" style={{ color: c.accentDisplay }}>ナトリのあとりえ</span>
      </div>
    </header>
    <div className="mx-auto max-w-2xl px-5 pt-8 text-center md:pt-12">
      <p className="text-sm font-bold" style={{ color: c.accentDisplay }}>CONTACT</p>
      <h1 className="mt-2 text-3xl font-black">ご相談・ご依頼</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: c.textSoft }}>イメージが決まっていなくても大丈夫です。入力は途中で戻って修正できます。</p>
    </div>
    <PortfolioCommissionForm content={content} demoMode={demoMode} structuredIntake={structuredIntake} initialMode={mode === "quote" || initialPlan || legacyPlan ? "quote" : "consultation"} initialPlan={initialPlan} initialPlanLabel={legacyPlan ? planChoiceLabel(legacyPlan) : undefined} fromPlan={Boolean(initialPlan || legacyPlan)} opening={1} />
  </main>;
}

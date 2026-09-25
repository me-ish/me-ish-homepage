import type { Metadata } from "next";
import PortfolioContactPage from "@/features/natori/components/portfolio/PortfolioContactPage";
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ご相談・ご依頼 | ナトリのあとりえ", robots: { index: false, follow: true } };

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; plan?: string; planLabel?: string }> }) {
  const [content, params] = await Promise.all([loadPortfolioContent(), searchParams]);
  return <PortfolioContactPage content={content} mode={params.mode} plan={params.plan} planLabel={params.planLabel} structuredIntake={isPublicStructuredIntakeEnabled()} />;
}

import PortfolioContactPage from "@/features/natori/components/portfolio/PortfolioContactPage";
import { demoPortfolioContent } from "@/features/etorie/lib/demoWorkspace";

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; plan?: string; structured?: string }> }) {
  const params = await searchParams;
  return <PortfolioContactPage content={demoPortfolioContent} mode={params.mode} plan={params.plan} structuredIntake={params.structured === "1"} demoMode backHref="/etorie/demo/app/portfolio" />;
}

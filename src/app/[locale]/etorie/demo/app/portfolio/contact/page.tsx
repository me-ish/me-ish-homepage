import PortfolioContactPage from "@/features/natori/components/portfolio/PortfolioContactPage";
import { demoPortfolioContent } from "@/features/etorie/lib/demoWorkspace";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";

export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string; plan?: string; planLabel?: string; structured?: string }> }) {
  const params = await searchParams;
  return <DemoAppShell bare><PortfolioContactPage content={demoPortfolioContent} mode={params.mode} plan={params.plan} planLabel={params.planLabel} structuredIntake={params.structured === "1"} demoMode backHref="/etorie/demo/app/portfolio" /></DemoAppShell>;
}

// app/etorie/demo/app/portfolio/page.tsx
// デモ環境: 公開ポートフォリオ（ユキノ版）。依頼フォームは送信シミュレーション。
import type { Metadata } from "next";
import PortfolioLanding from "@/features/natori/components/portfolio/PortfolioLanding";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { demoPortfolioContent } from "@/features/etorie/lib/demoWorkspace";

export const metadata: Metadata = {
  title: "エトリエ デモ | 公開ポートフォリオ",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ structured?: string }>;
}) {
  const params = await searchParams;

  return (
    <DemoAppShell bare>
      <PortfolioLanding
        content={demoPortfolioContent}
        demoContact
        flatPlaceholders
        structuredIntake={params?.structured === "1"}
      />
    </DemoAppShell>
  );
}

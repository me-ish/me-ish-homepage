// app/etorie/demo/app/portfolio/edit/page.tsx
// デモ環境: ポートフォリオ編集（実画面。保存はシミュレーション）。
import type { Metadata } from "next";
import PortfolioEditor from "@/features/natori/components/portfolio/edit/PortfolioEditor";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { demoPortfolioContent } from "@/features/etorie/lib/demoWorkspace";

export const metadata: Metadata = {
  title: "エトリエ デモ | ポートフォリオ編集",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell bare>
      <PortfolioEditor
        demoContent={demoPortfolioContent}
        publicHref="/etorie/demo/app/portfolio"
      />
    </DemoAppShell>
  );
}

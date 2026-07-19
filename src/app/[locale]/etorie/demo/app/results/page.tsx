// app/etorie/demo/app/results/page.tsx
// デモ環境: 売上・実績（実画面 + サンプルデータ）。
import type { Metadata } from "next";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { DemoResults } from "@/features/etorie/components/demoapp/DemoBoards";

export const metadata: Metadata = {
  title: "エトリエ デモ | 売上・実績",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell crumb="RESULTS" title="これまでの実績">
      <DemoResults />
    </DemoAppShell>
  );
}

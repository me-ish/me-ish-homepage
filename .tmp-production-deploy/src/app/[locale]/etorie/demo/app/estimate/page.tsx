// app/etorie/demo/app/estimate/page.tsx
// デモ環境: 見積もりツール（実画面。計算・メール下書きはすべて動く）。
import type { Metadata } from "next";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { DemoEstimate } from "@/features/etorie/components/demoapp/DemoBoards";

export const metadata: Metadata = {
  title: "エトリエ デモ | 見積もりツール",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell crumb="ESTIMATE" title="見積もりツール">
      <DemoEstimate />
    </DemoAppShell>
  );
}

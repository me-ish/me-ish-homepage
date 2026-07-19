// app/etorie/demo/app/page.tsx
// エトリエのさわれるデモ環境: ダッシュボード（各画面への入口）。
import type { Metadata } from "next";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import DemoDashboard from "@/features/etorie/components/demoapp/DemoDashboard";

export const metadata: Metadata = {
  title: "エトリエ デモ | ダッシュボード",
  description: "サンプルデータで実際の管理画面を操作できるエトリエのデモ環境。",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell>
      <DemoDashboard />
    </DemoAppShell>
  );
}

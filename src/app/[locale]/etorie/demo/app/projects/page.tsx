// app/etorie/demo/app/projects/page.tsx
// デモ環境: 案件カレンダー（実画面 + サンプルデータ）。
import type { Metadata } from "next";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { DemoProjects } from "@/features/etorie/components/demoapp/DemoBoards";

export const metadata: Metadata = {
  title: "エトリエ デモ | 案件カレンダー",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell crumb="PROJECTS" title="案件カレンダー">
      <DemoProjects />
    </DemoAppShell>
  );
}

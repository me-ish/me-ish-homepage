// app/etorie/demo/app/links/edit/page.tsx
// デモ環境: リンク集編集（実画面。保存はシミュレーション）。
import type { Metadata } from "next";
import LinksEditor from "@/features/natori/components/links/LinksEditor";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { demoLinksContent } from "@/features/etorie/lib/demoWorkspace";

export const metadata: Metadata = {
  title: "エトリエ デモ | リンク集編集",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell bare>
      <LinksEditor demoContent={demoLinksContent} publicHref="/etorie/demo/app/links" />
    </DemoAppShell>
  );
}

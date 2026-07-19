// app/etorie/demo/app/links/page.tsx
// デモ環境: 公開リンク集（ユキノ版）。リンク先はすべてダミー。
import type { Metadata } from "next";
import LinksLanding from "@/features/natori/components/links/LinksLanding";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { demoLinksContent } from "@/features/etorie/lib/demoWorkspace";

export const metadata: Metadata = {
  title: "エトリエ デモ | リンク集",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell bare>
      <LinksLanding links={demoLinksContent.links} />
    </DemoAppShell>
  );
}

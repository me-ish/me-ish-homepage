// app/etorie/demo/app/inquiries/page.tsx
// デモ環境: 問い合わせ管理（実画面 + サンプルデータ）。
import type { Metadata } from "next";
import DemoAppShell from "@/features/etorie/components/demoapp/DemoAppShell";
import { DemoInquiries } from "@/features/etorie/components/demoapp/DemoBoards";

export const metadata: Metadata = {
  title: "エトリエ デモ | 問い合わせ管理",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <DemoAppShell crumb="INQUIRIES" title="問い合わせ管理">
      <DemoInquiries />
    </DemoAppShell>
  );
}

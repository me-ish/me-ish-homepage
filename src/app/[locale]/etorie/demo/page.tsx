// app/etorie/demo/page.tsx
// エトリエのガイド付きデモ。架空クリエイター「ユキノ」の一日を6シーンで追う。
// 実DB・実API・実メールには一切触れない完全モック（read-only）。
import type { Metadata } from "next";
import EtorieDemo from "@/features/etorie/components/EtorieDemo";

const title = "エトリエ デモ — 依頼から納品まで、ユキノの一日";
const description =
  "架空のイラストレーター「ユキノ」の一日で見る、エトリエの受注管理。依頼受付 → 見積もり → 承諾 → 入金 → 制作 → 実績までを3分で。";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title, description },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  return <EtorieDemo />;
}

// app/natori/portfolio/edit/page.tsx
// /natori/portfolio の掲載内容をブラウザから編集する管理画面。
import type { Metadata } from "next";
import PortfolioEditor from "@/features/natori/components/portfolio/edit/PortfolioEditor";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ポートフォリオ編集 – Natori",
  robots: { index: false },
};

export default async function Page() {
  await requireNatoriAccess("/natori/portfolio/edit");
  return <PortfolioEditor />;
}

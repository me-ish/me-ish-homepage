import type { Metadata } from "next";
import PortfolioPreviewClient from "@/features/natori/components/portfolio/edit/PortfolioPreviewClient";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio Preview | me-ish",
  description: "ポートフォリオ編集内容の保存前プレビュー（関係者向け）。",
  robots: { index: false, follow: false },
};

export default async function NatoriPortfolioPreviewPage() {
  await requireNatoriAccess("/natori/portfolio/edit/preview");
  return <PortfolioPreviewClient />;
}

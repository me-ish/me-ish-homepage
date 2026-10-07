import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import LinksEditor from "@/features/natori/components/links/LinksEditor";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Links Editor | me-ish",
  description: "リンク集（/natori/links）の掲載リンクをブラウザから編集する関係者向けページです。",
  robots: { index: false, follow: false },
};

export default async function NatoriLinksEditPage() {
  await requireNatoriAccess("/natori/links/edit");
  return <LinksEditor dashboardHref="/natori/dashboard" />;
}

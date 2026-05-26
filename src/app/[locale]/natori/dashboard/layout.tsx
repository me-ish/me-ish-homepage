import type { Metadata } from "next";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

// Override the site-wide manifest so that "Add to Home Screen" from the
// Natori dashboard lands back on the dashboard (and not the site root).
export const metadata: Metadata = {
  title: "Natori Dashboard | me-ish",
  description: "ナトリの仕事用ダッシュボード。案件管理・見積もり・ポートフォリオ・リンク集の入口。",
  manifest: "/natori-dashboard.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Natori",
    statusBarStyle: "default",
    startupImage: ["/icons/icon-512x512.png"],
  },
};

export default async function NatoriDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNatoriAccess("/natori/dashboard");

  return <>{children}</>;
}

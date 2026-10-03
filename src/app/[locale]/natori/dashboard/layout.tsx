import type { Metadata } from "next";
import Link from "next/link";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { notificationVerificationAvailable } from "@/features/natori/server/notificationVerification";

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

  return <>
    {notificationVerificationAvailable() && <aside className={`${natoriAdminUi.container} pt-4`}>
      <Link href="/natori/dashboard/notification-check" className={natoriAdminUi.btnSecondary}>メール通知の確認（テスト）</Link>
    </aside>}
    {children}
  </>;
}

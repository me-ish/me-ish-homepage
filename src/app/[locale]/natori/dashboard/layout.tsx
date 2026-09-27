import type { Metadata } from "next";
import Link from "next/link";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";
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
    {notificationVerificationAvailable() && <aside className="mx-auto max-w-3xl px-4 pt-4 text-sm">
      <Link href="/natori/dashboard/notification-check" className="inline-block rounded-lg border border-pink-300 bg-pink-50 px-4 py-3 underline">メール通知の確認（テスト）</Link>
    </aside>}
    {children}
  </>;
}

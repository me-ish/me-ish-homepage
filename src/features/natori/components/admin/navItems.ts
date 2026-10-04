import { BarChart3, CalendarDays, Calculator, Inbox, LayoutDashboard, type LucideIcon } from "lucide-react";

export type NatoriAdminSection = "dashboard" | "inquiries" | "projects" | "estimate" | "results";

/** Icons shared by the header nav and the mobile tab bar. */
export const NATORI_ADMIN_NAV_ICONS: Record<NatoriAdminSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  inquiries: Inbox,
  projects: CalendarDays,
  estimate: Calculator,
  results: BarChart3,
};

export const NATORI_ADMIN_NAV: ReadonlyArray<{
  key: NatoriAdminSection;
  label: string;
  href: string;
}> = [
  { key: "dashboard", label: "ダッシュボード", href: "/natori/dashboard" },
  { key: "inquiries", label: "問い合わせ", href: "/natori/inquiries" },
  { key: "projects", label: "案件", href: "/natori/projects" },
  { key: "estimate", label: "見積もり", href: "/natori/estimate" },
  { key: "results", label: "実績", href: "/natori/results" },
];

export const NATORI_PUBLIC_PAGE_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "ポートフォリオを見る", href: "/natori/portfolio" },
  { label: "ポートフォリオを編集", href: "/natori/portfolio/edit" },
  { label: "リンク集を見る", href: "/natori/links" },
  { label: "リンク集を編集", href: "/natori/links/edit" },
];

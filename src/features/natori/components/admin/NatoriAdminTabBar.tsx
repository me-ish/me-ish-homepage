import Link from "next/link";
import { BarChart3, CalendarDays, Calculator, Inbox, LayoutDashboard, type LucideIcon } from "lucide-react";
import { NATORI_ADMIN_NAV, type NatoriAdminSection } from "./navItems";

const ICONS: Record<NatoriAdminSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  inquiries: Inbox,
  projects: CalendarDays,
  estimate: Calculator,
  results: BarChart3,
};

type NatoriAdminTabBarProps = { current: NatoriAdminSection };

/** Mobile-only bottom tabs. Not used on the editor screens (they have their own save bar). */
export function NatoriAdminTabBar({ current }: NatoriAdminTabBarProps) {
  return (
    <nav
      aria-label="管理メニュー（下部）"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NATORI_ADMIN_NAV.map((item) => {
          const Icon = ICONS[item.key];
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] ${
                  active ? "text-[#BE185D]" : "text-gray-600"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

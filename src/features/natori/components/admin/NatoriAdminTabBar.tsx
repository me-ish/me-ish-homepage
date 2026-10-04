import Link from "next/link";
import { NATORI_ADMIN_NAV, NATORI_ADMIN_NAV_ICONS, type NatoriAdminSection } from "./navItems";

type NatoriAdminTabBarProps = { current: NatoriAdminSection };

/** Mobile-only bottom tabs. Not used on the editor screens (they have their own save bar). */
export function NatoriAdminTabBar({ current }: NatoriAdminTabBarProps) {
  return (
    <nav
      aria-label="管理メニュー（下部）"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="grid grid-cols-5 px-1">
        {NATORI_ADMIN_NAV.map((item) => {
          const Icon = NATORI_ADMIN_NAV_ICONS[item.key];
          const active = item.key === current;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl text-[11px] tracking-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] ${
                  active ? "font-semibold text-[#BE185D]" : "font-medium text-zinc-600"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    active ? "bg-pink-100/80 text-[#BE185D]" : "text-zinc-500"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

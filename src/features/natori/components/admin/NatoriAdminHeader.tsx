import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NATORI_ADMIN_NAV, NATORI_PUBLIC_PAGE_LINKS, type NatoriAdminSection } from "./navItems";

type NatoriAdminHeaderProps = {
  current: NatoriAdminSection;
  /** Right-end slot (e.g. login state on the dashboard). */
  right?: React.ReactNode;
};

export function NatoriAdminHeader({ current, right }: NatoriAdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/natori/dashboard"
          className="shrink-0 text-sm font-black text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]"
        >
          Natori 管理
        </Link>
        <nav aria-label="管理メニュー" className="hidden h-full items-stretch gap-1 md:flex">
          {NATORI_ADMIN_NAV.map((item) => {
            const active = item.key === current;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center border-b-2 px-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] ${
                  active
                    ? "border-[#BE185D] text-[#BE185D]"
                    : "border-transparent text-gray-700 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <details className="group relative flex items-stretch">
            <summary className="flex cursor-pointer list-none items-center gap-1 px-3 text-sm font-bold text-gray-700 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#831843] [&::-webkit-details-marker]:hidden">
              公開ページ
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              {NATORI_PUBLIC_PAGE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#831843]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </nav>
        {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

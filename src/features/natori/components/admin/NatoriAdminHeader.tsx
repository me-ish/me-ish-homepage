import Link from "next/link";
import { ChevronDown, ExternalLink, PenLine } from "lucide-react";
import {
  NATORI_ADMIN_NAV,
  NATORI_ADMIN_NAV_ICONS,
  NATORI_PUBLIC_PAGE_LINKS,
  type NatoriAdminSection,
} from "./navItems";

type NatoriAdminHeaderProps = {
  current: NatoriAdminSection;
  /** Right-end slot (e.g. login state on the dashboard). */
  right?: React.ReactNode;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]";

export function NatoriAdminHeader({ current, right }: NatoriAdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <Link
          href="/natori/dashboard"
          className={`flex shrink-0 items-center gap-2.5 rounded-lg ${focusRing}`}
        >
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#F472B6] via-[#EC4899] to-[#BE185D] text-[15px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(190,24,93,0.55)] ring-1 ring-inset ring-white/25"
          >
            N
          </span>
          <span className="text-[15px] font-bold tracking-tight text-zinc-900">Natori 管理</span>
        </Link>
        <nav aria-label="管理メニュー" className="hidden h-full items-center gap-0.5 lg:flex">
          {NATORI_ADMIN_NAV.map((item) => {
            const active = item.key === current;
            const Icon = NATORI_ADMIN_NAV_ICONS[item.key];
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors ${focusRing} ${
                  active
                    ? "font-semibold text-zinc-900"
                    : "font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? "text-[#EC4899]" : "text-zinc-400"}`}
                  aria-hidden
                />
                {item.label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-[10px] h-[2px] rounded-full bg-[#EC4899]"
                  />
                ) : null}
              </Link>
            );
          })}
          <details className="group relative">
            <summary
              className={`flex h-9 cursor-pointer list-none items-center gap-1 rounded-full px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 group-open:bg-zinc-100 group-open:text-zinc-900 ${focusRing} [&::-webkit-details-marker]:hidden`}
            >
              公開ページ
              <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(24,24,27,0.25)]">
              {NATORI_PUBLIC_PAGE_LINKS.map((link) => {
                const LinkIcon = link.href.endsWith("/edit") ? PenLine : ExternalLink;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-zinc-800 transition-colors hover:bg-zinc-100 ${focusRing}`}
                    >
                      <LinkIcon className="h-4 w-4 text-zinc-400" aria-hidden />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </nav>
        {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}

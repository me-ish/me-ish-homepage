"use client";

// features/natori/components/portfolio/PortfolioMobileNav.tsx
import type { FocusEvent } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

type MobileNavLink = Readonly<{
  href: string;
  label: string;
}>;

function keepFocusedItemVisible(event: FocusEvent<HTMLAnchorElement>) {
  event.currentTarget.scrollIntoView({ block: "nearest", inline: "center" });
}

export default function PortfolioMobileNav({
  links,
}: {
  links: readonly MobileNavLink[];
}) {
  return (
    <nav
      aria-label="メインナビゲーション（モバイル）"
      className="flex scroll-px-5 gap-4 overflow-x-auto px-5 pb-2.5 text-sm font-medium md:hidden"
      style={{ color: c.textSoft }}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          onFocus={keepFocusedItemVisible}
          className="pf-cute-focus flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-1 hover:opacity-70"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

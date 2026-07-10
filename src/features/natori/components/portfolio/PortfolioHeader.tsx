// features/natori/components/portfolio/PortfolioHeader.tsx
import {
  commissionOpen,
  portfolioColors as c,
  portfolioProfile,
} from "@/features/natori/constants/portfolioContent";
import { fontEnStyle } from "./portfolioFonts";

const NAV_LINKS = [
  { href: "#gallery", label: "ギャラリー" },
  { href: "#about", label: "プロフィール" },
  { href: "#pricing", label: "料金" },
  { href: "#flow", label: "制作の流れ" },
  { href: "#form", label: "ご依頼" },
];

export default function PortfolioHeader() {
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ background: "rgba(247,243,251,0.85)", borderColor: c.paperAlt }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <span
          className="text-xl font-semibold tracking-wide"
          style={{ ...fontEnStyle, color: c.pinkDeep }}
        >
          {portfolioProfile.artistName}
        </span>
        <nav className="hidden gap-6 text-sm font-medium md:flex" style={{ color: c.inkSoft }}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="pf-cute-focus hover:opacity-70">
              {link.label}
            </a>
          ))}
        </nav>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-bold"
          style={{
            background: commissionOpen ? c.mint : "#D8D3E6",
            color: commissionOpen ? "#0F4E40" : c.inkSoft,
          }}
        >
          {commissionOpen ? "● 受付中" : "受付停止中"}
        </span>
      </div>
    </header>
  );
}

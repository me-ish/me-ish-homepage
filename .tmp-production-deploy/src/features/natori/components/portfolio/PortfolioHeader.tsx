// features/natori/components/portfolio/PortfolioHeader.tsx
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import PortfolioMobileNav from "./PortfolioMobileNav";
import { fontEnStyle } from "./portfolioFonts";

const NAV_LINKS = [
  { href: "#gallery", label: "作品" },
  { href: "#pricing", label: "料金・ご依頼" },
  { href: "#flow", label: "制作の流れ" },
  { href: "#about", label: "プロフィール" },
  { href: "#form", label: "相談・見積もり" },
];

const MOBILE_NAV_LINKS = [
  { href: "#gallery", label: "作品" },
  { href: "#pricing", label: "料金" },
  { href: "#flow", label: "流れ" },
  { href: "#form", label: "相談" },
];

// showcase 表示ではページに存在しないセクション（料金・流れ・依頼）を除外
const SHOWCASE_NAV_HREFS = new Set(["#gallery", "#about"]);

export default function PortfolioHeader({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  const showcase = variant === "showcase";
  const navLinks = showcase
    ? NAV_LINKS.filter((link) => SHOWCASE_NAV_HREFS.has(link.href))
    : NAV_LINKS;
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ background: c.pageTranslucent, borderColor: c.borderSubtle }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <span
          className="min-w-0 max-w-[58vw] truncate text-xl font-semibold tracking-wide sm:max-w-none"
          style={{ ...fontEnStyle, color: c.accentDisplay }}
        >
          {content.artistName}
        </span>
        <nav
          aria-label="メインナビゲーション"
          className="hidden gap-6 text-sm font-medium md:flex"
          style={{ color: c.textSoft }}
        >
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="pf-cute-focus hover:opacity-70">
              {link.label}
            </a>
          ))}
        </nav>
        {showcase ? null : (
          <span
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              background: content.commissionOpen ? c.successSoft : c.surfaceSubtle,
              color: content.commissionOpen ? c.success : c.textSoft,
              border: `1px solid ${content.commissionOpen ? c.success : c.borderStrong}`,
            }}
          >
            {content.commissionOpen ? "● 受付中" : "受付停止中"}
          </span>
        )}
      </div>
      {/* モバイル用ナビ。md 以上は上のナビがあるので出さない */}
      <PortfolioMobileNav links={showcase ? navLinks : MOBILE_NAV_LINKS} />
    </header>
  );
}

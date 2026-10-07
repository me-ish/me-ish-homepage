// features/natori/components/portfolio/PortfolioHeader.tsx
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { portfolioBrandSubName } from "@/features/natori/lib/portfolioShare";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import PortfolioMobileNav from "./PortfolioMobileNav";
import { fontEnStyle } from "./portfolioFonts";

const CONTACT_NAV_LABEL = "相談・見積もり";

const NAV_LINKS = [
  { href: "#gallery", label: "作品" },
  { href: "#pricing", label: "料金・ご依頼" },
  { href: "#flow", label: "制作の流れ" },
  { href: "#about", label: "プロフィール" },
  { href: "/natori/portfolio/contact", label: CONTACT_NAV_LABEL },
];

const MOBILE_NAV_LINKS = [
  { href: "#gallery", label: "作品" },
  { href: "#pricing", label: "料金" },
  { href: "#flow", label: "流れ" },
  { href: "/natori/portfolio/contact", label: "相談" },
];

// showcase 表示ではページに存在しないセクション（料金・流れ・依頼）を除外
const SHOWCASE_NAV_HREFS = new Set(["#gallery", "#about"]);

export default function PortfolioHeader({
  content,
  variant = "full",
  contactPath = "/natori/portfolio/contact",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
  contactPath?: string;
}) {
  const showcase = variant === "showcase";
  const navLinks = showcase
    ? NAV_LINKS.filter((link) => SHOWCASE_NAV_HREFS.has(link.href))
    : NAV_LINKS.map((link) => link.href === "/natori/portfolio/contact" ? { ...link, href: contactPath } : link);
  const mobileLinks = showcase ? navLinks : MOBILE_NAV_LINKS.map((link) => link.href === "/natori/portfolio/contact" ? { ...link, href: contactPath } : link);
  const titleAccent = content.heroTitleAccent.trim();
  const titleTail = content.heroTitleTail.trim();
  const subName = portfolioBrandSubName(content);
  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur"
      style={{ background: c.pageTranslucent, borderColor: c.borderSubtle }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        {/* 呼び名は見出し・共有画像と同じ「ナトリのあとりえ」。英字のサイト名は小さく添える。 */}
        <span className="flex min-w-0 max-w-[58vw] flex-col sm:max-w-none">
          <span className="truncate text-xl font-black leading-tight tracking-wide">
            {titleAccent || titleTail ? (
              <>
                <span style={{ color: c.text }}>{titleAccent}</span>
                <span style={{ color: c.actionText }}>{titleTail}</span>
              </>
            ) : (
              <span style={{ color: c.text }}>{content.artistName}</span>
            )}
          </span>
          {subName ? (
            <span
              className="hidden truncate text-xs font-semibold uppercase tracking-[0.2em] sm:block"
              style={{ ...fontEnStyle, color: c.textSoft }}
            >
              {subName}
            </span>
          ) : null}
        </span>
        <nav
          aria-label="メインナビゲーション"
          className="hidden shrink-0 items-center gap-4 whitespace-nowrap text-[13px] font-medium md:flex lg:gap-6 lg:text-sm"
          style={{ color: c.textSoft }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={
                link.label === CONTACT_NAV_LABEL
                  ? "pf-cute-focus -my-1.5 rounded-full border-2 px-3 py-1.5 font-bold hover:opacity-70 lg:px-4"
                  : "pf-cute-focus hover:opacity-70"
              }
              style={link.label === CONTACT_NAV_LABEL ? { borderColor: c.action, color: c.text } : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {showcase ? null : (
          // 受付状況の札。緑の枠で目立たせるより、白い札に小さな灯りを置いてサイトの淡い配色になじませる。
          <span
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-2.5 pr-3 text-[13px] font-bold md:text-xs"
            style={{
              background: c.surface,
              color: content.commissionOpen ? c.text : c.textSoft,
              border: `1px solid ${c.borderSubtle}`,
              boxShadow: `0 4px 12px ${c.shadowSoft}`,
            }}
          >
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              {content.commissionOpen ? (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 [animation-duration:2.4s] motion-reduce:animate-none"
                  style={{ background: c.success }}
                />
              ) : null}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: content.commissionOpen ? c.success : c.formBorder }}
              />
            </span>
            {content.commissionOpen ? (
              <>
                <span
                  className="hidden text-[11px] font-semibold tracking-[0.14em] sm:inline"
                  style={{ ...fontEnStyle, color: c.success }}
                  aria-hidden="true"
                >
                  OPEN
                </span>
                受付中
              </>
            ) : (
              "受付停止中"
            )}
          </span>
        )}
      </div>
      {/* モバイル用ナビ。md 以上は上のナビがあるので出さない */}
      <PortfolioMobileNav links={mobileLinks} />
    </header>
  );
}

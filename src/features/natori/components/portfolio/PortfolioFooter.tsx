// features/natori/components/portfolio/PortfolioFooter.tsx
// X はプロフィールアイコン直下、つなぐ はご依頼フォーム付近へ移設したため、
// フッターにはそれ以外のSNSリンクだけを表示する。
import Link from "next/link";
import {
  isPortfolioTsunaguLink,
  isPortfolioXLink,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";

const legalLinks = [
  { href: "/natori/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/natori/legal/privacy", label: "プライバシーポリシー" },
  { href: "/natori/legal/terms", label: "ご依頼規約" },
] as const;

export default function PortfolioFooter({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  const showcase = variant === "showcase";
  // showcase では外部SNSリンクも直接連絡手段になり得るため copyright のみ表示
  const links = showcase
    ? []
    : content.socialLinks.filter((link) => !isPortfolioXLink(link) && !isPortfolioTsunaguLink(link));
  return (
    <footer className="pb-10 pt-0 text-center text-sm md:py-10" style={{ color: c.textSoft }}>
      {links.length > 0 ? (
        <div className="mb-4 flex flex-wrap justify-center gap-5">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-cute-focus font-bold hover:opacity-70"
              style={{ color: c.accentText }}
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      {!showcase ? (
        <nav className="mb-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs" aria-label="法務情報">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pf-cute-focus underline underline-offset-4 hover:opacity-70"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <p>{content.copyright}</p>
    </footer>
  );
}

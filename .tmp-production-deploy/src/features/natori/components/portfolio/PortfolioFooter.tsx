// features/natori/components/portfolio/PortfolioFooter.tsx
// X はプロフィールアイコン直下、つなぐ はご依頼フォーム付近へ移設したため、
// フッターにはそれ以外のSNSリンクだけを表示する。
import {
  isPortfolioTsunaguLink,
  isPortfolioXLink,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";

export default function PortfolioFooter({
  content,
  variant = "full",
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
}) {
  // showcase では外部SNSリンクも直接連絡手段になり得るため copyright のみ表示
  const links =
    variant === "showcase"
      ? []
      : content.socialLinks.filter((link) => !isPortfolioXLink(link) && !isPortfolioTsunaguLink(link));
  return (
    <footer className="py-10 text-center text-sm" style={{ color: c.textSoft }}>
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
      <p>{content.copyright}</p>
    </footer>
  );
}

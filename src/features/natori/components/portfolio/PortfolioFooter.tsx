// features/natori/components/portfolio/PortfolioFooter.tsx
// X はプロフィールアイコン直下、つなぐ はご依頼フォーム付近へ移設したため、
// フッターにはそれ以外のSNSリンクだけを表示する。
import {
  isPortfolioTsunaguLink,
  isPortfolioXLink,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

export default function PortfolioFooter({ content }: { content: PortfolioContent }) {
  const links = content.socialLinks.filter(
    (link) => !isPortfolioXLink(link) && !isPortfolioTsunaguLink(link),
  );
  return (
    <footer className="py-10 text-center text-sm" style={{ color: c.inkSoft }}>
      {links.length > 0 ? (
        <div className="mb-4 flex flex-wrap justify-center gap-5">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-cute-focus font-bold hover:opacity-70"
              style={{ color: c.pinkDeep }}
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

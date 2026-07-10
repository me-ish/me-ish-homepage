// features/natori/components/portfolio/PortfolioFooter.tsx
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

export default function PortfolioFooter({ content }: { content: PortfolioContent }) {
  return (
    <footer className="py-10 text-center text-sm" style={{ color: c.inkSoft }}>
      <div className="mb-4 flex flex-wrap justify-center gap-5">
        {content.socialLinks.map((link) => (
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
      <p>{content.copyright}</p>
    </footer>
  );
}

// features/natori/components/portfolio/PortfolioFooter.tsx
import {
  portfolioColors as c,
  portfolioProfile,
  portfolioSocialLinks,
} from "@/features/natori/constants/portfolioContent";

export default function PortfolioFooter() {
  return (
    <footer className="py-10 text-center text-sm" style={{ color: c.inkSoft }}>
      <div className="mb-4 flex justify-center gap-5">
        {portfolioSocialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="pf-cute-focus font-bold hover:opacity-70"
            style={{ color: c.pinkDeep }}
          >
            {link.label}
          </a>
        ))}
      </div>
      <p>{portfolioProfile.copyright}</p>
    </footer>
  );
}

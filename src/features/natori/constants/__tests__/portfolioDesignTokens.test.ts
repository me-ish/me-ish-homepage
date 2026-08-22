import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  legacyNatoriTransactionColors,
  portfolioColors,
  portfolioHeroTitleColors,
  portfolioHeroTitleOutlineColor,
} from "@/features/natori/constants/portfolioContent";

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
  if (!channels || channels.length !== 3) throw new Error(`Expected six-digit hex: ${hex}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("PF-02 portfolio semantic colors", () => {
  it("keeps body and semantic text at WCAG AA contrast", () => {
    for (const background of [
      portfolioColors.page,
      portfolioColors.surface,
      portfolioColors.surfaceSubtle,
    ]) {
      expect(contrastRatio(portfolioColors.text, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(portfolioColors.textSoft, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of [
      portfolioColors.page,
      portfolioColors.surface,
      portfolioColors.surfaceSubtle,
    ]) {
      expect(contrastRatio(portfolioColors.accentText, background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of [portfolioColors.page, portfolioColors.surface]) {
      expect(contrastRatio(portfolioColors.accentDisplay, background)).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio(portfolioColors.onAction, portfolioColors.action)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrastRatio(portfolioColors.onError, portfolioColors.error)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrastRatio(portfolioColors.error, portfolioColors.errorSoft)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(portfolioColors.success, portfolioColors.successSoft)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("uses a control boundary with at least 3:1 adjacent contrast", () => {
    expect(
      contrastRatio(portfolioColors.borderStrong, portfolioColors.surface)
    ).toBeGreaterThanOrEqual(3);
  });

  it("uses the approved warm-to-cool Hero rainbow with a readable outline", () => {
    expect(portfolioHeroTitleColors).toEqual([
      "#FF9B73",
      "#FFD85A",
      "#7ED9A3",
      "#73C7FF",
    ]);
    expect(
      contrastRatio(portfolioHeroTitleOutlineColor, portfolioColors.page)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("does not expose the old color-as-purpose token names", () => {
    expect(Object.keys(portfolioColors)).not.toEqual(
      expect.arrayContaining([
        "paper",
        "paperAlt",
        "ink",
        "inkSoft",
        "pink",
        "pinkDeep",
        "mint",
        "mintDeep",
        "yellow",
        "peach",
        "card",
        "tape",
      ])
    );
  });

  it("keeps unrelated quote and delivery colors behind an unchanged compatibility boundary", () => {
    expect(legacyNatoriTransactionColors).toEqual({
      paper: "#F7F3FB",
      paperAlt: "#EFE7F7",
      ink: "#2D2A3D",
      inkSoft: "#5B5670",
      pink: "#FF6FA5",
      pinkDeep: "#E84C86",
      peach: "#FFB199",
      card: "#FFFFFF",
    });
  });
});

describe("PF-02 interaction states", () => {
  const stylesSource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioStyles.tsx"),
    "utf8"
  );
  const gallerySource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioGallery.tsx"),
    "utf8"
  );

  it("provides scoped focus-visible treatment for every interactive control", () => {
    expect(stylesSource).toContain(".pf-portfolio-root :where(a[href], button, input");
    expect(stylesSource).toContain(":focus-visible");
    expect(stylesSource).toContain("outline: 3px solid ${c.accentHover}");
  });

  it("keeps reduced-motion behavior for animation and card transitions", () => {
    expect(stylesSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesSource).toContain("animation: none");
    expect(stylesSource).toContain("transition: none");
  });

  it("offsets in-page targets below the sticky header", () => {
    expect(stylesSource).toContain(
      ":where(#gallery, #pricing, #flow, #about, #requests, #form)"
    );
    expect(stylesSource).toContain("scroll-margin-top: 128px");
    expect(stylesSource).toContain("scroll-margin-top: 88px");
  });

  it("labels gallery collections beyond their decorative color", () => {
    expect(gallerySource).toContain('aria-labelledby={`collection-${collection.id}`}');
    expect(gallerySource).toContain('id={`collection-${collection.id}`}');
    expect(gallerySource).toContain("{collection.name}");
    expect(gallerySource).toContain("aria-expanded={expanded}");
  });
});

describe("PF-08 image and font loading", () => {
  const fontsSource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/portfolioFonts.ts"),
    "utf8"
  );
  const gallerySource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioGallery.tsx"),
    "utf8"
  );

  it("does not preload every Japanese font unicode-range fragment", () => {
    expect(fontsSource).toContain("preload: false");
  });

  it("matches gallery image candidates to the bounded responsive grid", () => {
    expect(gallerySource).toContain(
      'sizes="(min-width: 1024px) 352px, (min-width: 640px) calc(50vw - 36px), calc(100vw - 40px)"'
    );
    expect(gallerySource).toContain(
      'sizes="(min-width: 768px) 768px, calc(100vw - 32px)"'
    );
  });
});

describe("portfolio choice controls", () => {
  const stylesSource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioStyles.tsx"),
    "utf8"
  );
  const structuredFormSource = readFileSync(
    resolve(
      process.cwd(),
      "src/features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx"
    ),
    "utf8"
  );
  const legacyFormSource = readFileSync(
    resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioCommissionForm.tsx"),
    "utf8"
  );

  it("uses white selection marks instead of browser-selected black marks", () => {
    expect(stylesSource).toContain('.pf-choice-control[type="radio"]:checked');
    expect(stylesSource).toContain("radial-gradient(circle, ${c.onAction}");
    expect(stylesSource).toContain("stroke='white'");
  });

  it("applies the custom choice control to current and legacy forms", () => {
    expect(structuredFormSource).toContain('className="pf-choice-control h-4 w-4 shrink-0"');
    expect(structuredFormSource).toContain(
      'className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"'
    );
    expect(legacyFormSource).toContain(
      'className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"'
    );
  });
});

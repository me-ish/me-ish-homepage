import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  legacyNatoriTransactionColors,
  portfolioColors,
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
      expect(contrastRatio(portfolioColors.accent, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(portfolioColors.onAccent, portfolioColors.accent)).toBeGreaterThanOrEqual(
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

  it("marks the selected gallery filter beyond color alone", () => {
    expect(gallerySource).toContain("aria-pressed={activeFilter === f}");
    expect(gallerySource).toContain('aria-hidden="true">✓</span>');
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesSource = readFileSync(
  resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioStyles.tsx"),
  "utf8",
);

const gallerySource = readFileSync(
  resolve(process.cwd(), "src/features/natori/components/portfolio/PortfolioGallery.tsx"),
  "utf8",
);

describe("PortfolioGallery artwork fit", () => {
  it("一覧カードだけ作品全体をcontainで見せる", () => {
    expect(stylesSource).toContain(
      ".pf-portfolio-root #gallery .pf-pin-card > button > img[alt]",
    );
    expect(stylesSource).toContain("object-fit: contain !important");
    expect(stylesSource).toContain("radial-gradient(circle at 22% 18%");
  });

  it("既存の3:4カード比率と2列/3列レイアウトを維持する", () => {
    expect(gallerySource).toContain("aspect-[3/4]");
    expect(gallerySource).toContain("grid grid-cols-2");
    expect(gallerySource).toContain("lg:grid-cols-3");
  });

  it("拡大モーダルは従来どおりobject-containを維持する", () => {
    expect(gallerySource).toContain('className="object-contain"');
  });
});

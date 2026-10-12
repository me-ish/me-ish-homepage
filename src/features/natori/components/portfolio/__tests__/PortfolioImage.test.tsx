import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; unoptimized?: boolean }) => (
    <div
      data-source={props.src}
      data-unoptimized={String(Boolean(props.unoptimized))}
      aria-label={props.alt}
    />
  ),
}));
import PortfolioImage from "../PortfolioImage";
it.each([
  "/api/natori/portfolio/assets/00000000-0000-4000-8000-000000000011.webp",
  "/api/natori/admin/portfolio-assets/00000000-0000-4000-8000-000000000011.webp?v=fixture",
])("forces authorization on each managed image GET: %s", (src) => {
  expect(
    renderToStaticMarkup(
      <PortfolioImage
        src={src}
        alt="Fixture"
        width={32}
        height={32}
        unoptimized={false}
      />,
    ),
  ).toContain('data-unoptimized="true"');
});
it("retains optimization and alt text for ordinary public gallery artwork", () => {
  const html = renderToStaticMarkup(
    <PortfolioImage
      src="https://assets.invalid/storage/v1/object/public/artworks/fixture.webp"
      alt="Public fixture"
      width={32}
      height={32}
    />,
  );
  expect(html).toContain('data-unoptimized="false"');
  expect(html).toContain('aria-label="Public fixture"');
});

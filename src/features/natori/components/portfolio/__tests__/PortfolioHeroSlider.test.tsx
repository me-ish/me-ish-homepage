// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt} />
  ),
}));

import PortfolioHeroSlider from "@/features/natori/components/portfolio/PortfolioHeroSlider";

afterEach(() => cleanup());

const slides = [
  { src: "https://example.com/a.webp", alt: "作品1" },
  { src: "https://example.com/b.webp", alt: "作品2" },
];

describe("PortfolioHeroSlider swipe", () => {
  it("swipes left to the next image and right to the previous image", () => {
    render(<PortfolioHeroSlider slides={slides} />);

    const surface = screen.getByRole("img", { name: "作品1" }).parentElement as HTMLElement;
    fireEvent.touchStart(surface, {
      touches: [{ clientX: 240, clientY: 120 }],
    });
    fireEvent.touchEnd(surface, {
      changedTouches: [{ clientX: 120, clientY: 124 }],
    });

    expect(screen.getByRole("img", { name: "作品2" })).toBeTruthy();

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 120, clientY: 120 }],
    });
    fireEvent.touchEnd(surface, {
      changedTouches: [{ clientX: 240, clientY: 124 }],
    });

    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();
  });

  it("does not change images for short or mostly vertical gestures", () => {
    render(<PortfolioHeroSlider slides={slides} />);

    const surface = screen.getByRole("img", { name: "作品1" }).parentElement as HTMLElement;
    fireEvent.touchStart(surface, {
      touches: [{ clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(surface, {
      changedTouches: [{ clientX: 190, clientY: 104 }],
    });
    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(surface, {
      changedTouches: [{ clientX: 150, clientY: 230 }],
    });
    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();
  });
});

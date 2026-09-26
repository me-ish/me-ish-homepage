// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

    const surface = screen.getByTestId("hero-slide-surface");
    const track = screen.getByTestId("hero-slide-track");
    fireEvent.touchStart(surface, {
      touches: [{ identifier: 1, clientX: 240, clientY: 120 }],
    });
    fireEvent.touchMove(surface, {
      touches: [{ identifier: 1, clientX: 170, clientY: 124 }],
    });
    expect(track.style.transform).toContain("-70px");
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [{ identifier: 1, clientX: 120, clientY: 124 }],
    });

    expect(track.style.transform).toContain("-66.666667%");
    fireEvent.transitionEnd(track, { propertyName: "transform" });
    expect(screen.getByRole("img", { name: "作品2" })).toBeTruthy();

    fireEvent.touchStart(surface, {
      touches: [{ identifier: 2, clientX: 120, clientY: 120 }],
    });
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [{ identifier: 2, clientX: 240, clientY: 124 }],
    });

    expect(track.style.transform).toContain("translate3d(0%");
    fireEvent.transitionEnd(track, { propertyName: "transform" });
    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();
  });

  it("does not change images for short or mostly vertical gestures", () => {
    render(<PortfolioHeroSlider slides={slides} />);

    const surface = screen.getByTestId("hero-slide-surface");
    fireEvent.touchStart(surface, {
      touches: [{ identifier: 1, clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [{ identifier: 1, clientX: 190, clientY: 104 }],
    });
    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();

    fireEvent.touchStart(surface, {
      touches: [{ identifier: 2, clientX: 220, clientY: 100 }],
    });
    fireEvent.touchEnd(surface, {
      touches: [],
      changedTouches: [{ identifier: 2, clientX: 150, clientY: 230 }],
    });
    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();
  });

  it("cancels the swipe when a second touch joins the gesture", () => {
    render(<PortfolioHeroSlider slides={slides} />);

    const surface = screen.getByTestId("hero-slide-surface");
    fireEvent.touchStart(surface, {
      touches: [{ identifier: 1, clientX: 240, clientY: 120 }],
    });
    fireEvent.touchStart(surface, {
      touches: [
        { identifier: 1, clientX: 230, clientY: 120 },
        { identifier: 2, clientX: 120, clientY: 120 },
      ],
    });
    fireEvent.touchEnd(surface, {
      touches: [{ identifier: 2, clientX: 120, clientY: 120 }],
      changedTouches: [{ identifier: 1, clientX: 90, clientY: 120 }],
    });

    expect(screen.getByRole("img", { name: "作品1" })).toBeTruthy();
  });

  it("slides left on the autoplay timer and settles on the next image", () => {
    vi.useFakeTimers();
    try {
      render(<PortfolioHeroSlider slides={slides} />);
      const track = screen.getByTestId("hero-slide-track");
      act(() => vi.advanceTimersByTime(5000));
      expect(track.style.transform).toContain("-66.666667%");
      fireEvent.transitionEnd(track, { propertyName: "transform" });
      expect(screen.getByRole("img", { name: "作品2" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

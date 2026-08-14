// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../portfolioFonts", () => ({ fontEnStyle: {} }));

import PortfolioHeader from "@/features/natori/components/portfolio/PortfolioHeader";
import PortfolioMobileCta from "@/features/natori/components/portfolio/PortfolioMobileCta";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";

let intersectionCallback: IntersectionObserverCallback;
const disconnect = vi.fn();

class IntersectionObserverMock {
  root = null;
  rootMargin = "0px";
  thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  disconnect = disconnect;
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PF-07 mobile navigation", () => {
  it("uses sufficient mobile targets and reveals a keyboard-focused link", () => {
    render(<PortfolioHeader content={defaultPortfolioContent} />);

    const mobileNav = screen.getByRole("navigation", {
      name: "メインナビゲーション（モバイル）",
    });
    const links = within(mobileNav).getAllByRole("link");
    for (const link of links) {
      expect(link.className).toContain("min-h-[44px]");
    }

    fireEvent.focus(links.at(-1) as HTMLAnchorElement);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "center",
    });
  });

  it("matches the hero CTA wording, respects the safe area, and hides over the form", () => {
    render(
      <>
        <section id="form" />
        <PortfolioMobileCta />
      </>
    );

    const cta = screen.getByRole("link", { name: "相談・見積もり" });
    expect(cta.className).toContain("min-h-[44px]");
    expect(cta.style.bottom).toBe("calc(1.25rem + env(safe-area-inset-bottom))");

    act(() => {
      intersectionCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(screen.queryByRole("link", { name: "相談・見積もり" })).toBeNull();
    expect(disconnect).not.toHaveBeenCalled();
  });
});

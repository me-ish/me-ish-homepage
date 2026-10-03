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


describe("PortfolioHeroSlider manual autoplay control",()=>{
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
  it("stays paused after hover/focus/touch leave and resumes a fresh interval on request",()=>{
    vi.useFakeTimers();render(<PortfolioHeroSlider slides={slides}/>);
    const region=screen.getByRole("region",{name:"代表作品"});
    fireEvent.click(screen.getByRole("button",{name:"自動送りを停止"}));
    expect(screen.getByRole("button",{name:"自動送りを再開"}).getAttribute("aria-pressed")).toBe("true");
    fireEvent.mouseEnter(region);fireEvent.mouseLeave(region);
    const next=screen.getByRole("button",{name:"次の作品"});fireEvent.focus(next);fireEvent.blur(next,{relatedTarget:document.body});
    const surface=screen.getByTestId("hero-slide-surface");
    fireEvent.touchStart(surface,{touches:[{identifier:1,clientX:100,clientY:100}]});
    fireEvent.touchEnd(surface,{touches:[],changedTouches:[{identifier:1,clientX:102,clientY:105}]});
    act(()=>vi.advanceTimersByTime(15000));expect(screen.getByRole("img",{name:"作品1"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"自動送りを再開"}));
    act(()=>vi.advanceTimersByTime(4999));expect(screen.getByRole("img",{name:"作品1"})).toBeTruthy();
    act(()=>vi.advanceTimersByTime(1));fireEvent.transitionEnd(screen.getByTestId("hero-slide-track"),{propertyName:"transform"});
    expect(screen.getByRole("img",{name:"作品2"})).toBeTruthy();
  });
  it("permits drag navigation while manual pause stays in force",()=>{
    vi.useFakeTimers();render(<PortfolioHeroSlider slides={slides}/>);
    fireEvent.click(screen.getByRole("button",{name:"自動送りを停止"}));
    const surface=screen.getByTestId("hero-slide-surface"),track=screen.getByTestId("hero-slide-track");
    fireEvent.touchStart(surface,{touches:[{identifier:2,clientX:240,clientY:100}]});
    fireEvent.touchMove(surface,{touches:[{identifier:2,clientX:160,clientY:102}]});
    expect(track.style.transform).toContain("-80px");
    fireEvent.touchEnd(surface,{touches:[],changedTouches:[{identifier:2,clientX:120,clientY:102}]});
    fireEvent.transitionEnd(track,{propertyName:"transform"});expect(screen.getByRole("img",{name:"作品2"})).toBeTruthy();
    act(()=>vi.advanceTimersByTime(15000));expect(screen.getByRole("img",{name:"作品2"})).toBeTruthy();
    expect(screen.getByRole("button",{name:"自動送りを再開"}).getAttribute("aria-pressed")).toBe("true");
  });
  it("honors reduced motion without preventing manual image selection",()=>{
    vi.useFakeTimers();vi.stubGlobal("matchMedia",vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
    render(<PortfolioHeroSlider slides={slides}/>);
    expect((screen.getByRole("button",{name:"自動送り停止中"}) as HTMLButtonElement).disabled).toBe(true);
    act(()=>vi.advanceTimersByTime(15000));expect(screen.getByRole("img",{name:"作品1"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"次の作品"}));expect(screen.getByRole("img",{name:"作品2"})).toBeTruthy();
  });
  it("does not add an autoplay control for one image",()=>{
    render(<PortfolioHeroSlider slides={slides.slice(0,1)}/>);expect(screen.queryByRole("button",{name:/自動送り/})).toBeNull();
  });
});

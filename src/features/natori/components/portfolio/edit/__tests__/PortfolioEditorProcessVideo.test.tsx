// @vitest-environment jsdom
// 制作過程の動画: 編集画面の目次・保存前の検証・保存時のURL整形。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import PortfolioEditor from "../PortfolioEditor";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 編集画面全体は要素が多く、画面全体への getByLabelText / getByText は遅いので、動画のセクションの中だけを探す
const processSection = () => within(document.getElementById("section-process") as HTMLElement);
const urlInput = () => processSection().getByLabelText("YouTubeの動画URL") as HTMLInputElement;
const captionInput = () => processSection().getByLabelText("見出しの下の説明（任意）") as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "保存する" });
const status = () => document.querySelector('[aria-live="polite"]') as HTMLElement;

describe("PortfolioEditor process video section", () => {
  it("puts 制作過程 in the table of contents between 作品 and 料金, and every entry has its section", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);

    const nav = screen.getAllByRole("navigation", { name: "セクション目次" })[0];
    const links = within(nav).getAllByRole("link");
    const labels = links.map((link) => link.textContent);
    expect(labels.indexOf("制作過程")).toBe(labels.indexOf("作品") + 1);
    expect(labels.indexOf("料金")).toBe(labels.indexOf("制作過程") + 1);
    for (const link of links) {
      expect(document.getElementById((link.getAttribute("href") ?? "").slice(1))).not.toBeNull();
    }

    const sectionIds = Array.from(document.querySelectorAll("section[id^='section-']"), (section) => section.id);
    expect(sectionIds.indexOf("section-process")).toBe(sectionIds.indexOf("section-works") + 1);
    expect(sectionIds.indexOf("section-plans")).toBe(sectionIds.indexOf("section-process") + 1);
  });

  it("starts empty for existing data, which means no video on the public page", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    expect(urlInput().value).toBe("");
    expect(processSection().queryByText(/読み取れません/u)).toBeNull();
  });

  it("flags the section and says why when the URL is not a YouTube video URL", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    fireEvent.change(urlInput(), { target: { value: "https://example.com/movie.mp4" } });
    fireEvent.click(saveButton());

    expect(status().textContent).toContain("入力内容に保存できない値があります。");
    expect(status().textContent).toContain(
      "「制作過程」：YouTubeの動画URL（https://www.youtube.com/watch?v=… や https://youtu.be/…）を指定してください。"
    );
    expect(document.getElementById("section-process")?.getAttribute("data-save-problem")).toBe("true");
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(1);
  });

  it("saves a pasted URL in its standard form", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    fireEvent.change(urlInput(), { target: { value: " https://youtu.be/dQw4w9WgXcQ?si=abc " } });
    fireEvent.click(saveButton());

    expect(status().textContent).toContain("保存しました");
    expect(document.querySelectorAll('[data-save-problem="true"]')).toHaveLength(0);
    expect(urlInput().value).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("drops the video, with its other settings, when the URL is left empty", () => {
    render(<PortfolioEditor demoContent={defaultPortfolioContent} />);
    fireEvent.change(captionInput(), { target: { value: "残らない説明" } });
    fireEvent.change(urlInput(), { target: { value: "   " } });
    fireEvent.click(saveButton());

    expect(status().textContent).toContain("保存しました");
    expect(captionInput().value).toBe("");
  });
});

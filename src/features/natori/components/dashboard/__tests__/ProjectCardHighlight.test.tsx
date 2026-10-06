// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProjectCard from "../ProjectCard";
import type { NatoriProject } from "../../../types/projects";

const scrollIntoView = vi.fn();

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
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  scrollIntoView.mockClear();
});

const project: NatoriProject = {
  id: "highlight-fixture",
  title: "Highlight fixture",
  clientName: "Synthetic client",
  type: "illustration",
  status: "rough",
  nextAction: "ラフ制作を続ける",
  tasks: [{ id: "rough-task", label: "ラフ線を整える", stage: "rough", done: false }],
  dueDate: null,
  amount: 12000,
};
const today = new Date("2026-10-02T00:00:00Z");

describe("ProjectCard highlighted (deep link)", () => {
  it("is plain and does not scroll by default", () => {
    render(<ProjectCard project={project} today={today} onToggleTask={vi.fn()} />);
    expect(screen.getByRole("article", { name: "Highlight fixture" }).getAttribute("data-highlighted")).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("marks the card and scrolls it into the middle of the screen once", () => {
    const { rerender } = render(<ProjectCard project={project} today={today} onToggleTask={vi.fn()} highlighted />);
    expect(screen.getByRole("article", { name: "Highlight fixture" }).getAttribute("data-highlighted")).toBe("true");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    rerender(<ProjectCard project={project} today={today} onToggleTask={vi.fn()} highlighted={false} />);
    expect(screen.getByRole("article", { name: "Highlight fixture" }).getAttribute("data-highlighted")).toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

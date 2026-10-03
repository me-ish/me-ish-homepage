// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NatoriPageShell } from "../NatoriPageShell";

afterEach(() => cleanup());

describe("NatoriPageShell", () => {
  it("marks only the current section with aria-current in both navs", () => {
    render(<NatoriPageShell current="projects" title="案件"><p>body</p></NatoriPageShell>);
    expect(screen.getByRole("heading", { level: 1, name: "案件" })).toBeTruthy();
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(2); // header (md+) and tab bar (mobile)
    current.forEach((el) => expect(el.getAttribute("href")).toBe("/natori/projects"));
  });

  it("links every admin page from the header", () => {
    render(<NatoriPageShell current="dashboard" title="ダッシュボード"><p>body</p></NatoriPageShell>);
    const hrefs = Array.from(document.querySelectorAll("header nav a")).map((a) => a.getAttribute("href"));
    for (const href of ["/natori/dashboard", "/natori/inquiries", "/natori/projects", "/natori/estimate", "/natori/results", "/natori/portfolio/edit", "/natori/links/edit"]) {
      expect(hrefs).toContain(href);
    }
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NatoriWorkspaceShell } from "../NatoriWorkspaceShell";

afterEach(() => cleanup());

describe("NatoriWorkspaceShell", () => {
  it("uses the workspace header and leads back to the ページ tab without the old admin nav", () => {
    render(<NatoriWorkspaceShell title="実績" backHref="/natori/dashboard/cases?utility=pages"><p>body</p></NatoriWorkspaceShell>);
    expect(screen.getByRole("heading", { level: 1, name: "実績" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "← ページへ戻る" }).getAttribute("href")).toBe("/natori/dashboard/cases?utility=pages");
    expect(screen.queryByRole("navigation", { name: "管理メニュー" })).toBeNull();
    expect(document.querySelector('a[href="/natori/inquiries"]')).toBeNull();
  });
});

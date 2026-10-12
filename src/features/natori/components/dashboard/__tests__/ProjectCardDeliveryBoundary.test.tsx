// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectCard from "../ProjectCard";
import type { NatoriProject } from "../../../types/projects";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const base: NatoriProject = {
  id: "delivery-boundary-fixture", title: "Synthetic", clientName: "Synthetic client",
  type: "illustration", status: "delivery_prep", nextAction: "納品データ準備",
  amount: 12000, dueDate: null, tasks: [], paymentConfirmedAt: "2026-10-01T12:00:00Z",
};
const today = new Date("2026-10-02T00:00:00Z");

describe("ProjectCard delivery/completion controls", () => {
  it.each(["delivery_prep", "delivered", "completed"] as const)(
    "%s offers the dedicated delivery mail control without generic advance",
    (status) => {
      const project = { ...base, status };
      const advance = vi.fn();
      const mail = vi.fn();
      render(<ProjectCard project={project} today={today} onToggleTask={vi.fn()}
        onAdvanceStatus={advance} onOpenMail={mail} />);
      expect(screen.queryByRole("button", { name: "納品済みにする" })).toBeNull();
      expect(screen.queryByRole("button", { name: "完了にする" })).toBeNull();
      const button = screen.getByRole("button", { name: status === "completed" ? "納品メールを再送" : "納品メール" });
      fireEvent.click(button);
      expect(mail).toHaveBeenCalledWith(project, "delivery");
      expect(advance).not.toHaveBeenCalled();
    },
  );

  it("keeps the ordinary production advance control", () => {
    const project = { ...base, status: "rough" as const };
    const advance = vi.fn();
    render(<ProjectCard project={project} today={today} onToggleTask={vi.fn()} onAdvanceStatus={advance} />);
    fireEvent.click(screen.getByRole("button", { name: "線画へ進む" }));
    expect(advance).toHaveBeenCalledWith(project);
  });
});

// @vitest-environment jsdom
// 旧概算ツールの「見積もりメールを作成」（Q-05）: 本番は確認モーダルを挟まず見積りページへ直接進む。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { NatoriProject } from "@/features/natori/types/projects";

const api = vi.hoisted(() => ({ projects: vi.fn(), presets: vi.fn() }));
vi.mock("@/features/natori/data/supabaseProjects", () => ({ fetchNatoriProjects: api.projects }));
vi.mock("@/features/natori/data/supabasePricing", () => ({
  fetchOwnPricingPresets: api.presets,
  seedDefaultPricingPresets: vi.fn(async () => []),
  updatePricingPresetConfig: vi.fn(),
}));
vi.mock("@/features/natori/components/dashboard/ProjectRegisterForm", () => ({ default: () => null }));
vi.mock("@/features/natori/components/dashboard/OrderMailPanel", () => ({
  default: () => <p>mail-panel</p>,
}));
import EstimateForm from "../EstimateForm";

const inquiry: NatoriProject = {
  id: "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c",
  title: "SNSアイコン / テスト太郎",
  clientName: "テスト太郎",
  clientEmail: "client@example.com",
  amount: null,
  dueDate: null,
  status: "inquiry",
  nextAction: "内容確認",
  type: "illustration",
  createdAt: "2026-08-01T00:00:00.000Z",
  deliveryPlan: "normal",
  tasks: [],
  note: "SNSアイコン バストアップ",
};

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
  api.projects.mockResolvedValue([inquiry]);
  api.presets.mockResolvedValue([]);
  window.history.replaceState({}, "", `/natori/estimate?inquiry=${inquiry.id}`);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("EstimateForm 「見積もりメールを作成」 (Q-05)", () => {
  it("in production it is a plain link to the estimate page, with no modal in between", async () => {
    render(<EstimateForm />);
    const link = await screen.findByRole("link", { name: "見積もりメールを作成" });
    expect(link.getAttribute("href")).toBe(`/natori/estimate?inquiry=${inquiry.id}`);
    expect(screen.queryByText("mail-panel")).toBeNull();
  });

  it("the demo keeps opening its in-page mail draft", async () => {
    render(<EstimateForm demo demoProjects={[inquiry]} />);
    const button = await screen.findByRole("button", { name: "見積もりメールを作成" });
    expect(screen.queryByRole("link", { name: "見積もりメールを作成" })).toBeNull();
    button.click();
    await screen.findByText("mail-panel");
  });
});

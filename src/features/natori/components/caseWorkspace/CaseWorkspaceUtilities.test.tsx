// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  load: vi.fn(),
  auth: (_event: string) => {},
  unsubscribe: vi.fn(),
}));
vi.mock("../../data/supabaseProfile", () => ({
  fetchOwnNatoriProfile: m.load,
  NatoriProfileLoadError: class extends Error {
    status = 401;
  },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        m.auth = cb;
        return { data: { subscription: { unsubscribe: m.unsubscribe } } };
      },
      signOut: vi.fn(),
    },
  }),
}));
vi.mock("../dashboard/NatoriDashboardLegacy", () => ({
  ProfileSettingsPanel: ({ profile }: { profile: { displayName: string } }) => (
    <p>{profile?.displayName}</p>
  ),
}));
vi.mock("../dashboard/PageEventsPanel", () => ({ default: () => null }));
vi.mock("../dashboard/EstimateForm", () => ({ default: () => null }));
import { CaseWorkspaceUtilities } from "./CaseWorkspaceUtilities";
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("does not restore a delayed profile read after signout has invalidated its auth generation", async () => {
  let resolve!: (v: unknown) => void;
  m.load.mockReturnValue(new Promise((r) => (resolve = r)));
  const reject = vi.fn();
  render(
    <CaseWorkspaceUtilities
      mode="settings"
      readOnly={false}
      onDraftChange={() => {}}
      onAccessRejected={reject}
    />,
  );
  act(() => m.auth("SIGNED_OUT"));
  await act(async () => resolve({ displayName: "表示してはいけない旧設定" }));
  expect(reject).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("表示してはいけない旧設定")).toBeNull();
});
it("provides real fixed destinations in separate tabs for every existing public editor", async () => {
  m.load.mockResolvedValue({ displayName: "合成担当" });
  render(
    <CaseWorkspaceUtilities
      mode="settings"
      readOnly
      onDraftChange={() => {}}
      onAccessRejected={() => {}}
    />,
  );
  await screen.findByText("合成担当");
  expect(
    screen
      .getByRole("link", { name: "ポートフォリオを編集" })
      .getAttribute("href"),
  ).toBe("/natori/portfolio/edit");
  expect(
    screen.getByRole("link", { name: "リンク集を編集" }).getAttribute("target"),
  ).toBe("_blank");
});
it("preserves configured public destinations while keeping editors fixed and rejecting unsafe legacy URLs", async () => {
  m.load.mockResolvedValue({displayName:"合成担当",portfolioUrl:"https://example.invalid/artist",linksUrl:"javascript:alert(1)"});
  render(<CaseWorkspaceUtilities mode="settings" readOnly onDraftChange={()=>{}} onAccessRejected={()=>{}}/>);
  await screen.findByText("合成担当");
  expect(screen.getByRole("link",{name:"ポートフォリオを見る"}).getAttribute("href")).toBe("https://example.invalid/artist");
  expect(screen.getByRole("link",{name:"ポートフォリオを編集"}).getAttribute("href")).toBe("/natori/portfolio/edit");
  expect(screen.queryByRole("link",{name:"リンク集を見る"})).toBeNull();
  expect(screen.getByText("リンク集を見る：保存済みURLを確認してください")).not.toBeNull();
});

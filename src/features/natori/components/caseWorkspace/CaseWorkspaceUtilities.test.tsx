// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
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
it("keeps その他 to profile, click analysis, logout and the emergency stop", async () => {
  m.load.mockResolvedValue({ displayName: "合成担当" });
  render(<CaseWorkspaceUtilities mode="settings" readOnly onDraftChange={() => {}} onAccessRejected={() => {}} />);
  await screen.findByText("合成担当");
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
  expect(screen.getByText("困った時：緊急停止")).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "ほかのページ" })).toBeNull();
  expect(screen.queryByRole("link", { name: "ポートフォリオを編集" })).toBeNull();
  expect(screen.queryByRole("link", { name: "実績" })).toBeNull();
});
it("preserves configured public destinations on the ページ tab while keeping editors fixed and rejecting unsafe legacy URLs", async () => {
  m.load.mockResolvedValue({displayName:"合成担当",portfolioUrl:"https://example.invalid/artist",linksUrl:"javascript:alert(1)"});
  render(<CaseWorkspaceUtilities mode="pages" readOnly onDraftChange={()=>{}} onAccessRejected={()=>{}}/>);
  const portfolio = (await screen.findByRole("heading",{name:"ポートフォリオ"})).closest("article") as HTMLElement;
  expect((await within(portfolio).findByRole("link",{name:/見る/})).getAttribute("href")).toBe("https://example.invalid/artist");
  expect(within(portfolio).getByRole("link",{name:"編集する"}).getAttribute("href")).toBe("/natori/portfolio/edit");
  const links = screen.getByRole("heading",{name:"リンク集"}).closest("article") as HTMLElement;
  expect(within(links).queryByRole("link",{name:/見る/})).toBeNull();
  expect(within(links).getByText("公開URLがまだ設定されていません")).toBeTruthy();
});

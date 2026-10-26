// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Login, { googleLoginTargetMatches } from "../../../../../scripts/natori-case-initial-preview/google-login.client";
import type { CaseAcceptanceTarget } from "../../lib/caseAcceptanceTarget";
const mocks = vi.hoisted(() => ({ marker: vi.fn(), create: vi.fn(), oauth: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/caseAcceptanceEnvironment", () => ({ publicAcceptanceTarget: mocks.marker }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.create }));
const target: CaseAcceptanceTarget = { profile: "local", ref: "local", project: "local-fixture", url: "http://127.0.0.1:4193",
  origin: window.location.origin, run: "b37c7c45-e642-4bab-a973-9d44289a5765", startsAt: "2026-10-23T23:30:00Z", endsAt: "2026-10-25T00:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState({}, "", "/admin-login");
  mocks.marker.mockReturnValue(target);
  mocks.create.mockReturnValue({ auth: { signInWithOAuth: mocks.oauth, signOut: mocks.logout } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("requires matching public target fields and actual origin before any SDK call", () => {
  expect(googleLoginTargetMatches(target, target.origin)).toBe(true);
  expect(googleLoginTargetMatches(target, "https://different.invalid")).toBe(false);
  for (const key of Object.keys(target)) {
    mocks.marker.mockReturnValue({ ...target, [key]: "different" });
    expect(googleLoginTargetMatches(target, target.origin)).toBe(false);
  }
  mocks.marker.mockReturnValue(null);
  render(<Login target={target} currentEmail={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));
  expect(mocks.create).not.toHaveBeenCalled();
});
it("uses existing OAuth SDK with an exact callback and ignores caller-controlled destinations", async () => {
  window.history.replaceState({}, "", "/admin-login?next=https%3A%2F%2Fevil.invalid&redirect=%2Fadmin");
  mocks.oauth.mockResolvedValue({ data: { provider: "google", url: "synthetic-provider-navigation" }, error: null });
  render(<Login target={target} currentEmail={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));
  await waitFor(() => expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith({ provider: "google", options: {
    redirectTo: target.origin + "/auth/callback", scopes: "openid email profile", queryParams: { prompt: "select_account" },
  } }));
  expect(screen.queryByLabelText("検証用パスワード")).toBeNull();
  expect(document.body.textContent).not.toContain("synthetic-provider-navigation");
});
it("does not repeat OAuth while the SDK request or navigation is pending", async () => {
  let finish!: (value: unknown) => void;
  mocks.oauth.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<Login target={target} currentEmail={null} />);
  const button = screen.getByRole("button", { name: "Googleでログイン" });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.oauth).toHaveBeenCalledTimes(1);
  finish({ data: { url: "synthetic-provider-navigation" }, error: null });
  await waitFor(() => expect((screen.getByRole("button", { name: "認証を確認しています…" }) as HTMLButtonElement).disabled).toBe(true));
});
it("shows only a static start failure without provider response/secret details", async () => {
  mocks.oauth.mockResolvedValue({ data: { url: null }, error: { message: "untrusted provider diagnostic" } });
  render(<Login target={target} currentEmail={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));
  await screen.findByText("Googleログインを開始できません。検証環境の認証設定を確認してください。");
  expect(document.body.textContent).not.toContain("untrusted provider diagnostic");
});
it("maps callback errors to static text and does not use them as links or instructions", () => {
  window.history.replaceState({}, "", "/admin-login?err=external-secret-or-instruction");
  render(<Login target={target} currentEmail={null} />);
  expect(screen.getByRole("alert").textContent).not.toContain("external-secret-or-instruction");
  expect(mocks.oauth).not.toHaveBeenCalled();
});
it("keeps current identity visible but leaves case authorization to the server", () => {
  window.history.replaceState({}, "", "/admin-login?err=unauthorized");
  render(<Login target={target} currentEmail="other@example.invalid" />);
  expect(screen.getByText("現在のログイン: other@example.invalid")).toBeTruthy();
  expect(screen.getByText("このGoogleアカウントには検証案件の閲覧権限がありません。")).toBeTruthy();
});
it("uses normal local logout and does not print provider errors on failure", async () => {
  mocks.logout.mockResolvedValue({ error: { message: "private logout response" } });
  render(<Login target={target} currentEmail="info@me-ish.art" />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  await screen.findByText("ログアウト結果を確認できません。再読み込みして認証状態を確認してください。");
  expect(mocks.logout).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  expect(document.body.textContent).not.toContain("private logout response");
});

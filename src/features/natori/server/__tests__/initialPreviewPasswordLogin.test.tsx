// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PreviewPasswordLogin, { passwordLoginTargetMatches } from "../../../../../scripts/natori-case-initial-preview/password-login.client";
import type { CaseAcceptanceTarget } from "../../lib/caseAcceptanceTarget";

const mocks = vi.hoisted(() => ({ marker: vi.fn(), create: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/caseAcceptanceEnvironment", () => ({ publicAcceptanceTarget: mocks.marker }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.create }));
const target: CaseAcceptanceTarget = {
  profile: "local", ref: "local", project: "local-fixture", url: "http://127.0.0.1:4193",
  origin: window.location.origin, run: "b37c7c45-e642-4bab-a973-9d44289a5765",
  startsAt: "2026-10-23T23:30:00Z", endsAt: "2026-10-25T00:00:00Z",
};
const actors = [{ id: "16018e8a-f04a-4dd3-a95c-a0a0354af590", email: "staff@example.invalid", label: "担当者（閲覧確認）" },
  { id: "2be65488-a1dd-47a7-9344-27b9bdb4aa4a", email: "outsider@example.invalid", label: "権限なし（拒否確認用）" }];
const input = () => screen.getByLabelText("検証用パスワード") as HTMLInputElement;
const login = () => screen.getByRole("button", { name: "検証アカウントでログイン" });
const submit = () => fireEvent.submit(input().form!);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.marker.mockReturnValue(target);
  mocks.create.mockReturnValue({ auth: { signInWithPassword: mocks.login, signOut: mocks.logout } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("requires the complete public target and actual origin to match; malformed/missing metadata fails closed", () => {
  expect(passwordLoginTargetMatches(target, target.origin)).toBe(true);
  expect(passwordLoginTargetMatches(target, "https://another.invalid")).toBe(false);
  for (const key of Object.keys(target)) {
    mocks.marker.mockReturnValue({ ...target, [key]: "different" });
    expect(passwordLoginTargetMatches(target, target.origin)).toBe(false);
  }
  mocks.marker.mockReturnValue(null);
  expect(passwordLoginTargetMatches(target, target.origin)).toBe(false);
  mocks.marker.mockImplementation(() => { throw Error("invalid marker"); });
  expect(passwordLoginTargetMatches(target, target.origin)).toBe(false);
});

it("makes Google unavailable and provides only pre-existing actor choices, without signup/reset controls", () => {
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  expect(screen.getByText("この検証ではGoogleログインを使用しません。")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Googleでログイン" })).toBeNull();
  expect(screen.getAllByRole("option").map(option => (option as HTMLOptionElement).value)).toEqual(actors.map(actor => actor.email));
  expect(input().type).toBe("password");
  expect(input().value).toBe("");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("does not create a client or submit credentials when target metadata differs", () => {
  mocks.marker.mockReturnValue(null);
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  submit();
  expect(mocks.create).not.toHaveBeenCalled();
  expect((login() as HTMLButtonElement).disabled).toBe(true);
});

it("uses the selected existing identity, clears the input and exposes no raw authentication error", async () => {
  mocks.login.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials", message: "do not render provider response" } });
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(screen.getByLabelText("検証アカウント"), { target: { value: actors[1].email } });
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  submit();
  await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
  expect(mocks.login).toHaveBeenCalledWith({ email: actors[1].email, password: "nonworking unit fixture" });
  expect(input().value).toBe("");
  await screen.findByText("ログインできませんでした。アカウントとパスワードを確認してください。");
  expect(document.body.textContent).not.toContain("do not render provider response");
});

it("prevents rapid repeated submit while the first authentication result is pending", async () => {
  let finish!: (value: unknown) => void;
  mocks.login.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  submit(); submit();
  expect(mocks.login).toHaveBeenCalledTimes(1);
  expect((input() as HTMLInputElement).disabled).toBe(true);
  finish({ data: { user: null }, error: { code: "invalid_credentials" } });
  await screen.findByText("ログインできませんでした。アカウントとパスワードを確認してください。");
});

it("keeps an uncertain authentication result from silently retrying", async () => {
  mocks.login.mockRejectedValue(Error("private transport error must not render"));
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  submit();
  await screen.findByRole("button", { name: "画面を再読み込み" });
  expect((login() as HTMLButtonElement).disabled).toBe(true);
  submit();
  expect(mocks.login).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).not.toContain("private transport error");
});

it("does not accept a successful Auth response for a different identity as the selected actor", async () => {
  mocks.login.mockResolvedValue({ data: { user: actors[1] }, error: null });
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  submit();
  await screen.findByText("ログインしたアカウントを確認できません。ログアウトして確認してください。");
  expect(screen.queryByText("案件画面を開く")).toBeNull();
  expect(mocks.logout).not.toHaveBeenCalled();
});

it("clears the previous password when selecting another account", () => {
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={null} />);
  fireEvent.change(input(), { target: { value: "nonworking unit fixture" } });
  fireEvent.change(screen.getByLabelText("検証アカウント"), { target: { value: actors[1].email } });
  expect(input().value).toBe("");
});

it("keeps an already authenticated nonstaff account visibly selected instead of implying a staff session", () => {
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={actors[1].email} />);
  expect((screen.getByLabelText("検証アカウント") as HTMLSelectElement).value).toBe(actors[1].email);
  expect(screen.getByText(`現在のログイン: ${actors[1].email}`)).toBeTruthy();
});

it("uses normal local session logout and treats an unconfirmed result as unconfirmed", async () => {
  mocks.logout.mockResolvedValue({ error: { message: "private logout response" } });
  render(<PreviewPasswordLogin target={target} actors={actors} currentEmail={actors[0].email} />);
  fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
  await screen.findByText("ログアウト結果を確認できません。画面を再読み込みして確認してください。");
  expect(mocks.logout).toHaveBeenCalledWith({ scope: "local" });
  expect(document.body.textContent).not.toContain("private logout response");
});

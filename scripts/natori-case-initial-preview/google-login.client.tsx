"use client";

// Dedicated package only. Auth and PKCE use the existing SSR browser client.
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { publicAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import type { CaseAcceptanceTarget } from "@/features/natori/lib/caseAcceptanceTarget";

export function googleLoginTargetMatches(target: CaseAcceptanceTarget, origin: string): boolean {
  try {
    const actual = publicAcceptanceTarget(true);
    return actual !== null && target.origin === origin
      && ["profile", "ref", "project", "url", "origin", "run", "startsAt", "endsAt"].every(
        key => actual[key as keyof CaseAcceptanceTarget] === target[key as keyof CaseAcceptanceTarget],
      );
  } catch { return false; }
}

export default function PreviewGoogleLogin({ target, currentEmail }: { target: CaseAcceptanceTarget; currentEmail: string | null }) {
  const [available, setAvailable] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const active = useRef(false);
  useEffect(() => {
    setAvailable(googleLoginTargetMatches(target, window.location.origin));
    const code = new URLSearchParams(window.location.search).get("err");
    if (code === "unauthorized") setError("このGoogleアカウントには検証案件の閲覧権限がありません。");
    else if (code) setError("Google認証を確認できませんでした。同じブラウザでログインからやり直してください。");
  }, [target]);

  const login = async () => {
    if (active.current || !googleLoginTargetMatches(target, window.location.origin)) return;
    active.current = true; setBusy(true); setError("");
    try {
      // createBrowserClient from @supabase/ssr owns the PKCE verifier/cookies.
      // No caller-controlled next URL, offline scope, token or client secret.
      const result = await createClient().auth.signInWithOAuth({ provider: "google", options: {
        redirectTo: `${target.origin}/auth/callback`, scopes: "openid email profile", queryParams: { prompt: "select_account" },
      } });
      if (result.error || !result.data.url) throw Error("oauth_not_started");
      // Successful SDK navigation stays latched until leaving this document.
    } catch {
      active.current = false; setBusy(false);
      setError("Googleログインを開始できません。検証環境の認証設定を確認してください。");
    }
  };
  const logout = async () => {
    if (active.current || !googleLoginTargetMatches(target, window.location.origin)) return;
    active.current = true; setBusy(true); setError("");
    try {
      const result = await createClient().auth.signOut({ scope: "local" });
      if (result.error) throw Error("logout_unconfirmed");
      window.location.replace("/admin-login");
    } catch {
      active.current = false; setBusy(false);
      setError("ログアウト結果を確認できません。再読み込みして認証状態を確認してください。");
    }
  };
  return <section className="mx-auto max-w-md space-y-5 text-left" aria-busy={busy}>
    <h1 className="text-xl font-semibold">Googleログイン（専用検証）</h1>
    <p className="text-sm leading-6">許可されたGoogleアカウントでログインします。検証案件の閲覧のみで、更新・メール送信・決済は停止しています。</p>
    {currentEmail && <p className="break-all text-sm">現在のログイン: {currentEmail}</p>}
    {!available && <p role="alert">検証先を確認できないためログイン操作を停止しています。</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button type="button" onClick={login} disabled={!available || busy}
      className="w-full rounded bg-[#007eac] p-3 font-semibold text-white disabled:opacity-50">{busy ? "認証を確認しています…" : "Googleでログイン"}</button>
    {currentEmail && <button type="button" onClick={() => window.location.replace("/natori/dashboard/cases")}
      disabled={busy} className="block underline">案件画面を開く</button>}
    <button type="button" onClick={logout} disabled={!available || busy}
      className="w-full rounded border border-gray-400 p-3 disabled:opacity-50">ログアウト</button>
    <p className="text-xs leading-5 text-gray-600">GoogleのパスワードはGoogleの画面だけに入力してください。認証後の閲覧権限はサーバーで確認します。</p>
  </section>;
}

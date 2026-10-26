"use client";

// Copied only into the protected, dedicated read-only package. No password or
// server credential is a prop, a build constant, or part of this source.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { publicAcceptanceTarget } from "@/lib/caseAcceptanceEnvironment";
import type { CaseAcceptanceTarget } from "@/features/natori/lib/caseAcceptanceTarget";

export type PreviewActor = { id: string; email: string; label: string };
export type PreviewLoginProps = {
  target: CaseAcceptanceTarget;
  actors: PreviewActor[];
  currentEmail: string | null;
};

export function passwordLoginTargetMatches(target: CaseAcceptanceTarget, origin: string): boolean {
  try {
    const actual = publicAcceptanceTarget(true);
    return actual !== null && origin === target.origin
      && ["profile", "ref", "project", "url", "origin", "run", "startsAt", "endsAt"].every(
        key => actual[key as keyof CaseAcceptanceTarget] === target[key as keyof CaseAcceptanceTarget],
      );
  } catch { return false; }
}

export default function PreviewPasswordLogin({ target, actors, currentEmail }: PreviewLoginProps) {
  const [available, setAvailable] = useState(false);
  const [email, setEmail] = useState(actors.find(actor => actor.email === currentEmail)?.email ?? actors[0]?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);

  useEffect(() => {
    setAvailable(passwordLoginTargetMatches(target, window.location.origin));
    if (new URLSearchParams(window.location.search).get("err") === "unauthorized") {
      setMessage("このアカウントでは案件を閲覧できません。担当者用アカウントを確認してください。");
    }
  }, [target]);

  const enter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (active.current || uncertain || !passwordLoginTargetMatches(target, window.location.origin)) return;
    const actor = actors.find(row => row.email === email);
    if (!actor || !password) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    const submittedPassword = password;
    setPassword("");
    try {
      const { data, error } = await createClient().auth.signInWithPassword({ email: actor.email, password: submittedPassword });
      if (error) {
        if (error.code === "invalid_credentials") setMessage("ログインできませんでした。アカウントとパスワードを確認してください。");
        else {
          setUncertain(true);
          setMessage("ログイン結果を確認できません。再送せず、画面を再読み込みして確認してください。");
        }
        return;
      }
      if (data.user?.id !== actor.id || data.user.email !== actor.email) {
        setUncertain(true);
        setMessage("ログインしたアカウントを確認できません。ログアウトして確認してください。");
        return;
      }
      // A full normal request revalidates Auth, staff access, owner and fixture.
      // A successful Auth response itself never grants management permission.
      window.location.replace("/natori/dashboard/cases");
    } catch {
      setUncertain(true);
      setMessage("ログイン結果を確認できません。再送せず、画面を再読み込みして確認してください。");
    } finally {
      active.current = false;
      setBusy(false);
    }
  };

  const leave = async () => {
    if (active.current || !passwordLoginTargetMatches(target, window.location.origin)) return;
    active.current = true;
    setBusy(true);
    setPassword("");
    setMessage("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw Error("logout_unconfirmed");
      window.location.replace("/admin-login");
    } catch {
      setUncertain(true);
      setMessage("ログアウト結果を確認できません。画面を再読み込みして確認してください。");
    } finally {
      active.current = false;
      setBusy(false);
    }
  };

  return <section className="mx-auto max-w-md space-y-5 text-left" aria-busy={busy}>
    <h1 className="text-xl font-semibold">案件画面の検証ログイン</h1>
    <p className="text-sm leading-6">専用のテストアカウントでログインします。案件は閲覧のみで、送信・決済・更新は行いません。</p>
    <p className="text-sm text-gray-600">この検証ではGoogleログインを使用しません。</p>
    {currentEmail && <p className="break-all text-sm">現在のログイン: {currentEmail}</p>}
    {!available && <p role="alert">検証先を確認できないため、ログイン操作を停止しています。</p>}
    {message && <p role="alert" className="text-sm text-rose-700">{message}</p>}
    <form onSubmit={enter} className="space-y-4">
      <label className="block text-sm">検証アカウント
        <select value={email} onChange={event => { setEmail(event.target.value); setPassword(""); }}
          disabled={!available || busy || uncertain} autoComplete="username"
          className="mt-1 w-full rounded border border-gray-400 bg-white p-3">
          {actors.map(actor => <option key={actor.id} value={actor.email}>{actor.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">検証用パスワード
        <input type="password" value={password} onChange={event => setPassword(event.target.value)}
          disabled={!available || busy || uncertain} autoComplete="current-password" required
          className="mt-1 w-full rounded border border-gray-400 p-3" />
      </label>
      <button type="submit" disabled={!available || busy || uncertain || !password}
        className="w-full rounded bg-[#007eac] p-3 font-semibold text-white disabled:opacity-50">
        {busy ? "確認中…" : "検証アカウントでログイン"}
      </button>
    </form>
    {currentEmail && !uncertain && <button type="button" onClick={() => window.location.replace("/natori/dashboard/cases")}
      className="block underline">案件画面を開く</button>}
    <button type="button" onClick={leave} disabled={!available || busy}
      className="w-full rounded border border-gray-400 p-3 disabled:opacity-50">ログアウト</button>
    {uncertain && <button type="button" onClick={() => window.location.reload()} className="w-full rounded border border-gray-400 p-3">画面を再読み込み</button>}
    <p className="text-xs leading-5 text-gray-600">パスワードは承認された安全な方法で受け取ってください。この画面から登録・パスワード再設定・メール送信は行いません。</p>
  </section>;
}

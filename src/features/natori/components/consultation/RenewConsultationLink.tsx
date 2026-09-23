"use client";

import { useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

export default function RenewConsultationLink({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const renew = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/natori/consult/${encodeURIComponent(token)}/renew`, { method: "POST", headers: CSRF_HEADERS });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "送信できませんでした");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信できませんでした");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">リンクの期限が切れている場合は、元の問い合わせ先メールアドレスに新しいリンクを送れます。</p>
      <button type="button" onClick={() => void renew()} disabled={busy || done} className="rounded-full bg-pink-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "送信中…" : done ? "送信しました" : "新しいリンクをメールで受け取る"}
      </button>
      {done ? <p role="status" className="text-sm text-green-700">メールをご確認ください。</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

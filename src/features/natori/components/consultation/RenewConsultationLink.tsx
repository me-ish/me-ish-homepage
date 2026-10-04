"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";

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
    <div className={`${ui.card} mx-auto max-w-lg space-y-4 text-center`}>
      <span aria-hidden="true" className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF0F6] text-[#BE185D]">
        <MailCheck className="h-6 w-6" />
      </span>
      <p className={`${ui.phrase} ${ui.body} ${ui.muted}`}>リンクの期限が切れている場合は、元の問い合わせ先メールアドレスに新しいリンクを送れます。</p>
      <button type="button" onClick={() => void renew()} disabled={busy || done} className={ui.btnPrimary}>
        {busy ? "送信中…" : done ? "送信しました" : "新しいリンクをメールで受け取る"}
      </button>
      {done ? <p role="status" className={ui.alertSuccess}>メールをご確認ください。</p> : null}
      {error ? <p role="alert" className={ui.alertError}>{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";

const problem: Record<number, string> = {
  404: "このラフが見つかりませんでした。ページを再読み込みしてください。",
  409: "この相談は終了しているため、OKを送れません。",
};

/** Records the client's "このラフでOK". It is only a progress note: quote approval and payment stay on their own pages. */
export default function TalkRoughOkButton({ token, roughId, label }: { token: string; roughId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!window.confirm("このラフで「OK」とお伝えします。直したい点がある場合は、OKを押さずに下のやり取りでお送りください。よろしいですか？")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/natori/consult/${encodeURIComponent(token)}/rough-ok`, {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ roughId }), cache: "no-store",
      });
      if (response.ok) { router.refresh(); return; }
      setError(problem[response.status] ?? "送れませんでした。時間をおいて、もう一度お試しください。");
    } catch { setError("送れませんでした。通信状況をご確認のうえ、もう一度お試しください。"); }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={send} disabled={busy} className={ui.btnPrimary}>{busy ? "送っています…" : label}</button>
      {error ? <p role="alert" className={`mt-2 ${ui.alertError}`}>{error}</p> : null}
    </div>
  );
}

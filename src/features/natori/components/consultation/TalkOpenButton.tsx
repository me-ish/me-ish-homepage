"use client";

import { useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";
import type { TalkOpenTarget } from "@/features/natori/types/talk";

const problem: Record<number, string> = {
  409: "いまは開けません。メールのリンクを使うか、下のトークでご連絡ください。",
  429: "短時間に開きすぎました。しばらくしてからもう一度お試しください。",
};

/** Asks the server for a fresh quote / delivery link and goes there. The approval itself happens on that page. */
export default function TalkOpenButton({ token, target, label }: { token: string; target: TalkOpenTarget; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/natori/consult/${encodeURIComponent(token)}/open`, {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ target }), cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => null);
      const path = data && typeof data === "object" && "path" in data && typeof data.path === "string" ? data.path : null;
      if (response.ok && path && path.startsWith("/natori/")) { window.location.assign(path); return; }
      setError(problem[response.status] ?? "開けませんでした。時間をおいて、もう一度お試しください。");
    } catch { setError("開けませんでした。通信状況をご確認のうえ、もう一度お試しください。"); }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={open} disabled={busy} className={ui.btnPrimary}>{busy ? "開いています…" : label}</button>
      {error ? <p role="alert" className={`mt-2 ${ui.alertError}`}>{error}</p> : null}
    </div>
  );
}

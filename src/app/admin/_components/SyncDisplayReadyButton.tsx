// src/app/admin/_components/SyncDisplayReadyButton.tsx
"use client";

import { useState } from "react";

export function SyncDisplayReadyButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/admin/api/entries/sync-display-ready", {
        method: "POST",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      setResult(`updated: ${json.updated}, skipped: ${json.skipped}`);
    } catch (e: any) {
      setResult(`error: ${e?.message ?? "unknown"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center rounded-full border border-[#d9e6f2] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[#f7fbff] disabled:opacity-60"
      >
        {loading ? "同期中…" : "display_ready を同期"}
      </button>
      {result ? <span className="text-xs text-[#667]">{result}</span> : null}
    </div>
  );
}

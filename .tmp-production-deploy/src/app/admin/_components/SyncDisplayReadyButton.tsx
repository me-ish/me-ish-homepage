// src/app/admin/_components/SyncDisplayReadyButton.tsx
"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function SyncDisplayReadyButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/admin/api/entries/sync-display-ready", {
        method: "POST",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      setResult({ updated: json.updated, skipped: json.skipped });
      // 3秒後にリセット
      setTimeout(() => setResult(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "エラーが発生しました");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 transition"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            処理中…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            展示を有効化
          </>
        )}
      </button>
      {result && (
        <span className="text-sm text-emerald-600">
          {result.updated > 0 ? `${result.updated}件を有効化しました` : "有効化対象がありません"}
        </span>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

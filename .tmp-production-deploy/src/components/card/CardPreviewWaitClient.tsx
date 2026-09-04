// src/components/card/CardPreviewWaitClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  requestId: string;
};

type ApiResponse = {
  ok: boolean;
  status?: "pending" | "ready" | "error";
  error?: string;
};

export default function CardPreviewWaitClient({ requestId }: Props) {
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!requestId) {
      setError("requestId が指定されていません。URL を確認してください。");
      return;
    }

    let cancelled = false;
    const abort = new AbortController();

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const res = await fetch(`/api/card/request/${requestId}`, {
          cache: "no-store",
          signal: abort.signal,
        });

        if (!res.ok) {
          setError("サーバーとの通信に失敗しました。再読み込みしてください。");
          return;
        }

        const data = (await res.json()) as ApiResponse;

        if (data.ok && data.status === "ready") {
          window.location.replace(`/card/preview/${requestId}`);
          return;
        }

        if (!data.ok && data.status === "error") {
          setError(
            data.error ??
              "カード生成中にエラーが発生しました。再読み込みしてください。",
          );
          return;
        }

        if (!cancelled) setTries((t) => t + 1);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (!cancelled) {
          setError("ネットワークエラーが発生しました。再読み込みしてください。");
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      abort.abort();
      clearInterval(interval);
    };
  }, [requestId]);

  useEffect(() => {
    if (tries >= 15 && !error) {
      setError(
        "生成に時間がかかっています。数十秒待っても変化がない場合は再読み込みしてください。",
      );
    }
  }, [tries, error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-6" />
      <h1 className="text-xl font-bold text-slate-800">
        カードを生成中です...
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        デザインを準備しています。数秒お待ちください。
      </p>
      <p className="mt-4 text-xs text-slate-400">retry: {tries}</p>

      {error && (
        <div className="mt-6">
          <p className="whitespace-pre-line text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-sky-500 px-5 py-2 text-sm text-white hover:bg-sky-600 transition-colors"
          >
            再読み込み
          </button>
        </div>
      )}
    </main>
  );
}

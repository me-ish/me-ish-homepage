// src/app/aura/preview/[id]/PreviewWaitClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id?: string;
  requestId?: string;
};

type ApiResponse =
  | { ok: boolean; status?: "pending" | "ready" | "error"; error?: string }
  | undefined;

export default function PreviewWaitClient(props: Props) {
  const requestId = useMemo(() => props.requestId ?? props.id ?? "", [props]);

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
      if (cancelled) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;

      try {
        const res = await fetch(`/api/aura/request/${requestId}`, {
          cache: "no-store",
          signal: abort.signal,
        });

        if (!res.ok) {
          setError(
            "サーバーとの通信に失敗しました。少し時間をおいて再読み込みしてください。",
          );
          return;
        }

        const data = (await res.json()) as ApiResponse;

        if (!data) {
          setError("サーバーから不正な応答が返されました。");
          return;
        }

        if (data.ok && (data.status === "ready" || !data.status)) {
          window.location.replace(`/aura/preview/${requestId}`);
          return;
        }

        if (!data.ok && data.status === "error") {
          setError(
            data.error ??
              "ポートフォリオ生成中にエラーが発生しました。再読み込みしてやり直してください。",
          );
          return;
        }

        if (!cancelled) {
          setTries((t) => t + 1);
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;

        if (!cancelled) {
          setError(
            "ネットワークエラーが発生しました。接続状況を確認してから再読み込みしてください。",
          );
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
        "生成データの取得に時間がかかっています。数十秒待っても変化がない場合は、ページを再読み込みしてください。",
      );
    }
  }, [tries, error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="text-lg font-semibold">生成中です…</div>
      <p className="mt-2 text-sm text-gray-600">
        作品データを保存・反映しています。数秒お待ちください。
      </p>
      <p className="mt-4 text-xs text-gray-400">retry: {tries}</p>

      {error && (
        <div className="mt-6">
          <p className="whitespace-pre-line text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded bg-black px-4 py-2 text-sm text-white"
          >
            再読み込み
          </button>
        </div>
      )}
    </main>
  );
}

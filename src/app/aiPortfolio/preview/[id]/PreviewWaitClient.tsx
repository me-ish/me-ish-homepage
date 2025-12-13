// src/app/aiPortfolio/preview/[id]/PreviewWaitClient.tsx
"use client";

import { useEffect, useState } from "react";

export default function PreviewWaitClient({ id }: { id: string }) {
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(`/api/aiPortfolio/request/${id}`, {
          cache: "no-store",
        });

        // ネットワーク/サーバー系の本当のエラー
        if (!res.ok) {
          setError("サーバーとの通信に失敗しました。少し時間をおいて再読み込みしてください。");
          return;
        }

        const data = (await res.json()) as
          | { ok: boolean; status?: "pending" | "ready" | "error"; error?: string }
          | undefined;

        if (!data) {
          setError("サーバーから不正な応答が返されました。");
          return;
        }

        // ★ 準備完了 → プレビューを更新
        if (data.ok && (data.status === "ready" || !data.status)) {
          window.location.reload();
          return;
        }

        // ★ 明確な失敗
        if (!data.ok && data.status === "error") {
          setError(
            data.error ??
              "ポートフォリオ生成中にエラーが発生しました。再読み込みしてやり直してください。"
          );
          return;
        }

        // ★ pending → 次の tick へ
        if (!cancelled) {
          setTries((t) => t + 1);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            "ネットワークエラーが発生しました。接続状況を確認してから再読み込みしてください。"
          );
        }
      }
    };

    const interval = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  // 一定回数以上リトライしたらメッセージを出す
  useEffect(() => {
    if (tries >= 15 && !error) {
      setError(
        "生成データの取得に時間がかかっています。数十秒待っても変化がない場合は、ページを再読み込みしてください。"
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
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
          <button
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

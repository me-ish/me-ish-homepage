"use client";
import { useCallback, useEffect, useState } from "react";
import type { NatoriNotificationList } from "@/features/natori/types/notifications";

const names: Record<string, string> = {
  quote_accept_artist: "見積もり承諾のお知らせ",
  delivery_accept_artist: "受取完了のお知らせ",
  delivery_accept_client: "依頼者への受取控え",
};
const statuses: Record<string, string> = {
  pending: "送信待ち", sending: "送信処理中", sent: "送信サービス受付済み", failed: "送信できませんでした", unknown: "送信結果を確認できません",
};
export default function NotificationStatusPanel() {
  const [data, setData] = useState<NatoriNotificationList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (offset = 0) => {
    const response = await fetch(`/api/natori/admin/notifications?offset=${offset}`, { cache: "no-store" });
    if (!response.ok) throw new Error("read");
    setData(await response.json());
  }, []);
  useEffect(() => { void refresh().catch(() => setError("メール通知の状態を取得できませんでした。")); }, [refresh]);
  const run = async (id?: string, offset = data?.offset ?? 0) => {
    setBusy(true); setError("");
    try {
      if (id) {
        const result = await fetch("/api/natori/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" }, body: JSON.stringify({ id }) });
        if (!result.ok) throw new Error("retry");
      }
      await refresh(offset);
    } catch { setError("通知の状態を確認できませんでした。少し待って「状態を更新」を押してください。承諾・受取の記録は変更されません。"); }
    finally { setBusy(false); }
  };
  return <NotificationStatusView data={data} error={error} busy={busy} run={run} />;
}

/** Shared rendering lets the bounded verification page exercise the actual mobile UI. */
export function NotificationStatusView({ data, error, busy, run }: {
  data: NatoriNotificationList | null;
  error: string;
  busy: boolean;
  run: (id?: string, offset?: number) => Promise<void>;
}) {
  if (data?.enabled === false) return null;
  if (!data && !error) return null;
  return <section aria-labelledby="notification-heading" aria-busy={busy} className="mt-6 rounded-2xl border border-pink-100 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="notification-heading" className="font-bold">承諾・受取のメール通知</h2>
      <button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => void run()}>状態を更新</button>
    </div>
    <p className="mt-2 text-sm text-gray-600">メールだけを再試行できます。承諾や受取完了の記録は変更されません。「受付済み」は送信サービスの受付を示し、相手の受信を保証する表示ではありません。</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {data && !data.sendingEnabled && <p className="mt-2 text-sm text-amber-800">通知送信を一時停止しています。</p>}
    {data?.notifications.length === 0 && <p className="mt-3 text-sm">新しい通知はありません。導入前のメール履歴はここには表示されません。</p>}
    <ul aria-live="polite" className="mt-3 space-y-3">
      {data?.notifications.map(item => <li key={item.id} className="rounded-xl border p-3 text-sm">
        <p className="break-words font-bold">{item.projectTitle}：{names[item.purpose] ?? "通知"}</p>
        <p>{item.reviewRequired ? "送信状況の確認が必要です。自動の再送は停止しています。" : statuses[item.status] ?? "確認が必要です"}</p>
        <p className="text-xs text-gray-500">最終受付：{item.lastSentAt ? new Date(item.lastSentAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "まだありません"}</p>
        {item.retryAvailable && <button className="mt-2 rounded-lg border border-pink-300 px-3 py-2 disabled:opacity-50" disabled={busy || !data.sendingEnabled} onClick={() => void run(item.id)}>メールだけ再試行</button>}
      </li>)}
    </ul>
    {data && (data.offset > 0 || data.truncated) && <div className="mt-3 flex gap-3 text-sm">
      <button disabled={busy || data.offset === 0} className="rounded-lg border px-3 py-2 disabled:opacity-50" onClick={() => void run(undefined, Math.max(0, data.offset - 50))}>前の通知</button>
      <button disabled={busy || !data.truncated} className="rounded-lg border px-3 py-2 disabled:opacity-50" onClick={() => void run(undefined, data.offset + 50)}>次の通知</button>
    </div>}
  </section>;
}

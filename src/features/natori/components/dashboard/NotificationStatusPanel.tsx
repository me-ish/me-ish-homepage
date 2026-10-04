"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import type { NatoriNotificationList } from "@/features/natori/types/notifications";

const names: Record<string, string> = {
  quote_accept_artist: "見積もり承諾のお知らせ",
  delivery_accept_artist: "受取完了のお知らせ",
  delivery_accept_client: "依頼者への受取控え",
  delivery_issue_client: "納品のご案内",
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
  return <section aria-labelledby="notification-heading" aria-busy={busy} className={`mt-6 rounded-2xl ${natoriAdminUi.surface} p-4 sm:p-5`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={natoriAdminUi.iconTileNeutral}>
          <Mail className="h-5 w-5" aria-hidden />
        </span>
        <h2 id="notification-heading" className="text-sm font-semibold text-zinc-900">承諾・受取のメール通知</h2>
      </div>
      <button type="button" className={natoriAdminUi.btnSecondary} disabled={busy} onClick={() => void run()}>
        <RefreshCw className={`h-4 w-4 text-zinc-500 ${busy ? "motion-safe:animate-spin" : ""}`} aria-hidden />
        状態を更新
      </button>
    </div>
    <p className="mt-3 text-xs leading-5 text-zinc-600">メールだけを再試行できます。承諾や受取完了の記録は変更されません。「受付済み」は送信サービスの受付を示し、相手の受信を保証する表示ではありません。</p>
    {error && <p role="alert" className={`${natoriAdminUi.alert.error} mt-3`}>{error}</p>}
    {data && !data.sendingEnabled && <p className={`${natoriAdminUi.alert.warning} mt-3`}>通知送信を一時停止しています。</p>}
    {data?.notifications.length === 0 && <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-600">新しい通知はありません。導入前のメール履歴はここには表示されません。</p>}
    <ul aria-live="polite" className="mt-3 space-y-2">
      {data?.notifications.map(item => <li key={item.id} className="rounded-xl border border-zinc-200/80 p-3 text-sm text-zinc-800">
        <p className="break-words font-semibold text-zinc-900">{item.projectTitle}：{names[item.purpose] ?? "通知"}</p>
        <p className="mt-0.5">{item.reviewRequired ? "送信状況の確認が必要です。自動の再送は停止しています。" : statuses[item.status] ?? "確認が必要です"}</p>
        <p className="mt-0.5 text-xs text-zinc-500">最終受付：{item.lastSentAt ? new Date(item.lastSentAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "まだありません"}</p>
        {item.retryAvailable && <button type="button" className={`${natoriAdminUi.btnSecondary} mt-2`} disabled={busy || !data.sendingEnabled} onClick={() => void run(item.id)}>メールだけ再試行</button>}
      </li>)}
    </ul>
    {data && (data.offset > 0 || data.truncated) && <div className="mt-3 flex gap-2 text-sm">
      <button type="button" disabled={busy || data.offset === 0} className={natoriAdminUi.btnSecondary} onClick={() => void run(undefined, Math.max(0, data.offset - 50))}>前の通知</button>
      <button type="button" disabled={busy || !data.truncated} className={natoriAdminUi.btnSecondary} onClick={() => void run(undefined, data.offset + 50)}>次の通知</button>
    </div>}
  </section>;
}

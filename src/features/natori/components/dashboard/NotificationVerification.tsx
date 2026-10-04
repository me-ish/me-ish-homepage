"use client";
import Link from "next/link";
import { useState } from "react";
import { NotificationStatusView } from "./NotificationStatusPanel";
import { VERIFICATION_PURPOSES, type NotificationVerificationResult, type VerificationPurpose } from "@/features/natori/types/notificationVerification";
import type { NatoriNotificationList } from "@/features/natori/types/notifications";

const initial: NatoriNotificationList = { enabled: true, sendingEnabled: true, truncated: false, offset: 0,
  notifications: VERIFICATION_PURPOSES.map(purpose => ({ id: purpose, projectId: "verification-only", projectTitle: "架空案件のメール確認",
    purpose, status: "pending", attemptNo: 1, lastSentAt: null, retryAvailable: false, reviewRequired: false })) };

export default function NotificationVerification() {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const send = async (purpose: VerificationPurpose | "all") => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/natori/admin/notification-verification", { method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" }, body: JSON.stringify({ purpose }) });
      if (!response.ok) throw new Error("send");
      const result = await response.json() as { results: NotificationVerificationResult[] };
      setData(previous => ({ ...previous, notifications: previous.notifications.map(row => {
        const item = result.results.find(entry => entry.purpose === row.purpose);
        if (!item) return row;
        // Preserve evidence observed in this page if a later replay is uncertain.
        if (row.status === "sent" && item.status !== "sent") return row;
        return { ...row, status: item.status, lastSentAt: row.lastSentAt ?? item.acceptedAt, retryAvailable: item.status !== "sent" };
      }) }));
      setMessage(result.results.every(item => item.status === "sent")
        ? "送信サービスが受け付けました。受信箱でメールが届いたか確認してください。"
        : "受付を確認できないメールがあります。同じメールだけを再試行できます。");
    } catch { setError("送信結果を確認できませんでした。少し待って同じ確認を再試行してください。"); }
    finally { setBusy(false); }
  };
  const run = async (id?: string) => {
    if (id && VERIFICATION_PURPOSES.includes(id as VerificationPurpose)) { await send(id as VerificationPurpose); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/natori/admin/notification-verification", { cache: "no-store" });
      if (!response.ok) throw new Error("closed");
      setMessage("確認画面を利用できます。下の結果は、この画面で確認したメールの受付状況です。");
    } catch { setError("確認用の受付は終了しています。通常の案件管理は引き続き利用できます。"); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/natori/dashboard" className="text-sm underline">管理ホームへ戻る</Link>
    <h1 className="mt-5 text-2xl font-bold">メール通知の確認</h1>
    <p className="mt-3 text-sm leading-relaxed">ナトリ先生のいつもの通知先へ、見積もり承諾・受取完了・受取控えの確認メールを3通送ります。すべて架空案件のテストです。</p>
    <p className="mt-2 text-sm leading-relaxed">同じ確認を押し直しても、新しいメールを追加しない設定です。結果はこの画面を開いている間の記録です。再読み込み後の再確認も同じ3通を使います。</p>
    <button disabled={busy} onClick={() => void send("all")} className="mt-5 rounded-xl bg-[#EC4899] px-5 py-3 font-bold text-white disabled:opacity-50">確認メール3通を送る</button>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <p className="mt-6 text-sm text-zinc-600">以下は新しい通知欄と同じ表示です。iPhoneで文字・ボタンが切れず、「状態を更新」を押せることも確認してください。</p>
    <NotificationStatusView data={data} error={error} busy={busy} run={run} />
  </main>;
}

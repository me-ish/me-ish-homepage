"use client";

import { useState } from "react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import type { ConsultationMessage, StaffRoughOk } from "../../types/consultation";

const statuses = { pending: "通知は送信待ち", sending: "通知は送信処理中", sent: "通知は送信サービス受付済み", failed: "通知を送信できませんでした", unknown: "通知の送信結果を確認できません" };
const date = (value: string) => new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));

export default function RoughOkFollowups({ rows, messages, closed, actionsAllowed, busy, sendingEnabled, onAction }: {
  messages: ConsultationMessage[];
  rows: StaffRoughOk[] | null; closed: boolean; actionsAllowed: boolean; busy: boolean; sendingEnabled: boolean;
  onAction: (id: string, action: "acknowledge" | "retry-notification") => Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (rows === null) return <p role="alert" className={natoriAdminUi.alert.warning}>ラフOKの確認状況を取得できません。履歴を更新してください。</p>;
  if (!rows.length) return null;
  const messagesById = new Map(messages.map(message => [message.id, message]));
  return <section aria-label="ラフOKの確認" className="space-y-2 rounded-xl border border-pink-200 bg-pink-50/50 p-3">
    <h4 className="text-sm font-semibold text-zinc-900">ラフOKの確認</h4>
    <p className="text-xs leading-5 text-zinc-600">依頼者のOKは記録済みです。ラフごとに次の対応を確認してください。メールの再試行と確認済みの操作は別です。</p>
    {rows.map(row => <div key={row.id} className="rounded-xl border border-zinc-200 bg-white p-3" data-rough-ok={row.id}>
      <p className="text-sm font-semibold text-zinc-900">{row.beforeQuote ? "参考ラフ" : "ラフ"} · OK {date(row.okAt)}</p>
      <p className="mt-1 break-words text-xs text-zinc-600">{messagesById.get(row.messageId)?.files[0]?.name ?? messagesById.get(row.messageId)?.body.slice(0, 80)}</p>
      <a href={`#consultation-message-${row.messageId}`} className={`text-xs font-semibold text-pink-800 underline underline-offset-4 ${natoriAdminUi.focusRing}`}>このラフの提出内容を見る</a>
      <p className="mt-1 text-xs font-semibold text-pink-800">{row.acknowledgedAt ? `次の対応は確認済み ${date(row.acknowledgedAt)}` : closed ? "終了案件・ラフOK確認待ち" : "ラフOK・次の対応待ち"}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{row.notificationStatus ? statuses[row.notificationStatus] : "導入前のOK記録です。通知履歴はありません。"}{row.reviewRequired ? " · 送信状況の確認が必要です。自動再送は停止しています。" : ""}</p>
      {row.notificationId && !sendingEnabled && actionsAllowed ? <p className="mt-1 text-xs text-amber-800">通知送信を一時停止しています。</p> : null}
      {closed && actionsAllowed && !row.acknowledgedAt ? <p className="mt-1 text-xs text-zinc-600">確認済みにしても、相談の終了状態は変わりません。</p> : null}
      {actionsAllowed && !row.acknowledgedAt ? confirmId === row.id ? <div className="mt-2 space-y-2">
        <p className="text-xs font-semibold text-zinc-800">このラフOKの次の対応を確認済みにしますか？</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={natoriAdminUi.btnPrimary} onClick={() => void onAction(row.id, "acknowledge").then(() => setConfirmId(null))}>このラフOKを確認済みにする</button>
          <button type="button" disabled={busy} className={natoriAdminUi.btnSecondary} onClick={() => setConfirmId(null)}>戻る</button>
        </div>
      </div> : <button type="button" disabled={busy} className={`${natoriAdminUi.btnSecondary} mt-2`} onClick={() => setConfirmId(row.id)}>このラフの次の対応を確認</button> : null}
      {actionsAllowed && row.retryAvailable ? <button type="button" disabled={busy || !sendingEnabled} className={`${natoriAdminUi.btnSecondary} ml-2 mt-2`} onClick={() => void onAction(row.id, "retry-notification")}>このラフOKのメールだけ再試行</button> : null}
    </div>)}
  </section>;
}

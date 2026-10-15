"use client";
import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { readNotificationAttention, subscribeNotificationAttention } from "./notificationSummaryStore";

/** ダッシュボード上部の件数表示。未送信・要確認のメール通知があるときだけ出し、通知パネルへ移動できる。 */
export default function NotificationAlertBanner() {
  const attention = useSyncExternalStore(subscribeNotificationAttention, readNotificationAttention, () => null);
  if (!attention || attention.unresolved === 0) return null;
  return <div role="status" className={`${natoriAdminUi.alert.warning} mt-4 flex flex-wrap items-center gap-x-3 gap-y-1`}>
    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
    <span>
      届いていないかもしれないメールが {attention.unresolved} 件あります
      {attention.reviewRequired > 0 ? `（うち送信状況の確認が必要 ${attention.reviewRequired} 件）` : ""}。
    </span>
    <a href="#notification-heading" className="font-bold underline">通知の一覧を見る</a>
  </div>;
}

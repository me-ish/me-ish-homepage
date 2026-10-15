import type { NatoriNotificationList } from "../types/notifications";

export type NotificationAttention = { unresolved: number; reviewRequired: number; partial: boolean };

/** 未送信・失敗・結果不明の通知の件数。送信サービスが受け付けた（sent）ものは数えない。 */
export function summarizeNotificationAttention(list: NatoriNotificationList | null): NotificationAttention | null {
  if (!list || !list.enabled) return null;
  const open = list.notifications.filter(item => item.status !== "sent");
  return { unresolved: open.length, reviewRequired: open.filter(item => item.reviewRequired).length, partial: list.truncated };
}

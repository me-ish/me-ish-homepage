import type { NotificationAttention } from "@/features/natori/lib/notificationSummary";

// 通知パネルが取得した結果を、ダッシュボード上部の件数表示と共有する（追加の通信はしない）。
let current: NotificationAttention | null = null;
const listeners = new Set<() => void>();

export function publishNotificationAttention(next: NotificationAttention | null) {
  if (current?.unresolved === next?.unresolved && current?.reviewRequired === next?.reviewRequired && current?.partial === next?.partial) return;
  current = next;
  listeners.forEach(listener => listener());
}
export const subscribeNotificationAttention = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const readNotificationAttention = () => current;

// features/natori/data/pageEvents.ts
// ナトリ公開ページのクリック計測（ブラウザ側）。
// 自前の /api/natori/track に記録しつつ、GA4 が入っていれば同じイベントを送る。
// 計測はすべて fire-and-forget（失敗してもUIに影響させない）。
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import {
  NATORI_PAGE_EVENT_LABEL_MAX_LENGTH,
  type NatoriPageEventName,
} from "@/features/natori/lib/pageEvents";

export type { NatoriPageEventName } from "@/features/natori/lib/pageEvents";

export function trackNatoriPageEvent(event: NatoriPageEventName, label: string): void {
  try {
    // エトリエのデモ環境（/etorie/*）からの操作はナトリの実解析に混ぜない
    if (window.location.pathname.includes("/etorie")) return;
    const safeLabel = label.slice(0, NATORI_PAGE_EVENT_LABEL_MAX_LENGTH);
    void fetch("/api/natori/track", {
      method: "POST",
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ event, label: safeLabel, path: window.location.pathname }),
      // リンク遷移の直前でも送信が完了するように
      keepalive: true,
    }).catch(() => {});

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", event, { event_label: safeLabel });
    }
  } catch {
    // 計測失敗は無視
  }
}

export type NatoriPageEventCount = {
  event: string;
  label: string;
  last30Days: number;
  last90Days: number;
};

export type NatoriPageEventSummary = {
  counts: NatoriPageEventCount[];
  truncated: boolean;
};

/** ダッシュボード用の集計を取得（要ナトリ管理アクセス） */
export async function fetchNatoriPageEventSummary(): Promise<NatoriPageEventSummary> {
  const response = await fetch("/api/natori/admin/page-events", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch page events (${response.status})`);
  }
  return (await response.json()) as NatoriPageEventSummary;
}

// features/natori/data/pageEvents.ts
// ナトリ公開ページのクリック計測（ブラウザ側）。
// 自前の /api/natori/track に記録しつつ、GA4 が入っていれば同じイベントを送る。
// 計測はすべて fire-and-forget（失敗してもUIに影響させない）。
import { CSRF_HEADERS } from "@/lib/auth/csrf";

export type NatoriPageEventName =
  | "links_click"
  | "portfolio_sns_click"
  | "portfolio_plan_click"
  | "portfolio_form_submit";

export function trackNatoriPageEvent(event: NatoriPageEventName, label: string): void {
  try {
    void fetch("/api/natori/track", {
      method: "POST",
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ event, label, path: window.location.pathname }),
      // リンク遷移の直前でも送信が完了するように
      keepalive: true,
    }).catch(() => {});

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === "function") {
      gtag("event", event, { event_label: label });
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

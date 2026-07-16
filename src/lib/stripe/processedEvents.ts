import "server-only";

// Stripe Webhook のイベント単位 dedup。
// processed_stripe_events(event_id primary key) への
// insert ... on conflict do nothing を「処理権の獲得」として使う:
//   - 挿入できた       → このリクエストが処理する（claimed）
//   - 衝突で挿入 0 件   → 二重配送。何もせず 200 ACK してよい（duplicate）
//   - insert 自体の失敗 → DB 障害。500 を返して Stripe に再送させる（error）
// 処理が一時エラーで失敗した場合は releaseStripeEvent で行を消してから 500 を
// 返すこと。消し忘れると、再送が duplicate 扱いになりイベントを取りこぼす。
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClaimStripeEventResult = "claimed" | "duplicate" | "error";

export async function claimStripeEvent(
  eventId: string
): Promise<ClaimStripeEventResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("processed_stripe_events")
    .upsert(
      { event_id: eventId },
      { onConflict: "event_id", ignoreDuplicates: true }
    )
    .select("event_id");

  if (error) {
    console.error("[webhook/stripe] event claim failed:", { eventId, error });
    return "error";
  }
  return data && data.length > 0 ? "claimed" : "duplicate";
}

/**
 * claim 済みイベントの処理が一時エラーで失敗したときに呼び、Stripe の再送で
 * リトライできるようにする。削除に失敗した場合は再送が空振りになるため、
 * ログから手動リカバリする（呼び出し側はどのみち 500 を返してよい）。
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("processed_stripe_events")
    .delete()
    .eq("event_id", eventId);
  if (error) {
    console.error("[webhook/stripe] event release failed (manual recovery needed):", {
      eventId,
      error,
    });
  }
}

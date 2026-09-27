import "server-only";
import {
  buildAcceptanceNotificationPayload,
  sendAcceptanceNotification,
  type NotificationTransport,
} from "./acceptanceNotifications";
import { VERIFICATION_PURPOSES, type VerificationPurpose, type NotificationVerificationResult } from "../types/notificationVerification";

// This ONE campaign was explicitly authorized on 2026-09-27. Never extend its
// window or rotate its keys to bypass an unknown delivery result. The 9-hour
// window is shorter than Resend's 24-hour idempotency retention.
const OPEN = Date.parse("2026-09-27T09:00:00Z");
const CLOSE = Date.parse("2026-09-27T18:00:00Z");
const CAMPAIGN = "natori-phase-n-verification-20260927-v1";
const RECIPIENT = "natori.o0716@gmail.com";
const FROM = "ナトリ（me-ish） <noreply@me-ish.art>";

export function notificationVerificationAvailable(): boolean {
  const now = Date.now();
  return process.env.NATORI_NOTIFICATION_VERIFY_ENABLED === "1"
    && process.env.VERCEL_ENV === "production" && now >= OPEN && now < CLOSE;
}

export async function verifyNotificationMail(
  selection: VerificationPurpose | "all",
  transport: NotificationTransport = sendAcceptanceNotification,
): Promise<NotificationVerificationResult[]> {
  if (!notificationVerificationAvailable()) throw new Error("verification_closed");
  // Validate EVERY destination before the first provider request. No request
  // input can supply an address, content, URL, project ID or idempotency key.
  if (process.env.NATORI_PORTFOLIO_CONTACT_TO?.trim() !== RECIPIENT
      || process.env.NATORI_ORDER_MAIL_FROM?.trim() !== FROM
      || process.env.NATORI_MAIL_BCC?.trim()) throw new Error("verification_configuration");
  if (selection !== "all" && !VERIFICATION_PURPOSES.includes(selection)) throw new Error("verification_selection");
  const purposes = selection === "all" ? VERIFICATION_PURPOSES : [selection];
  const requests = purposes.map(purpose => {
    const payload = buildAcceptanceNotificationPayload({ purpose, payload: null, snapshot: {
      title: "Phase N 通知確認用の架空案件", clientName: "テスト用（対応不要）",
      amount: 100, clientEmail: RECIPIENT,
    } });
    payload.subject = `【テスト・対応不要】${payload.subject}`;
    payload.text = "これはナトリ先生に許可いただいたメール到着確認です。実際のご依頼・承諾・納品・請求ではありません。対応やお支払いは不要です。\n\n" + payload.text;
    if (payload.to.length !== 1 || payload.to[0] !== RECIPIENT || payload.bcc?.length
        || payload.reply_to !== RECIPIENT || payload.from !== FROM) throw new Error("verification_destination");
    return { purpose, payload };
  });
  const results: NotificationVerificationResult[] = [];
  for (const { purpose, payload } of requests) {
    if (!notificationVerificationAvailable()) throw new Error("verification_closed");
    const result = await transport(payload, `${CAMPAIGN}/${purpose}`).catch(() => ({ status: "unknown" as const, errorCode: "provider_unknown" }));
    results.push({ purpose, status: result.status, acceptedAt: result.status === "sent" ? new Date().toISOString() : null });
  }
  // No DB client, business RPC, notification row, file, customer data or token is used.
  // Provider IDs, key, payload and recipient are deliberately absent from the response/logs.
  return results;
}

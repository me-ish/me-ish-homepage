import "server-only";

export type PublicIntakeMetricCode =
  | "structured_flag_disabled"
  | "structured_payload_invalid"
  | "structured_owner_unavailable"
  | "structured_reference_invalid"
  | "structured_upload_invalid"
  | "structured_upload_failed"
  | "structured_create_unresolved"
  | "structured_create_rejected"
  | "structured_mail_sent"
  | "structured_mail_failed"
  | "structured_mail_skipped"
  | "structured_auto_reply_sent"
  | "structured_auto_reply_failed"
  | "structured_auto_reply_skipped"
  | "structured_accepted";

/**
 * Log-drain aggregation用の固定形式。自由入力、ID、path、メールアドレスは受け取らない。
 */
export function recordPublicIntakeMetric(code: PublicIntakeMetricCode): void {
  console.info(
    JSON.stringify({
      metric: "natori_public_intake",
      code,
      count: 1,
    })
  );
}

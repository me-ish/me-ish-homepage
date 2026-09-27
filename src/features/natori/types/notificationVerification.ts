export const VERIFICATION_PURPOSES = ["quote_accept_artist", "delivery_accept_artist", "delivery_accept_client"] as const;
export type VerificationPurpose = typeof VERIFICATION_PURPOSES[number];
export type NotificationVerificationResult = {
  purpose: VerificationPurpose;
  status: "sent" | "failed" | "unknown";
  acceptedAt: string | null;
};

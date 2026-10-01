export type NatoriPaymentOverview = {
  available: boolean;
  confirmedAt: string | null;
  requiresReview: boolean;
  processing: boolean;
  linkState?: string;
  linkDeadline?: string | null;
};
export type NatoriPaymentAttention = {
  projectId: string | null;
  title: string;
  status: "processing" | "needs_review";
  reason: string | null;
};

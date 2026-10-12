export type NatoriPaymentOverview = {
  available: boolean;
  confirmedAt: string | null;
  requiresReview: boolean;
  processing: boolean;
  linkState?: string;
  linkDeadline?: string | null;
  /** Sanitized public payment page from the same read as linkState/deadline. */
  linkUrl?: string | null;
};

/** Display facts only: a successful no-row read is distinct from a failed read. */
export type NatoriPaymentLinkFact =
  | { kind: "unavailable" | "absent" }
  | { kind: "legacy"; url: string | null; deadline: null }
  | { kind: "generation"; state: string; url: string | null; deadline: string | null };

export type NatoriClientPaymentFacts = {
  overview?: NatoriPaymentOverview;
  confirmedAt?: string | null;
  link?: NatoriPaymentLinkFact;
};
export type NatoriPaymentAttention = {
  projectId: string | null;
  title: string;
  status: "processing" | "needs_review" | "pending";
  reason: string | null;
};

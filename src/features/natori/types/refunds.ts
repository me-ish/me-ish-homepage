/** Owner-scoped read model; null means the ledger is unavailable, never zero confirmed refunds. */
export type NatoriRefundSummary = {
  available: true;
  originalMapped: boolean;
  confirmedAmount: number | null;
  pendingCount: number;
  reviewCount: number;
};

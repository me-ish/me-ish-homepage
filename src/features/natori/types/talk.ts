/** Display-only types for the status cards shown above the consultation thread. */

export type TalkQuoteFact = {
  id: string;
  version: number;
  amount: number;
  issuedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  supersededAt: string | null;
};

export type TalkPaymentFact = {
  confirmedAt: string | null;
  /** Stripe Payment Link currently usable according to the stored link rows; null when none. */
  linkUrl: string | null;
  linkDeadline: string | null;
  /** A payment is being confirmed; the client must not pay twice. */
  processing: boolean;
};

export type TalkDeliveryFact = {
  /** A delivery release (or a legacy delivery token) exists. */
  exists: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  fileCount: number | null;
};

export type TalkFacts = {
  quotes: TalkQuoteFact[];
  payment: TalkPaymentFact;
  delivery: TalkDeliveryFact;
};

export type TalkBadgeTone = "action" | "done" | "wait" | "muted";

export type TalkCard = {
  id: string;
  kind: "quote" | "payment" | "delivery";
  title: string;
  badge: { label: string; tone: TalkBadgeTone };
  /** Large figure line, e.g. the amount. */
  amount?: string;
  lines: string[];
  /** Only the payment card has a button in this stage. */
  action?: { label: string; href: string };
};

export type TalkStep = { key: "quote" | "payment" | "delivery"; label: string; done: boolean };

export type TalkTimeline = { cards: TalkCard[]; steps: TalkStep[] };

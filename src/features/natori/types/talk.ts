/** Display-only types for the status cards shown above the consultation thread. */
import type { NatoriClientPaymentFacts } from "./payment";

export type TalkQuoteFact = {
  id: string;
  version: number;
  amount: number;
  issuedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  supersededAt: string | null;
};

export type TalkPaymentFact = NatoriClientPaymentFacts;

export type TalkDeliveryFact = {
  /** A delivery release (or a legacy delivery token) exists. */
  exists: boolean;
  expiresAt: string | null;
  acceptedAt: string | null;
  fileCount: number | null;
  /** A delivery release exists, so a fresh download link can be minted. Legacy single-token deliveries cannot. */
  openable: boolean;
};

export type TalkRoughFact = {
  id: string;
  messageId: string;
  /** No quote existed yet when the rough was marked ("参考ラフ（見積もり前）"). */
  beforeQuote: boolean;
  createdAt: string;
  /** When the client pressed "このラフでOK"; null while unanswered. */
  okAt: string | null;
};

export type TalkFacts = {
  /** False when the project is closed or deleted: no card may offer an action. */
  linksAllowed: boolean;
  quotes: TalkQuoteFact[];
  /** Absent while the rough table is unavailable; roughs never block the other cards. */
  roughs?: TalkRoughFact[];
  payment: TalkPaymentFact;
  delivery: TalkDeliveryFact;
};

export type TalkOpenTarget = "quote" | "delivery";

export type TalkBadgeTone = "action" | "done" | "wait" | "muted";

export type TalkCard = {
  id: string;
  kind: "quote" | "payment" | "delivery" | "rough";
  title: string;
  badge: { label: string; tone: TalkBadgeTone };
  /** Large figure line, e.g. the amount. */
  amount?: string;
  lines: string[];
  /** Identifies the submitted rough and links to the message containing its files. */
  roughReference?: { label: string; messageId: string; openable: boolean };
  /** `href` goes straight to the stored Stripe page; `open` asks the server for a fresh quote / delivery link; `roughOk` records the client's OK for that rough. */
  action?: { label: string; href: string } | { label: string; open: TalkOpenTarget } | { label: string; roughOk: string };
};

export type TalkStep = { key: "quote" | "payment" | "delivery"; label: string; done: boolean };

export type TalkTimeline = { cards: TalkCard[]; steps: TalkStep[] };

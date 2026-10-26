import type { NatoriProjectStatus, NatoriProjectType, NatoriTaskStage } from "./projects";

/**
 * Management-only, DB-independent input contract. A future authorized reader must
 * supply a complete domain from one consistent snapshot. Never construct these
 * facts from status labels, next_action, message text or missing UI DTO fields.
 */
export type CaseObservation<T> =
  | { state: "ready"; snapshotId: string; observedAt: string; revision: string; value: T }
  | { state: "absent"; snapshotId: string; observedAt: string; revision: string }
  | { state: "not_requested" }
  | { state: "unavailable"; reason: "read_failed" | "unsupported" | "incomplete"; lastKnown?: CaseKnown<T> };

export type CaseKnown<T> = {
  observedAt: string;
  revision: string;
  value: T;
};

export type CaseFact = {
  id: string;
  projectId: string;
  revision: string;
  recordedAt: string;
  source: "ledger" | "legacy_projection" | "manual_record" | "historical_registration";
};

export type CaseMoney = { amount: number; currency: string };
export type CaseTarget = {
  kind: "quote" | "payment_link" | "delivery" | "rough" | "consultation";
  id: string;
  /**
   * Canonical conditions identity: quote version, or exact effective deadline.
   * A future adapter must derive the SAME identity from the object and notice
   * snapshot; do not invent a revision number absent from a legacy payload.
   */
  revision: string;
};

export type CaseProjectFact = CaseFact & {
  rawStatus: NatoriProjectStatus;
  type: NatoriProjectType;
  archivedAt: string | null;
  /** Must come from explicit origin/registration evidence, never from rawStatus. */
  origin: "internal" | "external" | "legacy" | "historical" | "unknown";
  administrativeAmount: CaseMoney | null;
};

export type CaseQuoteFact = CaseFact & {
  version: number;
  state: "draft" | "issued" | "superseded";
  money: CaseMoney;
  validUntil: string | null;
  acceptance: null | {
    quoteId: string;
    version: number;
    acceptedAt: string;
    money: CaseMoney;
  };
};

export type CasePaymentLinkFact = CaseFact & {
  /** Existing successful same-link mail defines terms, never live provider state. */
  termsPolicy?: "sent_plus_7_days";
  quoteId: string | null;
  quoteVersion: number | null;
  generation: number | null;
  deadlineRevision: string;
  money: CaseMoney | null;
  expiresAt: string | null;
  state: "active" | "preparing" | "stopping" | "stopped" | "failed" | "unknown";
  /** Explicit read evidence, not a provider call made by this reducer. */
  providerState: "active" | "inactive" | "unverified";
};

export type CasePaymentFact = CaseFact & {
  confirmedAt: string;
  /** Unknown amount is not zero. The receipt of money may still be confirmed. */
  money: CaseMoney | null;
  method: "stripe" | "manual" | "historical" | "unclassified";
};

export type CaseFinancialReviewFact = CaseFact & {
  kind: "payment_processing" | "payment_review" | "refund_pending" | "refund_review" | "refund_confirmed";
};

export type CaseNotificationAttempt = CaseFact & {
  target: CaseTarget;
  purpose: "quote_notice" | "payment_notice" | "delivery_notice" | "receipt_notice"
    | "rough_notice" | "consultation_notice" | "staff_notice";
  notificationKey: string;
  attemptNo: number;
  operationId: string | null;
  status: "pending" | "sending" | "sent" | "failed" | "unknown" | "state_error";
  sentAt: string | null;
  /** Explicit successor evidence. A later success alone must not erase unknown. */
  resolvedByAttemptId: string | null;
};

export type CaseOperationFact = CaseFact & {
  target: CaseTarget;
  state: "pending" | "processing" | "failed" | "unknown" | "succeeded";
};

export type CaseProductionFact = CaseFact & {
  stage: NatoriTaskStage;
  tasks: ReadonlyArray<{ id: string; done: boolean }>;
  /** Verified metadata only. No Storage calls or file URLs in this contract. */
  files: "ready" | "absent" | "pending" | "failed" | "unverified";
};

export type CaseRoughFact = CaseFact & {
  beforeQuote: boolean;
  clientOkAt: string | null;
  acknowledgedAt: string | null;
  revisionPending?: boolean;
  supersededBy?: string;
};

export type CaseDeliveryFact = CaseFact & {
  kind: "release" | "legacy";
  manifest: "verified" | "unverified";
  expiresAt: string | null;
  expiryRevision: string;
  /** Explicit R2 provenance; absent preserves the established legacy display. */
  noticeRequired?: true;
};

export type CaseReceiptFact = CaseFact & {
  deliveryId: string;
  acceptedAt: string;
};

export type CaseConsultationFact = CaseFact & {
  /** Only explicit unread/response evidence, never text classification. */
  responseRequired: boolean;
};

export type CaseSnapshot = {
  projectId: string;
  snapshotId: string;
  /** Injected time; the reducer never consults a clock. */
  asOf: string;
  project: CaseObservation<CaseProjectFact>;
  /** This domain is the explicitly selected current quote, not latest-by-date. */
  quote: CaseObservation<CaseQuoteFact>;
  link: CaseObservation<CasePaymentLinkFact>;
  payment: CaseObservation<CasePaymentFact>;
  financialReview: CaseObservation<ReadonlyArray<CaseFinancialReviewFact>>;
  notifications: CaseObservation<ReadonlyArray<CaseNotificationAttempt>>;
  operations: CaseObservation<ReadonlyArray<CaseOperationFact>>;
  production: CaseObservation<CaseProductionFact>;
  roughs: CaseObservation<ReadonlyArray<CaseRoughFact>>;
  delivery: CaseObservation<CaseDeliveryFact>;
  receipt: CaseObservation<CaseReceiptFact>;
  consultation: CaseObservation<CaseConsultationFact>;
  /**
   * No external-evidence ledger is implemented in this phase. An absent internal
   * quote is not proof of no external agreement. Keep this boundary explicit.
   */
  externalEvidence: { state: "unsupported" };
};

export type CaseDomain = Exclude<keyof CaseSnapshot, "projectId" | "snapshotId" | "asOf" | "externalEvidence">;

export type CaseActionId =
  | "view_case" | "view_consultation" | "refresh_facts" | "review_evidence"
  | "check_operation" | "review_notification" | "prepare_quote"
  | "prepare_payment_notice" | "view_payment" | "open_production"
  | "review_rough" | "prepare_delivery" | "view_delivery" | "extend_delivery";

export type CaseBlockReason =
  | "facts_not_current" | "inconsistent_facts" | "inactive_case"
  | "historical_record" | "external_evidence_unsupported" | "legacy_evidence_required"
  | "quote_required" | "agreement_required" | "payment_recorded"
  | "payment_required" | "link_already_exists" | "unresolved_operation"
  | "financial_review" | "notification_attention" | "production_required"
  | "delivery_already_exists" | "delivery_required" | "receipt_recorded"
  | "files_not_verified" | "type_required" | "delivery_stage_required";

/** These are preparation/navigation suggestions, NEVER authorization to execute. */
export type CaseAction = {
  id: CaseActionId;
  available: boolean;
  blockedBy: readonly CaseBlockReason[];
  execution: "read_only" | "requires_command_revalidation";
};

export type CaseAttention = {
  key: string;
  domain: CaseDomain | "externalEvidence";
  targetId: string;
  reason: string;
  waitingOn: "staff" | "client" | "system";
  priority: 0 | 1 | 2 | 3 | 4;
  action: CaseActionId;
};

export type CaseNotificationSummary = {
  target: CaseTarget;
  /** Same object, possibly an earlier conditions/deadline revision. */
  pastSuccessIds: readonly string[];
  currentSuccessIds: readonly string[];
  latestAttemptId: string | null;
  unresolvedIds: readonly string[];
  failedIds: readonly string[];
  projectionReviewIds: readonly string[];
  invalidEvidenceIds: readonly string[];
};

export type CaseReadModel = {
  projectId: string;
  snapshotId: string;
  checkedAt: string;
  /** Deterministic change token, not a security/command concurrency token. */
  fingerprint: string;
  eligibility: "active" | "closed" | "archived" | "completed" | "historical" | "unknown";
  stage: "unknown" | "consultation" | "quote_draft" | "quote_issued"
    | "quote_accepted" | "payment_available" | "payment_notified" | "paid"
    | "delivery_issued" | "received" | "historical_record" | "existing_completion";
  agreement: "accepted" | "unaccepted" | "absent" | "needs_review" | "unknown";
  linkValidity: "active" | "recorded" | "expired" | "inactive" | "needs_review" | "absent" | "unknown";
  /** Known facts are kept even when the newest read fails; status explains freshness. */
  facts: Pick<CaseSnapshot, CaseDomain | "externalEvidence">;
  notifications: readonly CaseNotificationSummary[];
  attention: readonly CaseAttention[];
  primary: CaseActionId;
  actions: readonly CaseAction[];
  issues: readonly { domain: CaseDomain; code: string; targetId: string }[];
};

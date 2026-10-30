import type { CaseMoney, CaseObservation, CasePaymentFact, CaseReadModel } from "./caseReadModel";
import type { NatoriProjectStatus, NatoriProjectType, NatoriTaskStage } from "./projects";

/** Read-only display evidence. These fields never grant command permission. */
export type CaseDisplayEvidence = {
  project: CaseObservation<{
    id: string; rawStatus: NatoriProjectStatus; type: NatoriProjectType;
    archivedAt: string | null; origin: "internal" | "unknown";
  }>;
  tasks: CaseObservation<ReadonlyArray<{ id: string; stage: NatoriTaskStage; done: boolean }>>;
  conversation: CaseObservation<{ latestSender: "staff" | "client"; latestAt: string }>;
  payment: CaseObservation<{
    confirmedAt: string; money: CaseMoney | null; method: CasePaymentFact["method"] | "project_projection";
    correspondence: "matched" | "unconfirmed";
  }>;
  receipt: CaseObservation<{
    acceptedAt: string; deliveryId: string | null; correspondence: "matched" | "unconfirmed";
  }>;
};

export const CASE_SECTIONS = ["overview", "consultation", "transaction", "production", "history"] as const;
export type CaseSection = typeof CASE_SECTIONS[number];
export type CaseEntry = "cases" | "schedule" | "notifications";
export type CaseWorkspaceRecord = {
  id: string; title: string; clientLabel: string; registeredDueDate: string | null;
  model: CaseReadModel; display: CaseDisplayEvidence;
};
export type CaseGuidance = {
  status: string;
  facts: ReadonlyArray<{ label: string; value: string }>;
  waits: ReadonlyArray<{ key: string; who: "staff" | "client" | "system"; text: string; section: CaseSection }>;
  primary: { label: string; section: CaseSection };
  unknown: readonly string[];
};

/** One item of a case's その他 menu; only that item is shown. */
export type CaseOverviewPart = "request" | "decided" | "details" | "outside" | "lifecycle";

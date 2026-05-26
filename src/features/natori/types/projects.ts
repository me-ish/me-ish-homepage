export type NatoriProjectStatus =
  | "inquiry"
  | "estimating"
  // `consulting` is the legacy name for "依頼受付". Kept for back-compat with rows
  // inserted before the inquiry / estimating split (2026-05); treated like inquiry
  // everywhere in the app. New rows should use `inquiry`.
  | "consulting"
  | "quoted"
  | "awaiting_payment"
  | "rough"
  | "lineart"
  | "coloring"
  | "waiting"
  | "delivery_prep"
  | "delivered"
  | "completed";

export type NatoriProjectFilter = "all" | "active" | "waiting" | "done";

export type NatoriProjectType = "icon" | "sd" | "standing" | "illustration";

export type NatoriTaskStage =
  | "material"
  | "rough"
  | "lineart"
  | "coloring"
  | "finish"
  | "delivery";

export type NatoriProjectTask = {
  id: string;
  label: string;
  stage: NatoriTaskStage;
  done: boolean;
  estimatedHours?: number;
};

export type NatoriProjectPriority = "low" | "normal" | "high";

export type NatoriDeliveryPlan = "normal" | "rush_14_days" | "rush_7_days";

export type NatoriDeliveryPlanMeta = {
  id: NatoriDeliveryPlan;
  label: string;
  shortLabel: string;
  description: string;
  days: number;
  extraFee: number;
  isRush: boolean;
  chipClassName: string;
  softClassName: string;
  barAccentClassName: string;
  dotClassName: string;
};

export type NatoriProject = {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  startDate?: string;
  dueDate: string;
  deliveryPlan?: NatoriDeliveryPlan;
  status: NatoriProjectStatus;
  nextAction: string;
  type: NatoriProjectType;
  tasks: NatoriProjectTask[];
  priority?: NatoriProjectPriority;
  note?: string;
  paymentConfirmedAt?: string;
};

export type NatoriProjectStatusMeta = {
  label: string;
  chipClassName: string;
  cellClassName: string;
};

export type NatoriPriorityCandidate = {
  project: NatoriProject;
  score: number;
  reasons: string[];
};

export type NatoriStageMilestone = {
  stage: NatoriTaskStage;
  dateISO: string;
  allDone: boolean;
};

export type NatoriCalendarEntry =
  | { kind: "due"; project: NatoriProject }
  | {
      kind: "milestone";
      project: NatoriProject;
      stage: NatoriTaskStage;
      allDone: boolean;
    };

export type NatoriCalendarBar = {
  id: string;
  project: NatoriProject;
  stage: NatoriTaskStage;
  startISO: string;
  endISO: string;
};

export type NatoriCalendarCellBar = {
  bar: NatoriCalendarBar;
  isStart: boolean;
  isEnd: boolean;
  isOverdue: boolean;
};

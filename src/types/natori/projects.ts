export type NatoriProjectStatus =
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
};

export type NatoriProjectPriority = "low" | "normal" | "high";

export type NatoriProject = {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: NatoriProjectStatus;
  nextAction: string;
  type: NatoriProjectType;
  tasks: NatoriProjectTask[];
  priority?: NatoriProjectPriority;
  note?: string;
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

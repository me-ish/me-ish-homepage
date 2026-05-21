export type NatoriProjectStatus = "consulting" | "rough" | "lineart" | "coloring" | "waiting" | "delivered";

export type NatoriProjectFilter = "all" | "active" | "waiting" | "done";

export type NatoriProject = {
  id: string;
  title: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: NatoriProjectStatus;
  nextAction: string;
  note?: string;
};

export type NatoriProjectStatusMeta = {
  label: string;
  chipClassName: string;
};

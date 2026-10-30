import { CheckCircle2, Circle, CreditCard, FileText, MessageCircle, Package, PenLine, type LucideIcon } from "lucide-react";
import type { CaseStepKey } from "../../lib/caseSteps";

// One rounded square per stage, like the icons in a settings list. Colour shows the stage at a glance.
const STAGE_ICONS: Record<CaseStepKey, { icon: LucideIcon; bg: string }> = {
  consultation: { icon: MessageCircle, bg: "bg-[#0A84FF]" },
  quote: { icon: FileText, bg: "bg-[#5E5CE6]" },
  payment: { icon: CreditCard, bg: "bg-[#BF5AF2]" },
  production: { icon: PenLine, bg: "bg-[#FF9F0A]" },
  delivery: { icon: Package, bg: "bg-[#30B158]" },
  receipt: { icon: CheckCircle2, bg: "bg-[#30B0C7]" },
};

export function CaseStageIcon({ stage, size = "md" }: { stage: CaseStepKey | null; size?: "sm" | "md" }) {
  const { icon: Icon, bg } = stage ? STAGE_ICONS[stage] : { icon: Circle, bg: "bg-[#8E8E93]" };
  const box = size === "sm" ? "h-7 w-7 rounded-[7px]" : "h-9 w-9 rounded-[9px]";
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center text-white ${box} ${bg}`}>
    <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} strokeWidth={2.2} />
  </span>;
}

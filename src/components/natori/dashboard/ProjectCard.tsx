import { CalendarDays, CircleDollarSign, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { natoriProjectStatusMeta } from "@/lib/natori/mockProjects";
import { cn } from "@/lib/utils";
import type { NatoriProject } from "@/types/natori/projects";

type ProjectCardProps = {
  project: NatoriProject;
};

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dueDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function formatDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return dueDateFormatter.format(date);
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const status = natoriProjectStatusMeta[project.status];

  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border-pink-100 bg-white shadow-sm shadow-pink-100/50">
      <CardContent className="p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-base font-black leading-6 text-pink-950 sm:text-lg">{project.title}</p>
              <p className="mt-1 break-words text-sm text-gray-500">{project.clientName}</p>
            </div>
            <Badge className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-bold shadow-none", status.chipClassName)}>
              {status.label}
            </Badge>
          </div>

          <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-pink-700">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              次やること
            </div>
            <p className="mt-1 break-words text-lg font-black leading-7 text-pink-950">{project.nextAction}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-pink-500" aria-hidden />
              <span className="shrink-0 text-gray-500">納期</span>
              <span className="min-w-0 break-words font-bold text-gray-900">{formatDueDate(project.dueDate)}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <CircleDollarSign className="h-4 w-4 shrink-0 text-pink-500" aria-hidden />
              <span className="shrink-0 text-gray-500">金額</span>
              <span className="min-w-0 break-words font-bold text-gray-900">{yenFormatter.format(project.amount)}</span>
            </div>
          </div>

          {project.note ? <p className="break-words text-sm leading-6 text-gray-600">{project.note}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

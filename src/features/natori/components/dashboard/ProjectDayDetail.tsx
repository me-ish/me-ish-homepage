"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarRange, Star } from "lucide-react";
import { getActiveBarsForDate, parseISODate } from "@/features/natori/lib/projects";
import { getRemindersForDate } from "@/features/natori/lib/reminders";
import { cn } from "@/lib/utils";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import ProjectCard from "./ProjectCard";
import PersonalEventsSection from "./PersonalEventsSection";
import type { NatoriEvent } from "@/features/natori/data/supabaseEvents";
import type { UpdateNatoriProjectDetailsInput } from "@/features/natori/data/supabaseProjects";
import type { NatoriProject } from "@/features/natori/types/projects";

function computeStickyProjectIds(
  allProjects: NatoriProject[],
  selectedISO: string,
  today: Date
): string[] {
  const dueIds = allProjects
    .filter((project) => project.dueDate === selectedISO)
    .map((project) => project.id);
  const activeIds = getActiveBarsForDate(allProjects, selectedISO, today).map(
    (entry) => entry.bar.project.id
  );
  return Array.from(new Set([...dueIds, ...activeIds]));
}

const detailDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

type ProjectDayDetailProps = {
  selectedISO: string;
  allProjects: NatoriProject[];
  today: Date;
  onToggleTask: (projectId: string, taskId: string) => void;
  onAdvanceStatus?: (project: NatoriProject) => void;
  onConfirmPayment?: (project: NatoriProject) => void;
  onOpenMail?: (project: NatoriProject, kind: "rough" | "delivery") => void;
  onEditDetails?: (
    project: NatoriProject,
    patch: UpdateNatoriProjectDetailsInput
  ) => Promise<void>;
  advanceBusyId?: string | null;
  events: NatoriEvent[];
  authed: boolean;
  eventsBusy: boolean;
  eventsError: string | null;
  onCreateEvent: (input: { title: string; date: string; note?: string }) => Promise<void>;
  onUpdateEvent: (
    id: string,
    input: { title: string; date: string; note?: string }
  ) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
};

export default function ProjectDayDetail({
  selectedISO,
  allProjects,
  today,
  onToggleTask,
  onAdvanceStatus,
  onConfirmPayment,
  onOpenMail,
  onEditDetails,
  advanceBusyId,
  events,
  authed,
  eventsBusy,
  eventsError,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: ProjectDayDetailProps) {
  const date = parseISODate(selectedISO);
  const dateLabel = detailDateFormatter.format(date);
  const activeBars = getActiveBarsForDate(allProjects, selectedISO, today);
  const deliveryEndBars = activeBars.filter(
    (entry) => entry.bar.stage === "delivery" && entry.isEnd
  );
  const reminders = getRemindersForDate(selectedISO);

  // Snapshot which projects should appear on this day at the moment the day was
  // selected, so that ticking off the last task of a stage does not make the
  // card disappear mid-edit. Resets when selectedISO changes.
  const [stickyProjectIds, setStickyProjectIds] = useState<string[]>(() =>
    computeStickyProjectIds(allProjects, selectedISO, today)
  );

  useEffect(() => {
    setStickyProjectIds(computeStickyProjectIds(allProjects, selectedISO, today));
    // Intentionally ignore allProjects/today so the snapshot only resets on day change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedISO]);

  const projectById = useMemo(
    () => new Map(allProjects.map((project) => [project.id, project])),
    [allProjects]
  );

  const cardProjects: NatoriProject[] = stickyProjectIds
    .map((id) => projectById.get(id))
    .filter((project): project is NatoriProject => Boolean(project));
  const dueProjects = cardProjects.filter((project) => project.dueDate === selectedISO);
  const activeOnlyProjects = cardProjects.filter((project) => project.dueDate !== selectedISO);

  return (
    <section className={`rounded-2xl ${natoriAdminUi.surface} p-4 sm:p-5 md:p-6`}>
      <div className="flex items-start gap-3">
        <span className={natoriAdminUi.iconTile}>
          <CalendarRange className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#BE185D]">Selected day</p>
          <p className="break-words text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">{dateLabel}</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-zinc-700">
            <span className={`${natoriAdminUi.badge} ${natoriAdminUi.badgeTone.neutral} font-medium`}>
              稼働中のタスク {activeBars.length} 件
            </span>
            <span className={`${natoriAdminUi.badge} ${natoriAdminUi.badgeTone.neutral} font-medium`}>
              納期 {dueProjects.length} 件
            </span>
          </p>
        </div>
      </div>

      <PersonalEventsSection
        selectedISO={selectedISO}
        events={events}
        authed={authed}
        busy={eventsBusy}
        error={eventsError}
        onCreate={onCreateEvent}
        onUpdate={onUpdateEvent}
        onDelete={onDeleteEvent}
      />

      {reminders.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {reminders.map((reminder) => (
            <li
              key={reminder.id}
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3 text-sm sm:p-4",
                reminder.bannerClassName
              )}
            >
              <Banknote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">{reminder.label}</p>
                {reminder.detail ? (
                  <p className="mt-0.5 break-words text-xs leading-5 opacity-90">
                    {reminder.detail}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {deliveryEndBars.length > 0 ? (
        <div className={`${natoriAdminUi.alert.success} mt-4 flex items-start gap-2 sm:p-4`}>
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">この日の納品 {deliveryEndBars.length} 件</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {deliveryEndBars.map((entry) => (
                <li
                  key={entry.bar.id}
                  className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/25"
                >
                  {entry.bar.project.clientName}｜{entry.bar.project.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {cardProjects.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
          この日に予定はありません。ゆっくり手を動かせます。
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {dueProjects.length > 0 ? (
            <p className="text-xs font-semibold text-zinc-600">
              この日が納期の案件
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {dueProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                today={today}
                onToggleTask={onToggleTask}
                onAdvanceStatus={onAdvanceStatus}
                onConfirmPayment={onConfirmPayment}
                onOpenMail={onOpenMail}
                onEditDetails={onEditDetails}
                advanceBusy={advanceBusyId === project.id}
              />
            ))}
          </div>
          {activeOnlyProjects.length > 0 ? (
            <>
              <div className="pt-2">
                <p className="text-xs font-semibold text-zinc-600">
                  この日に手を動かす案件
                </p>
                <p className={natoriAdminUi.caption}>
                  工程の更新・編集は納期日のカード、または一覧表示から行えます。
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeOnlyProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    today={today}
                    onToggleTask={onToggleTask}
                    onOpenMail={onOpenMail}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

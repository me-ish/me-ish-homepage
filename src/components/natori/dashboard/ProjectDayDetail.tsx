"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarRange, Star } from "lucide-react";
import { getActiveBarsForDate, parseISODate } from "@/lib/natori/projects";
import { getRemindersForDate } from "@/lib/natori/reminders";
import { cn } from "@/lib/utils";
import ProjectCard from "./ProjectCard";
import PersonalEventsSection from "./PersonalEventsSection";
import type { NatoriEvent } from "@/lib/natori/supabaseEvents";
import type { UpdateNatoriProjectDetailsInput } from "@/lib/natori/supabaseProjects";
import type { NatoriProject } from "@/types/natori/projects";

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
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
          <CalendarRange className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Selected day</p>
          <p className="break-words text-lg font-black text-gray-900 sm:text-xl">{dateLabel}</p>
          <p className="mt-1 text-xs text-gray-700">
            稼働中のタスク {activeBars.length} 件 / 納期 {dueProjects.length} 件
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
                "flex items-start gap-2 rounded-2xl border p-3 text-sm sm:p-4",
                reminder.bannerClassName
              )}
            >
              <Banknote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-black">{reminder.label}</p>
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
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 sm:p-4">
          <Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-black">この日の納品 {deliveryEndBars.length} 件</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {deliveryEndBars.map((entry) => (
                <li
                  key={entry.bar.id}
                  className="rounded-full border border-emerald-500 bg-white px-2 py-0.5 text-xs font-bold text-emerald-800"
                >
                  {entry.bar.project.clientName}｜{entry.bar.project.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {cardProjects.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800">
          この日に予定はありません。ゆっくり手を動かせます。
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {dueProjects.length > 0 ? (
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
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
                onEditDetails={onEditDetails}
                advanceBusy={advanceBusyId === project.id}
              />
            ))}
          </div>
          {activeOnlyProjects.length > 0 ? (
            <>
              <p className="pt-2 text-xs font-bold uppercase tracking-wide text-gray-600">
                この日に手を動かす案件
              </p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeOnlyProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    today={today}
                    onToggleTask={onToggleTask}
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mockNatoriProjects } from "@/lib/natori/mockProjects";
import {
  deriveNextActionFromTasks,
  deriveStatusFromTasks,
  getNextActionForStatus,
  getNextStatus,
  getPrioritySuggestions,
  toISODate,
} from "@/lib/natori/projects";
import { getAwaitingPaymentSummary } from "@/lib/natori/scheduling";
import {
  confirmNatoriProjectPayment,
  fetchNatoriProjects,
  seedNatoriDemoProjects,
  toggleNatoriTaskDone,
  updateNatoriProjectStatus,
} from "@/lib/natori/supabaseProjects";
import {
  createNatoriEvent,
  deleteNatoriEvent,
  fetchNatoriEvents,
  updateNatoriEvent,
  type NatoriEvent,
} from "@/lib/natori/supabaseEvents";
import { createClient } from "@/lib/supabase/client";
import type { NatoriPriorityCandidate, NatoriProject } from "@/types/natori/projects";
import ProjectMonthCalendar from "./ProjectMonthCalendar";
import ProjectDayDetail from "./ProjectDayDetail";
import ProjectPriorityList from "./ProjectPriorityList";
import AwaitingPaymentSummary from "./AwaitingPaymentSummary";

type ViewMonth = { year: number; monthIndex: number };

type DataSource = "loading" | "supabase" | "mock";

function getMonthFromDate(date: Date): ViewMonth {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export default function ProjectsBoard() {
  const [today, setToday] = useState<Date | null>(null);
  const [projects, setProjects] = useState<NatoriProject[]>([]);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<ViewMonth | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [authed, setAuthed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<NatoriEvent[]>([]);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [advanceBusyId, setAdvanceBusyId] = useState<string | null>(null);

  const loadFromSupabase = useCallback(async () => {
    const [projectData, eventData] = await Promise.all([
      fetchNatoriProjects(),
      fetchNatoriEvents().catch(() => [] as NatoriEvent[]),
    ]);
    setProjects(projectData);
    setEvents(eventData);
    setDataSource("supabase");
  }, []);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setSelectedISO(toISODate(now));
    setViewMonth(getMonthFromDate(now));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userData.user) {
          setAuthed(true);
          await loadFromSupabase();
        } else {
          setAuthed(false);
          setProjects(mockNatoriProjects);
          setDataSource("mock");
        }
      } catch (err) {
        console.error("[ProjectsBoard] Supabase load failed, falling back to mock", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setProjects(mockNatoriProjects);
        setDataSource("mock");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromSupabase]);

  const suggestions = useMemo<NatoriPriorityCandidate[]>(
    () => (today ? getPrioritySuggestions(projects, today, 3) : []),
    [projects, today]
  );

  const awaitingPaymentSummary = useMemo(
    () => getAwaitingPaymentSummary(projects),
    [projects]
  );

  if (!today || !selectedISO || !viewMonth || dataSource === "loading") {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-72 animate-pulse rounded-2xl bg-pink-50/60" />
      </div>
    );
  }

  const handleSelectDate = (iso: string) => {
    setSelectedISO(iso);
  };

  const handlePrevMonth = () => {
    setViewMonth((current) => {
      if (!current) return current;
      const next = new Date(current.year, current.monthIndex - 1, 1);
      return getMonthFromDate(next);
    });
  };

  const handleNextMonth = () => {
    setViewMonth((current) => {
      if (!current) return current;
      const next = new Date(current.year, current.monthIndex + 1, 1);
      return getMonthFromDate(next);
    });
  };

  const focusProject = (project: NatoriProject) => {
    const due = project.dueDate;
    setSelectedISO(due);
    const [y, m] = due.split("-").map(Number);
    setViewMonth({ year: y, monthIndex: m - 1 });
  };

  const handleSelectFromPriority = (candidate: NatoriPriorityCandidate) => {
    focusProject(candidate.project);
  };

  const handleToggleTask = (projectId: string, taskId: string) => {
    let nextStatus: NatoriProject["status"] | null = null;
    let nextAction = "";
    let nextDone = false;
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const nextTasks = project.tasks.map((task) => {
          if (task.id !== taskId) return task;
          nextDone = !task.done;
          return { ...task, done: nextDone };
        });
        nextStatus = deriveStatusFromTasks(nextTasks, project.status);
        nextAction = deriveNextActionFromTasks(nextTasks, project.nextAction);
        return {
          ...project,
          tasks: nextTasks,
          status: nextStatus,
          nextAction,
        };
      })
    );

    if (dataSource === "supabase") {
      (async () => {
        try {
          await toggleNatoriTaskDone(projectId, taskId, nextDone);
          if (nextStatus) {
            await updateNatoriProjectStatus(projectId, nextStatus, nextAction);
          }
        } catch (err) {
          console.error("[ProjectsBoard] Supabase task update failed", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
    }
  };

  const handleAdvanceStatus = (project: NatoriProject) => {
    const nextStatus = getNextStatus(project.status);
    if (nextStatus === project.status) return;
    const nextAction = getNextActionForStatus(nextStatus);
    setAdvanceBusyId(project.id);
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? { ...entry, status: nextStatus, nextAction }
          : entry
      )
    );
    if (dataSource === "supabase") {
      (async () => {
        try {
          await updateNatoriProjectStatus(project.id, nextStatus, nextAction);
        } catch (err) {
          console.error("[ProjectsBoard] advance status failed", err);
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
    }
  };

  const handleConfirmPayment = (project: NatoriProject) => {
    if (project.status !== "awaiting_payment") return;
    const nextAction = getNextActionForStatus("rough");
    const stampedAt = new Date().toISOString();
    setAdvanceBusyId(project.id);
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? {
              ...entry,
              status: "rough",
              nextAction,
              paymentConfirmedAt: stampedAt,
            }
          : entry
      )
    );
    if (dataSource === "supabase") {
      (async () => {
        try {
          await confirmNatoriProjectPayment(project.id, nextAction);
        } catch (err) {
          console.error("[ProjectsBoard] confirm payment failed", err);
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
    }
  };

  const handleCreateEvent = async (input: { title: string; date: string; note?: string }) => {
    if (!authed) {
      setEventsError("ログインが必要です。");
      throw new Error("ログインが必要です。");
    }
    setEventsBusy(true);
    setEventsError(null);
    try {
      const created = await createNatoriEvent(input);
      setEvents((current) => [...current, created]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEventsError(message);
      throw err;
    } finally {
      setEventsBusy(false);
    }
  };

  const handleUpdateEvent = async (
    id: string,
    input: { title: string; date: string; note?: string }
  ) => {
    if (!authed) {
      setEventsError("ログインが必要です。");
      throw new Error("ログインが必要です。");
    }
    setEventsBusy(true);
    setEventsError(null);
    try {
      await updateNatoriEvent(id, { ...input, note: input.note ?? null });
      setEvents((current) =>
        current.map((event) =>
          event.id === id ? { ...event, ...input } : event
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEventsError(message);
      throw err;
    } finally {
      setEventsBusy(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!authed) {
      setEventsError("ログインが必要です。");
      return;
    }
    setEventsBusy(true);
    setEventsError(null);
    try {
      await deleteNatoriEvent(id);
      setEvents((current) => current.filter((event) => event.id !== id));
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : String(err));
    } finally {
      setEventsBusy(false);
    }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    setError(null);
    try {
      const inserted = await seedNatoriDemoProjects();
      if (inserted === 0) {
        setError("既にデータが入っています。");
      }
      await loadFromSupabase();
    } catch (err) {
      console.error("[ProjectsBoard] seed failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  };

  const showSeedBanner = dataSource === "supabase" && projects.length === 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {dataSource === "mock" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
          {authed
            ? "Supabase からの読み込みに失敗したため、ローカルのデモデータを表示しています。"
            : "認証情報を確認できないため、ローカルのデモデータを表示しています。"}
          {error ? <p className="mt-1 text-[11px] opacity-80">{error}</p> : null}
        </div>
      ) : null}

      {showSeedBanner ? (
        <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-3 text-xs text-pink-900 sm:p-4 sm:text-sm">
          <p className="font-bold">まだ案件データがありません。</p>
          <p className="mt-1 opacity-90">
            動作確認用にデモデータを投入できます。すでに案件がある場合は何もしません。
          </p>
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seeding}
            className="mt-2 inline-flex h-9 items-center rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
          >
            {seeding ? "投入中…" : "デモデータを入れる"}
          </button>
          {error ? <p className="mt-2 text-[11px] opacity-80">{error}</p> : null}
        </div>
      ) : null}

      <AwaitingPaymentSummary
        summary={awaitingPaymentSummary}
        today={today}
        onSelect={focusProject}
        onConfirmPayment={handleConfirmPayment}
        busyId={advanceBusyId}
      />

      <ProjectPriorityList
        suggestions={suggestions}
        today={today}
        onSelect={handleSelectFromPriority}
      />

      <ProjectMonthCalendar
        year={viewMonth.year}
        monthIndex={viewMonth.monthIndex}
        projects={projects}
        events={events}
        today={today}
        selectedISO={selectedISO}
        onSelect={handleSelectDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <ProjectDayDetail
        selectedISO={selectedISO}
        allProjects={projects}
        today={today}
        onToggleTask={handleToggleTask}
        onAdvanceStatus={handleAdvanceStatus}
        onConfirmPayment={handleConfirmPayment}
        advanceBusyId={advanceBusyId}
        events={events}
        authed={authed}
        eventsBusy={eventsBusy}
        eventsError={eventsError}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </div>
  );
}

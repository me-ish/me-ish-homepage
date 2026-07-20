"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { mockNatoriProjects } from "@/features/natori/constants/mockProjects";
import {
  deriveNextActionFromTasks,
  deriveStatusFromTasks,
  getNextActionForStatus,
  getNextStatus,
  getPrioritySuggestions,
  isPreworkStatus,
  toISODate,
} from "@/features/natori/lib/projects";
import {
  confirmNatoriProjectPayment,
  deleteNatoriProject,
  fetchNatoriProjects,
  seedNatoriDemoProjects,
  toggleNatoriTaskDone,
  updateNatoriProjectDetails,
  updateNatoriProjectStatus,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import {
  createNatoriEvent,
  deleteNatoriEvent,
  fetchNatoriEvents,
  updateNatoriEvent,
  type NatoriEvent,
} from "@/features/natori/data/supabaseEvents";
import type { NatoriPriorityCandidate, NatoriProject } from "@/features/natori/types/projects";
import ProjectMonthCalendar from "./ProjectMonthCalendar";
import ProjectDayDetail from "./ProjectDayDetail";
import ProjectPriorityList from "./ProjectPriorityList";
import ClosedProjectsSection from "./ClosedProjectsSection";
import ProjectRegisterForm from "./ProjectRegisterForm";
import OrderMailPanel, { type OrderMailKind } from "./OrderMailPanel";

type ViewMonth = { year: number; monthIndex: number };

type DataSource = "loading" | "supabase" | "mock";

function getMonthFromDate(date: Date): ViewMonth {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

type ProjectsBoardProps = {
  /**
   * エトリエのデモ環境用。渡すとサーバーへは一切アクセスせず、
   * このデータをローカル状態として表示・操作する（mock モードと同じ扱い）。
   */
  demoProjects?: NatoriProject[];
  demoEvents?: NatoriEvent[];
  /** デモ環境でのメール定型文の名乗り（例: ユキノ）。省略時は既定のナトリ */
  demoArtistName?: string;
};

export default function ProjectsBoard({
  demoProjects,
  demoEvents,
  demoArtistName,
}: ProjectsBoardProps) {
  const isDemo = Boolean(demoProjects);
  const [today, setToday] = useState<Date | null>(null);
  const [mailTarget, setMailTarget] = useState<{
    project: NatoriProject;
    kind: OrderMailKind;
  } | null>(null);
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
    // デモ環境: サーバーに触らず渡されたデータをそのまま使う。
    // 以後の操作は dataSource !== "supabase" の分岐でローカル状態にのみ反映される。
    if (demoProjects) {
      setProjects(demoProjects);
      setEvents(demoEvents ?? []);
      setDataSource("mock");
      setAuthed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // 認可はサーバー API（合言葉キー / ログイン）に任せる。ここではまず
      // 読み込みを試み、失敗したときだけデモデータに落とす。
      try {
        await loadFromSupabase();
        if (cancelled) return;
        setAuthed(true);
      } catch (err) {
        console.error("[ProjectsBoard] server load failed, falling back to mock", err);
        if (cancelled) return;
        setAuthed(false);
        setError(err instanceof Error ? err.message : String(err));
        setProjects(mockNatoriProjects);
        setDataSource("mock");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromSupabase, demoProjects, demoEvents]);

  // 見送り（closed）はボード・カレンダー・優先度の対象から外し、
  // 折りたたみの「見送りした相談」にだけ出す。
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status !== "closed"),
    [projects]
  );
  const closedProjects = useMemo(
    () => projects.filter((project) => project.status === "closed"),
    [projects]
  );

  const suggestions = useMemo<NatoriPriorityCandidate[]>(
    () => (today ? getPrioritySuggestions(activeProjects, today, 3) : []),
    [activeProjects, today]
  );

  // 依頼受付〜入金待ちは問い合わせ管理ページに集約したので、ここでは件数だけ出す
  const preworkCount = useMemo(
    () => activeProjects.filter((project) => isPreworkStatus(project.status)).length,
    [activeProjects]
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
          if (!nextStatus) throw new Error("次の案件状態を計算できませんでした。");
          await toggleNatoriTaskDone(projectId, taskId, nextDone, nextStatus, nextAction);
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

  const handleReopenProject = (project: NatoriProject) => {
    const nextAction = getNextActionForStatus("inquiry");
    setAdvanceBusyId(project.id);
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id ? { ...entry, status: "inquiry", nextAction } : entry
      )
    );
    if (dataSource === "supabase") {
      (async () => {
        try {
          await updateNatoriProjectStatus(project.id, "inquiry", nextAction);
        } catch (err) {
          console.error("[ProjectsBoard] reopen project failed", err);
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
    }
  };

  const handleDeleteClosedProject = (project: NatoriProject) => {
    const confirmed = window.confirm(
      `「${project.clientName}｜${project.title}」を完全に削除します。メモも含めて元に戻せません。よろしいですか？`
    );
    if (!confirmed) return;
    setAdvanceBusyId(project.id);
    setProjects((current) => current.filter((entry) => entry.id !== project.id));
    if (dataSource === "supabase") {
      (async () => {
        try {
          await deleteNatoriProject(project.id);
        } catch (err) {
          console.error("[ProjectsBoard] delete closed project failed", err);
          setError(err instanceof Error ? err.message : String(err));
          try {
            await loadFromSupabase();
          } catch (reloadErr) {
            console.error("[ProjectsBoard] reload after delete failure failed", reloadErr);
          }
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
    }
  };

  const handleEditDetails = async (
    project: NatoriProject,
    patch: UpdateNatoriProjectDetailsInput
  ) => {
    // Apply optimistically so the card snaps to the new values; if the API
    // rejects, the catch block below restores from Supabase by re-fetching.
    setProjects((current) =>
      current.map((entry) => {
        if (entry.id !== project.id) return entry;
        return {
          ...entry,
          ...(patch.clientName !== undefined ? { clientName: patch.clientName.trim() } : null),
          ...(patch.title !== undefined ? { title: patch.title.trim() } : null),
          ...(patch.type !== undefined ? { type: patch.type } : null),
          ...(patch.amount !== undefined
            ? { amount: Math.max(0, Math.round(patch.amount)) }
            : null),
          ...(patch.deliveryPlan !== undefined ? { deliveryPlan: patch.deliveryPlan } : null),
          ...(patch.startDate !== undefined
            ? { startDate: patch.startDate ?? undefined }
            : null),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : null),
          ...(patch.note !== undefined ? { note: patch.note ?? undefined } : null),
        };
      })
    );

    if (dataSource !== "supabase") return;
    try {
      await updateNatoriProjectDetails(project.id, patch);
    } catch (err) {
      console.error("[ProjectsBoard] edit details failed", err);
      // Re-sync from the server so the optimistic state doesn't drift.
      try {
        await loadFromSupabase();
      } catch (reloadErr) {
        console.error("[ProjectsBoard] reload after edit failure failed", reloadErr);
      }
      throw err;
    }
  };

  const handleCreateEvent = async (input: { title: string; date: string; note?: string }) => {
    if (!authed) {
      setEventsError("デモ表示中は予定を編集できません。");
      throw new Error("デモ表示中は予定を編集できません。");
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
      setEventsError("デモ表示中は予定を編集できません。");
      throw new Error("デモ表示中は予定を編集できません。");
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
      setEventsError("デモ表示中は予定を編集できません。");
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
      {dataSource === "mock" && !isDemo ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
          サーバーからの読み込みに失敗したため、ローカルのデモデータを表示しています。合言葉付きのブックマークから開き直すか、時間をおいて再読み込みしてください。
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

      {authed ? (
        <ProjectRegisterForm
          mode="manual"
          onCreated={() => {
            if (dataSource === "supabase") {
              loadFromSupabase().catch((err) => {
                console.error("[ProjectsBoard] reload after register failed", err);
              });
            }
          }}
        />
      ) : null}

      {/* 依頼受付〜入金待ちの対応（メール送信・入金確認・見送り）は問い合わせ管理へ集約 */}
      {preworkCount > 0 ? (
        <Link
          href={isDemo ? "/etorie/demo/app/inquiries" : "/natori/inquiries"}
          className="flex items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-3 shadow-sm transition hover:bg-orange-50 sm:p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-500 text-white">
              <Inbox className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">
                問い合わせ・入金待ち {preworkCount}件
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                見積もり・支払い依頼メール・入金確認は問い合わせ管理ページで対応します。
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
        </Link>
      ) : null}

      <ProjectPriorityList
        suggestions={suggestions}
        today={today}
        onSelect={handleSelectFromPriority}
      />

      <ProjectMonthCalendar
        year={viewMonth.year}
        monthIndex={viewMonth.monthIndex}
        projects={activeProjects}
        events={events}
        today={today}
        selectedISO={selectedISO}
        showReminders={!isDemo}
        onSelect={handleSelectDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      <ProjectDayDetail
        selectedISO={selectedISO}
        allProjects={activeProjects}
        today={today}
        onToggleTask={handleToggleTask}
        onAdvanceStatus={handleAdvanceStatus}
        onConfirmPayment={handleConfirmPayment}
        onOpenMail={(project, kind) => setMailTarget({ project, kind })}
        onEditDetails={handleEditDetails}
        advanceBusyId={advanceBusyId}
        events={events}
        authed={authed}
        eventsBusy={eventsBusy}
        eventsError={eventsError}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />

      <ClosedProjectsSection
        projects={closedProjects}
        busyId={advanceBusyId}
        onReopen={handleReopenProject}
        onDelete={handleDeleteClosedProject}
      />

      {/* ラフ提出・納品メール送信パネル */}
      {mailTarget ? (
        <OrderMailPanel
          project={mailTarget.project}
          kind={mailTarget.kind}
          demoMode={isDemo}
          artistName={demoArtistName}
          onClose={() => setMailTarget(null)}
          onSent={() => {
            if (isDemo) {
              // デモ: 本物と同じステータス遷移をローカルにだけ反映
              const nextStatus = mailTarget.kind === "rough" ? "waiting" : "delivered";
              setProjects((current) =>
                current.map((entry) =>
                  entry.id === mailTarget.project.id
                    ? {
                        ...entry,
                        status: nextStatus,
                        nextAction: getNextActionForStatus(nextStatus),
                      }
                    : entry
                )
              );
              return;
            }
            loadFromSupabase().catch((err) => {
              console.error("[ProjectsBoard] reload after mail failed", err);
            });
          }}
        />
      ) : null}
    </div>
  );
}

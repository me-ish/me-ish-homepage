"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Inbox } from "lucide-react";
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
  fetchNatoriProjectCollection,
  restoreNatoriProject,
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
import ProjectCard from "./ProjectCard";
import ClosedProjectsSection from "./ClosedProjectsSection";
import ArchivedProjectsSection from "./ArchivedProjectsSection";
import ProjectRegisterForm from "./ProjectRegisterForm";
import OrderMailPanel, { type OrderMailKind } from "./OrderMailPanel";
import { NatoriLoadError } from "./NatoriLoadError";

type ViewMonth = { year: number; monthIndex: number };

type DataSource = "loading" | "supabase" | "mock" | "error";

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
  const [archivedProjects, setArchivedProjects] = useState<NatoriProject[]>([]);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<ViewMonth | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("loading");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<NatoriEvent[]>([]);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [advanceBusyId, setAdvanceBusyId] = useState<string | null>(null);

  const loadFromSupabase = useCallback(async () => {
    const [projectData, eventResult] = await Promise.all([
      fetchNatoriProjectCollection(),
      fetchNatoriEvents()
        .then((data) => ({ ok: true as const, data }))
        .catch((error: unknown) => ({ ok: false as const, error })),
    ]);
    setProjects(projectData.projects);
    setArchivedProjects(projectData.archivedProjects);
    if (eventResult.ok) {
      setEvents(eventResult.data);
      setEventsError(null);
    } else {
      console.error("[ProjectsBoard] event load failed", eventResult.error);
      setEventsError("予定だけ読み込めませんでした。案件データは最新です。");
    }
    setDataSource("supabase");
  }, []);

  const retryEvents = useCallback(async () => {
    setEventsBusy(true);
    setEventsError(null);
    try {
      setEvents(await fetchNatoriEvents());
    } catch (err) {
      console.error("[ProjectsBoard] event retry failed", err);
      setEventsError("予定の再読み込みに失敗しました。時間をおいて再試行してください。");
    } finally {
      setEventsBusy(false);
    }
  }, []);

  const loadServerData = useCallback(async () => {
    setDataSource("loading");
    setAuthed(false);
    setError(null);
    try {
      await loadFromSupabase();
      setAuthed(true);
    } catch (err) {
      console.error("[ProjectsBoard] server load failed", err);
      setProjects([]);
      setEvents([]);
      setError(err instanceof Error ? err.message : String(err));
      setDataSource("error");
    }
  }, [loadFromSupabase]);

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
      setArchivedProjects([]);
      setEvents(demoEvents ?? []);
      setDataSource("mock");
      setAuthed(false);
      setError(null);
      return;
    }
    // 認可はサーバー API（合言葉キー / ログイン）に任せる。
    // 失敗時は実データと誤認し得るデモデータを表示せず、再試行できるエラー画面にする。
    void loadServerData();
  }, [loadServerData, demoProjects, demoEvents]);

  const recoverFromMutationFailure = useCallback(
    async (operation: string, err: unknown) => {
      console.error(`[ProjectsBoard] ${operation} failed`, err);
      const message = err instanceof Error ? err.message : String(err);
      try {
        await loadFromSupabase();
        setError(`更新を保存できなかったため、サーバーの最新状態へ戻しました。${message}`);
      } catch (reloadErr) {
        console.error(`[ProjectsBoard] reload after ${operation} failure failed`, reloadErr);
        setError(`更新と再読み込みに失敗しました。画面を再読み込みしてください。${message}`);
      }
    },
    [loadFromSupabase]
  );

  // 見送り（closed）はボード・カレンダー・優先度の対象から外し、
  // 折りたたみの「見送りした相談」にだけ出す。
  const activeProjects = useMemo(
    () =>
      projects.filter(
        (project) => !project.deletedAt && project.status !== "closed"
      ),
    [projects]
  );
  const closedProjects = useMemo(
    () =>
      projects.filter(
        (project) => !project.deletedAt && project.status === "closed"
      ),
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
  const undatedProjects = useMemo(
    () => activeProjects.filter((project) => project.dueDate === null),
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

  if (dataSource === "error") {
    return (
      <NatoriLoadError
        resourceLabel="案件データ"
        error={error ?? "不明なエラー"}
        onRetry={() => void loadServerData()}
      />
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
    if (!due) return;
    setSelectedISO(due);
    const [y, m] = due.split("-").map(Number);
    setViewMonth({ year: y, monthIndex: m - 1 });
  };

  const handleSelectFromPriority = (candidate: NatoriPriorityCandidate) => {
    focusProject(candidate.project);
  };

  const handleToggleTask = (projectId: string, taskId: string) => {
    const project = projects.find((entry) => entry.id === projectId);
    const task = project?.tasks.find((entry) => entry.id === taskId);
    if (!project || !task) return;

    setError(null);
    const nextDone = !task.done;
    const nextTasks = project.tasks.map((entry) =>
      entry.id === taskId ? { ...entry, done: nextDone } : entry
    );
    const nextStatus = deriveStatusFromTasks(nextTasks, project.status);
    const nextAction = deriveNextActionFromTasks(nextTasks, project.nextAction);
    setProjects((current) =>
      current.map((entry) =>
        entry.id === projectId
          ? { ...entry, tasks: nextTasks, status: nextStatus, nextAction }
          : entry
      )
    );

    if (dataSource === "supabase") {
      (async () => {
        try {
          await toggleNatoriTaskDone(projectId, taskId, nextDone, nextStatus, nextAction);
        } catch (err) {
          await recoverFromMutationFailure("task update", err);
        }
      })();
    }
  };

  const handleAdvanceStatus = (project: NatoriProject) => {
    const nextStatus = getNextStatus(project.status);
    if (nextStatus === project.status) return;
    const nextAction = getNextActionForStatus(nextStatus);
    setError(null);
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
          await recoverFromMutationFailure("status update", err);
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
    setError(null);
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
          await recoverFromMutationFailure("payment confirmation", err);
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
    setError(null);
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
          await recoverFromMutationFailure("project reopen", err);
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
      `「${project.clientName}｜${project.title}」を案件一覧から削除します。データと画像は保持され、あとで復元できます。よろしいですか？`
    );
    if (!confirmed) return;
    setAdvanceBusyId(project.id);
    setProjects((current) => current.filter((entry) => entry.id !== project.id));
    if (dataSource === "supabase") {
      (async () => {
        try {
          await deleteNatoriProject(project.id);
          setArchivedProjects((current) => [
            { ...project, deletedAt: new Date().toISOString() },
            ...current.filter((entry) => entry.id !== project.id),
          ]);
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

  const handleRestoreArchivedProject = (project: NatoriProject) => {
    setAdvanceBusyId(project.id);
    setError(null);
    setArchivedProjects((current) => current.filter((entry) => entry.id !== project.id));
    if (dataSource === "supabase") {
      (async () => {
        try {
          await restoreNatoriProject(project.id);
          await loadFromSupabase();
        } catch (err) {
          await recoverFromMutationFailure("project restore", err);
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

  return (
    <div className="space-y-4 md:space-y-6">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 sm:p-4 sm:text-sm"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 font-bold underline underline-offset-2"
          >
            閉じる
          </button>
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

      {eventsError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:p-4 sm:text-sm"
        >
          <p>{eventsError}</p>
          <button
            type="button"
            onClick={() => void retryEvents()}
            disabled={eventsBusy}
            className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 font-bold hover:bg-amber-100 disabled:opacity-60"
          >
            {eventsBusy ? "再読込中…" : "予定を再読込"}
          </button>
        </div>
      ) : null}

      {undatedProjects.length > 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-700 text-white">
              <CalendarClock className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-black text-gray-900">
                納期未定の案件 {undatedProjects.length}件
              </h2>
              <p className="mt-0.5 text-xs text-gray-600">
                一覧には保持し、納期が決まるまでカレンダーと負荷計算から除外します。
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {undatedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                today={today}
                onToggleTask={handleToggleTask}
                onAdvanceStatus={handleAdvanceStatus}
                onConfirmPayment={handleConfirmPayment}
                onOpenMail={(entry, kind) =>
                  setMailTarget({ project: entry, kind })
                }
                onEditDetails={handleEditDetails}
                advanceBusy={advanceBusyId === project.id}
              />
            ))}
          </div>
        </section>
      ) : null}

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

      <ArchivedProjectsSection
        projects={archivedProjects}
        busyId={advanceBusyId}
        onRestore={handleRestoreArchivedProject}
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

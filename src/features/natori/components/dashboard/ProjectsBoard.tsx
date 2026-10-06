"use client";

import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { useOptionalNatoriToast } from "@/features/natori/components/admin/NatoriToast";
import { useNatoriConfirm } from "@/features/natori/components/admin/useNatoriConfirm";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import { canTransitionNatoriStatus } from "@/features/natori/lib/statusTransitions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarDays, Inbox, List, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
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
  NatoriTaskConflictError,
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
import type { NatoriPriorityCandidate, NatoriProject, NatoriProjectStatus } from "@/features/natori/types/projects";
import {applyTaskProjection,overlayTaskIntents,mergeProjectCollection,previewProductionTasks,type TaskIntent} from "../../lib/taskProjection";
import ProjectMonthCalendar from "./ProjectMonthCalendar";
import ProjectDayDetail from "./ProjectDayDetail";
import ProjectPriorityList from "./ProjectPriorityList";
import ProjectCard from "./ProjectCard";
import ProjectListView from "./ProjectListView";
import ClosedProjectsSection from "./ClosedProjectsSection";
import ArchivedProjectsSection from "./ArchivedProjectsSection";
import ProjectRegisterForm from "./ProjectRegisterForm";
import OrderMailPanel, { type OrderMailKind } from "./OrderMailPanel";
import { NatoriLoadError } from "./NatoriLoadError";
import { cn } from "@/lib/utils";

type ViewMonth = { year: number; monthIndex: number };

type BoardView = "calendar" | "list";
const VIEW_STORAGE_KEY = "natori-projects-view";

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
  const { confirm, confirmDialog } = useNatoriConfirm();
  const { showToast } = useOptionalNatoriToast();
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
  const [view, setView] = useState<BoardView>("calendar");
  const [registerOpen, setRegisterOpen] = useState(false);
  // ?project={id} の直リンク: 読み込み後に一度だけ該当案件へ寄せ、数秒だけ枠で示す
  const pendingFocusId = useRef<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const taskSequence = useRef(0);
  const taskIntents = useRef(new Map<string, Map<string, TaskIntent>>());
  // Store confirmed rows separately from local checkbox intents.
  const canonicalProjects = useRef(new Map<string, NatoriProject>());
  const publishCanonicalProjects = useCallback(() => {
    const all = [...canonicalProjects.current.values()];
    setProjects(all.filter(project => !project.deletedAt)
      .map(project => overlayTaskIntents(project, taskIntents.current.get(project.id))));
    setArchivedProjects(all.filter(project => Boolean(project.deletedAt)));
  }, []);

  const loadFromSupabase = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const startedRevisions = new Map([...canonicalProjects.current].map(([id, project]) => [id, project.mutationRevision ?? -1]));
    const [projectData, eventResult] = await Promise.all([
      fetchNatoriProjectCollection(),
      fetchNatoriEvents()
        .then((data) => ({ ok: true as const, data }))
        .catch((error: unknown) => ({ ok: false as const, error })),
    ]);
    if (sequence !== loadSequence.current) return;
    const incoming = [...projectData.projects, ...projectData.archivedProjects];
    const merged = mergeProjectCollection([...canonicalProjects.current.values()], incoming,
      startedRevisions, new Set(taskIntents.current.keys()));
    canonicalProjects.current = new Map(merged.map(project => [project.id, project]));
    publishCanonicalProjects();
    if (eventResult.ok) {
      setEvents(eventResult.data);
      setEventsError(null);
    } else {
      console.error("[ProjectsBoard] event load failed", eventResult.error);
      setEventsError("予定だけ読み込めませんでした。案件データは最新です。");
    }
    setDataSource("supabase");
  }, [publishCanonicalProjects]);

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
    // 表示切替は端末ごとの好みなので localStorage に残す。読めなければ既定（カレンダー）のまま。
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "calendar" || saved === "list") setView(saved);
    } catch {
      /* private mode などで使えない場合は既定のまま */
    }
  }, []);

  useEffect(() => {
    try {
      pendingFocusId.current = new URLSearchParams(window.location.search).get("project");
    } catch {
      pendingFocusId.current = null;
    }
  }, []);

  const changeView = useCallback((next: BoardView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* 保存できなくても表示は切り替わる */
    }
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

  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id || !today || (dataSource !== "supabase" && dataSource !== "mock")) return;
    pendingFocusId.current = null;
    const target = activeProjects.find((project) => project.id === id);
    if (!target) {
      showToast("リンク先の案件が見つかりませんでした。見送り・削除された可能性があります。");
      return;
    }
    // 一覧表示は折りたたみなので、カードが直接見えるカレンダー表示に寄せる（好みの保存はしない）
    setView("calendar");
    if (target.dueDate) {
      setSelectedISO(target.dueDate);
      const [year, month] = target.dueDate.split("-").map(Number);
      setViewMonth({ year, monthIndex: month - 1 });
    }
    setHighlightId(id);
  }, [activeProjects, dataSource, showToast, today]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  if (!today || !selectedISO || !viewMonth || dataSource === "loading") {
    return (
      <div className="space-y-3">
        <p role="status" className={natoriAdminUi.caption}>
          案件を読み込んでいます
        </p>
        <NatoriSkeleton heightClassName="h-12" />
        <NatoriSkeleton heightClassName="h-64" />
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
    const project = projects.find(entry => entry.id === projectId);
    const task = project?.tasks.find(entry => entry.id === taskId);
    if (!project || !task || advanceBusyId === projectId ||
        project.deletedAt || ["completed", "closed", "delivered"].includes(project.status)) return;
    setError(null);
    const pending = taskIntents.current.get(projectId) ?? new Map<string, TaskIntent>();
    const nextDone = !(pending.get(taskId)?.done ?? task.done);
    if (dataSource !== "supabase") {
      setProjects(current => current.map(entry => entry.id === projectId
        ? previewProductionTasks(entry, entry.tasks.map(item => item.id === taskId ? { ...item, done: nextDone } : item)) : entry));
      return;
    }
    const sequence = ++taskSequence.current;
    pending.set(taskId, { sequence, done: nextDone });
    taskIntents.current.set(projectId, pending);
    setProjects(current => current.map(entry => entry.id === projectId ? overlayTaskIntents(entry, pending) : entry));
    void (async () => {
      const releaseIntent = () => {
        if (pending.get(taskId)?.sequence === sequence) pending.delete(taskId);
        if (!pending.size && taskIntents.current.get(projectId) === pending) taskIntents.current.delete(projectId);
      };
      try {
        const projection = await toggleNatoriTaskDone(projectId, taskId, nextDone);
        releaseIntent();
        const confirmed = canonicalProjects.current.get(projectId);
        if (confirmed) canonicalProjects.current.set(projectId, applyTaskProjection(confirmed, projection));
        publishCanonicalProjects();
      } catch (err) {
        releaseIntent();
        if (err instanceof NatoriTaskConflictError) {
          const confirmed = canonicalProjects.current.get(projectId);
          if (confirmed) canonicalProjects.current.set(projectId, applyTaskProjection(confirmed, err.project));
        }
        publishCanonicalProjects();
        await recoverFromMutationFailure("task update", err);
      }
    })();
  };

  // 「元に戻す」: 進めた直後の数秒だけ出す。制作工程どうしの移動だけが逆向きに戻せる
  // （受注前は前進のみ、制作工程→受注前は不可という既存の遷移ルールに従う）。
  const handleUndoAdvance = (
    projectId: string,
    advancedTo: NatoriProjectStatus,
    restoreStatus: NatoriProjectStatus,
    restoreAction: string,
  ) => {
    const restoredLabel = natoriProjectStatusMeta[restoreStatus]?.label ?? "前の工程";
    setError(null);
    if (dataSource !== "supabase") {
      setProjects((current) =>
        current.map((entry) =>
          entry.id === projectId && entry.status === advancedTo
            ? { ...entry, status: restoreStatus, nextAction: restoreAction }
            : entry
        )
      );
      showToast(`「${restoredLabel}」に戻しました`);
      return;
    }
    // 待っている間にタスク操作などで工程が変わっていたら、上書きしない
    if (canonicalProjects.current.get(projectId)?.status !== advancedTo) {
      showToast("工程が変わっていたため、元に戻しませんでした");
      return;
    }
    setAdvanceBusyId(projectId);
    (async () => {
      try {
        await updateNatoriProjectStatus(projectId, restoreStatus, restoreAction);
        await loadFromSupabase();
        showToast(`「${restoredLabel}」に戻しました`);
      } catch (err) {
        await recoverFromMutationFailure("status undo", err);
      } finally {
        setAdvanceBusyId((current) => (current === projectId ? null : current));
      }
    })();
  };

  const offerUndoAdvance = (project: NatoriProject, nextStatus: NatoriProjectStatus) => {
    if (!canTransitionNatoriStatus(nextStatus, project.status)) return;
    const nextLabel = natoriProjectStatusMeta[nextStatus]?.label ?? "次の工程";
    const restoreStatus = project.status;
    const restoreAction = project.nextAction;
    showToast(`「${nextLabel}」にしました`, {
      action: {
        label: "元に戻す",
        onAction: () => handleUndoAdvance(project.id, nextStatus, restoreStatus, restoreAction),
      },
    });
  };

  const handleAdvanceStatus = (project: NatoriProject) => {
    const nextStatus = getNextStatus(project.status);
    if (nextStatus === project.status) return;
    const nextAction = getNextActionForStatus(nextStatus);
    setError(null);
    setAdvanceBusyId(project.id);
    if (dataSource !== "supabase") setProjects((current) =>
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
          await loadFromSupabase();
          offerUndoAdvance(project, nextStatus);
        } catch (err) {
          await recoverFromMutationFailure("status update", err);
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
      offerUndoAdvance(project, nextStatus);
    }
  };

  const handleConfirmPayment = (project: NatoriProject) => {
    if (project.status !== "awaiting_payment") return;
    const nextAction = getNextActionForStatus("rough");
    const stampedAt = new Date().toISOString();
    setError(null);
    setAdvanceBusyId(project.id);
    if (dataSource !== "supabase") setProjects((current) =>
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
          await loadFromSupabase();
          showToast("入金確認しました。ラフ工程に進みました。");
        } catch (err) {
          await recoverFromMutationFailure("payment confirmation", err);
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
      showToast("入金確認しました。ラフ工程に進みました。");
    }
  };

  const handleReopenProject = (project: NatoriProject) => {
    const nextAction = getNextActionForStatus("inquiry");
    setError(null);
    setAdvanceBusyId(project.id);
    if (dataSource !== "supabase") setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id ? { ...entry, status: "inquiry", nextAction } : entry
      )
    );
    if (dataSource === "supabase") {
      (async () => {
        try {
          await updateNatoriProjectStatus(project.id, "inquiry", nextAction);
          await loadFromSupabase();
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

  const handleDeleteClosedProject = async (project: NatoriProject) => {
    const confirmed = await confirm({
      title: "一覧から削除しますか？",
      description: `「${project.clientName}｜${project.title}」を案件一覧から削除します。データと画像は保持され、あとで復元できます。よろしいですか？`,
      confirmLabel: "一覧から削除",
      tone: "danger",
    });
    if (!confirmed) return;
    setAdvanceBusyId(project.id);
    setProjects((current) => current.filter((entry) => entry.id !== project.id));
    if (dataSource === "supabase") {
      (async () => {
        try {
          await deleteNatoriProject(project.id);
          await loadFromSupabase();
          showToast("一覧から削除しました。");
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
      showToast("一覧から削除しました。");
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
          showToast("案件を復元しました。");
        } catch (err) {
          await recoverFromMutationFailure("project restore", err);
        } finally {
          setAdvanceBusyId((current) => (current === project.id ? null : current));
        }
      })();
    } else {
      setAdvanceBusyId((current) => (current === project.id ? null : current));
      showToast("案件を復元しました。");
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
            ? { amount: patch.amount === null ? null : Math.max(0, patch.amount) }
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

    if (dataSource !== "supabase") {
      showToast("案件の変更を保存しました。");
      return;
    }
    try {
      await updateNatoriProjectDetails(project.id, patch);
      await loadFromSupabase();
      showToast("案件の変更を保存しました。");
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
      {confirmDialog}
      {error ? (
        <div
          role="alert"
          className={`${natoriAdminUi.alert.error} flex items-start justify-between gap-3 text-xs sm:p-4 sm:text-sm`}
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            閉じる
          </button>
        </div>
      ) : null}
      {/* 案件の手入力登録はダイアログ。主役のカレンダーを上に保つため、フォームは常設しない */}
      {authed ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className={natoriAdminUi.btnSecondary}
          >
            <Plus className="h-4 w-4" aria-hidden />
            案件を登録
          </button>
        </div>
      ) : null}

      {/* 問い合わせへの導線・おすすめ順は1つのまとまりとして詰めて並べる */}
      <div className="space-y-3">
      {/* 依頼受付〜入金待ちの対応（メール送信・入金確認・見送り）は問い合わせ管理へ集約 */}
      {preworkCount > 0 ? (
        <Link
          href={isDemo ? "/etorie/demo/app/inquiries" : "/natori/inquiries"}
          className={`group flex items-center justify-between gap-3 rounded-2xl ${natoriAdminUi.surface} p-4 ${natoriAdminUi.cardInteractive} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843] sm:px-5`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
              <Inbox className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">
                問い合わせ・入金待ち {preworkCount}件
              </p>
              <p className="mt-0.5 text-xs leading-5 text-zinc-600">
                見積もり・支払い依頼メール・入金確認は問い合わせ管理ページで対応します。
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-zinc-400 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-zinc-600"
            aria-hidden
          />
        </Link>
      ) : null}

      <ProjectPriorityList
        suggestions={suggestions}
        today={today}
        onSelect={handleSelectFromPriority}
      />
      </div>

      {eventsError ? (
        <div
          role="alert"
          className={`${natoriAdminUi.alert.warning} flex items-center justify-between gap-3 text-xs sm:p-4 sm:text-sm`}
        >
          <p>{eventsError}</p>
          <button
            type="button"
            onClick={() => void retryEvents()}
            disabled={eventsBusy}
            className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100 disabled:opacity-60"
          >
            {eventsBusy ? "再読込中…" : "予定を再読込"}
          </button>
        </div>
      ) : null}

      {/* 表示切替（カレンダー / 一覧） */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="案件の表示切替" className={natoriAdminUi.segment}>
          {([
            ["calendar", "カレンダー", CalendarDays],
            ["list", "一覧", List],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`projects-view-tab-${key}`}
              aria-selected={view === key}
              aria-controls="projects-view-panel"
              onClick={() => changeView(key)}
              className={cn(
                natoriAdminUi.segmentItem,
                view === key ? natoriAdminUi.segmentOn : natoriAdminUi.segmentOff
              )}
            >
              <Icon
                className={cn("h-4 w-4", view === key ? "text-[#DB2777]" : "text-zinc-500")}
                aria-hidden
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        id="projects-view-panel"
        role="tabpanel"
        aria-labelledby={`projects-view-tab-${view}`}
        className="space-y-4 md:space-y-6"
      >
        {view === "calendar" ? (
          <>
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
        highlightProjectId={highlightId}
        events={events}
        authed={authed}
        eventsBusy={eventsBusy}
        eventsError={eventsError}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
          </>
        ) : (
          <ProjectListView
            projects={activeProjects}
            today={today}
            onToggleTask={handleToggleTask}
            onAdvanceStatus={handleAdvanceStatus}
            onConfirmPayment={handleConfirmPayment}
            onOpenMail={(project, kind) => setMailTarget({ project, kind })}
            onEditDetails={handleEditDetails}
            advanceBusyId={advanceBusyId}
          />
        )}
      </div>

      {view === "calendar" && undatedProjects.length > 0 ? (
        <section className={natoriAdminUi.card}>
          <div className="flex items-start gap-3">
            <span className={natoriAdminUi.iconTileNeutral}>
              <CalendarClock className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                納期未定の案件 {undatedProjects.length}件
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-zinc-600">
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
                highlighted={highlightId === project.id}
              />
            ))}
          </div>
        </section>
      ) : null}

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

      {/* 案件を登録（手入力） */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent
          className="max-h-[90vh] w-full max-w-lg gap-0 overflow-y-auto rounded-2xl bg-white p-5 sm:p-6"
          // 入力途中で外側をクリックして消えないよう、閉じるのは×・Esc・登録後の「閉じる」だけにする
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="text-base font-bold text-zinc-900">案件を登録</DialogTitle>
          <DialogDescription className={`${natoriAdminUi.caption} mb-4 mt-1`}>
            依頼が来た段階の案件でも、見積もり済の案件でも登録できます。
          </DialogDescription>
          <ProjectRegisterForm
            mode="manual"
            embedded
            onClose={() => setRegisterOpen(false)}
            onCreated={() => {
              if (dataSource === "supabase") {
                loadFromSupabase().catch((err) => {
                  console.error("[ProjectsBoard] reload after register failed", err);
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

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

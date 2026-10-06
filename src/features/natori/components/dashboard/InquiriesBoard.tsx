"use client";

// features/natori/components/dashboard/InquiriesBoard.tsx
// 全工程の相談管理。返信待ちと通知状態を案件進捗から分離して表示する。
// フォームから来た依頼を
// 受付日・最終アクション・経過日数付きの一覧で見て、詳細パネルから
// 見積もり / 支払い依頼メールの送信・入金確認・見送りまで行える。
// データソースは案件管理と同じ natori_projects（別テーブルは持たない）。
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { NatoriSkeleton } from "@/features/natori/components/admin/NatoriSkeleton";
import { useOptionalNatoriToast } from "@/features/natori/components/admin/NatoriToast";
import { useNatoriConfirm } from "@/features/natori/components/admin/useNatoriConfirm";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Inbox, Info, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import {
  daysSinceISO,
  parseInquiryNote,
  type NatoriInquiryNoteView,
} from "@/features/natori/lib/inquiryNoteView";
import { getNextActionForStatus } from "@/features/natori/lib/projects";
import {
  formatNatoriProjectAmount,
  getNatoriInquiryReceivedISO,
} from "@/features/natori/lib/projectReadModel";
import {
  closeNatoriProject,
  confirmNatoriProjectPayment,
  confirmNatoriProjectType,
  fetchNatoriProjectCollection,
  fetchNatoriProject,
  updateNatoriProjectDetails,
  updateNatoriProjectStatus,
  type UpdateNatoriProjectDetailsInput,
} from "@/features/natori/data/supabaseProjects";
import {
  addNatoriProjectReferenceLink,
  deleteNatoriProjectReferenceLink,
  describeNatoriReferenceLinkError,
  updateNatoriProjectReferenceLink,
} from "@/features/natori/data/supabaseProjectReferenceLinks";
import type {
  NatoriConcreteProjectType,
  NatoriProject,
  NatoriProjectStatus,
} from "@/features/natori/types/projects";
import InquiryDetailPanel from "./InquiryDetailPanel";
import OrderMailPanel, { type OrderMailKind } from "./OrderMailPanel";
import ConsultationStatus from "./ConsultationStatus";
import { consultationActivityDay, compareConsultationActivity, consultationNeedsAttention, consultationReplyState } from "@/features/natori/lib/consultationOverview";
import { NatoriLoadError } from "./NatoriLoadError";

/** 種別確定の失敗を、DB 内部情報を含まない案内文へ写す。 */
function describeConfirmTypeError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "conflict":
      return "既に別の種別で確定済みか、制作が進んでいるため変更できません。";
    case "not_found":
      return "案件が見つかりませんでした。画面を再読み込みしてください。";
    case "invalid_request":
      return "選択した種別が不正です。";
    default:
      return "確定できませんでした。時間をおいてお試しください。";
  }
}

/** 一覧の状態フィルタ。consulting は inquiry と同じ「依頼受付」扱い */
const STATUS_FILTERS: Array<{ key: string; label: string; statuses: NatoriProjectStatus[] }> = [
  { key: "all", label: "すべての工程", statuses: [] },
  { key: "attention", label: "対応・確認が必要", statuses: [] },
  { key: "staff", label: "ナトリの返信待ち", statuses: [] },
  { key: "client", label: "依頼者の返信待ち", statuses: [] },
  { key: "ended", label: "終了・アーカイブ", statuses: [] },
  { key: "inquiry", label: "依頼受付", statuses: ["inquiry", "consulting"] },
  { key: "estimating", label: "見積もり中", statuses: ["estimating"] },
  { key: "quoted", label: "提示済み", statuses: ["quoted"] },
  { key: "awaiting_payment", label: "入金待ち", statuses: ["awaiting_payment"] },
];

/** 上段チップ＝返信状況、下段セレクト＝工程。key は STATUS_FILTERS のものをそのまま使う。 */
const REPLY_FILTER_KEYS = ["all", "attention", "staff", "client", "ended"];
const STAGE_FILTER_KEYS = ["all", "inquiry", "estimating", "quoted", "awaiting_payment"];

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

/** 完了・見送り・アーカイブ済みは経過日数を警告色で出さない（INQ-04）。 */
function isFinishedProject(project: NatoriProject): boolean {
  return (
    Boolean(project.deletedAt) ||
    project.status === "completed" ||
    project.status === "delivered" ||
    project.status === "closed"
  );
}

/** 依頼者名の頭文字アイコン（飾り。読み上げは名前の本文で行う） */
function ClientInitial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-100 to-pink-50 text-xs font-semibold text-[#9D174D] ring-1 ring-inset ring-pink-500/10"
    >
      {Array.from(name.trim())[0] ?? "?"}
    </span>
  );
}

/** 経過日数バッジ。7日で注意、14日で警告 */
function ElapsedBadge({ days }: { days: number }) {
  const tone =
    days >= 14
      ? "border-red-200 bg-red-50 text-red-700"
      : days >= 7
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-zinc-200 bg-zinc-50 text-zinc-600";
  return (
    <span
      className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums", tone)}
      title={days === 0 ? "最終やり取りは今日" : `最終やり取りから${days}日`}
    >
      <span aria-hidden>{days === 0 ? "今日" : `${days}日前`}</span>
      <span className="sr-only">
        {days === 0 ? "最終やり取りは今日" : `最終やり取りから${days}日`}
      </span>
    </span>
  );
}

type InquiryRow = {
  project: NatoriProject;
  view: NatoriInquiryNoteView;
  receivedISO: string;
  lastActivityISO: string;
  lastActionLabel: string;
};

type InquiriesBoardProps = {
  /**
   * エトリエのデモ環境用。渡すとサーバーへは一切アクセスせず、
   * このデータをローカル状態として表示・操作する（見送り・入金確認も
   * ローカル反映のみ、メールパネルは送信シミュレーション）。
   */
  demoProjects?: NatoriProject[];
  /** デモ環境でのメール定型文の名乗り（例: ユキノ）。省略時は既定のナトリ */
  demoArtistName?: string;
};

export default function InquiriesBoard({ demoProjects, demoArtistName }: InquiriesBoardProps) {
  const { confirm, confirmDialog } = useNatoriConfirm();
  const { showToast } = useOptionalNatoriToast();
  const isDemo = Boolean(demoProjects);
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  // 開いたときは「対応・確認が必要」から。URL の ?filter= があればそちらを優先する（下の sync）。
  const [filter, setFilter] = useState<string>("attention");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<NatoriProject | null>(null);
  const [selectedError, setSelectedError] = useState("");
  const [detailVersion, setDetailVersion] = useState(0);
  const [initialScreen, setInitialScreen] = useState<"overview" | "conversation">("overview");
  const [mailKind, setMailKind] = useState<OrderMailKind | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("project");
      const requestedFilter = params.get("filter");
      if (requestedFilter && STATUS_FILTERS.some(entry => entry.key === requestedFilter)) setFilter(requestedFilter);
      setSelectedId(projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId) ? projectId : null);
      setInitialScreen(params.get("view") === "conversation" ? "conversation" : "overview");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [isDemo]);

  const reload = useCallback(async () => {
    const data = await fetchNatoriProjectCollection();
    setProjects([...data.projects, ...data.archivedProjects]);
  }, []);

  useEffect(() => {
    let active = true;
    setSelectedProject(current => current?.id === selectedId ? current : null);
    setSelectedError("");
    if (!selectedId) return;
    if (isDemo) { setSelectedProject(projects?.find(p => p.id === selectedId) ?? null); return; }
    void fetchNatoriProject(selectedId).then(project => {
      if (!active) return;
      setSelectedProject(project);
      if (!project) setSelectedError("案件が見つかりません。管理権限とリンクをご確認ください。");
    }).catch(() => { if (active) setSelectedError("案件の詳細を取得できませんでした。再試行してください。"); });
    return () => { active = false; };
  }, [selectedId, projects, isDemo, detailVersion]);

  const openProject = (id: string) => {
    setInitialScreen("overview");
    setSelectedId(id);
    if (!isDemo) {
      const url = new URL(window.location.href); url.searchParams.set("project", id); url.searchParams.delete("view");
      window.history.pushState(null, "", url);
    }
  };
  const closeDetail = () => {
    setSelectedId(null);
    if (!isDemo) {
      const url = new URL(window.location.href); url.searchParams.delete("project"); url.searchParams.delete("view");
      window.history.replaceState(null, "", url);
    }
  };

  const loadServerData = useCallback(async () => {
    setProjects(null);
    setError(null);
    try {
      await reload();
    } catch (err) {
      console.error("[InquiriesBoard] load failed", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [reload]);

  useEffect(() => {
    setToday(new Date());
    if (demoProjects) {
      setProjects(demoProjects);
      setError(null);
      return;
    }
    void loadServerData();
  }, [loadServerData, demoProjects]);

  const rows = useMemo<InquiryRow[]>(() => {
    if (!projects) return [];
    return projects
      .map((project) => {
        const view = parseInquiryNote(project.note);
        const receivedISO = getNatoriInquiryReceivedISO(project);
        const lastActivityISO = consultationActivityDay(project) || receivedISO;
        return {
          project,
          view,
          receivedISO,
          lastActivityISO,
          lastActionLabel: project.consultation?.latestSender === "client" ? "依頼者から" : project.consultation?.latestSender === "staff" ? "ナトリから" : project.consultation ? "会話なし" : "取得できません",
        };
      })
      // 最終相談日時（会話なしは受付日時）が古い順。メモのメール日付は使わない。
      .sort((a, b) =>
        compareConsultationActivity(a.project, b.project)
      );
  }, [projects]);

  const matchesFilter = (row: InquiryRow, key: string) => {
    const ended = Boolean(row.project.deletedAt) || row.project.status === "closed";
    if (key === "ended") return ended;
    // 終了・アーカイブ済みは「対応・確認が必要」にも数えない（数えると「すべて」より多くなる）。
    if (ended) return false;
    if (key === "attention") return consultationNeedsAttention(row.project);
    if (key === "staff") return ["staff", "new"].includes(consultationReplyState(row.project));
    if (key === "client") return consultationReplyState(row.project) === "client";
    const entry = STATUS_FILTERS.find(item => item.key === key);
    return !entry?.statuses.length || entry.statuses.includes(row.project.status);
  };
  const filteredRows = rows.filter(row => matchesFilter(row, filter));
  const selectedRow = selectedProject ? { project: selectedProject, view: parseInquiryNote(selectedProject.note) } : null;

  const handleCloseInquiry = async (project: NatoriProject) => {
    const answer = await confirm({
      title: "見送りにしますか？",
      description: `「${project.clientName}｜${project.title}」を見送りにします。理由があれば入力してください（履歴として残ります）。`,
      confirmLabel: "見送りにする",
      tone: "danger",
      withReason: { label: "理由（任意・履歴に残ります）" },
    });
    if (answer === null) return;
    const reason = answer.reason;
    if (isDemo) {
      // デモ: ローカル状態にだけ反映（履歴の見送りログも本物と同じ形式で追記）
      const stamp = new Date().toISOString().slice(0, 10);
      setProjects((current) =>
        (current ?? []).map((entry) =>
          entry.id === project.id
            ? {
                ...entry,
                status: "closed",
                nextAction: "-",
                note: `${entry.note ?? ""}\n\n【見送り ${stamp}】${reason.trim() || "-"}`.trim(),
              }
            : entry
        )
      );
      closeDetail();
      showToast("見送りにしました。");
      return;
    }
    setBusyId(project.id);
    setError(null);
    try {
      await closeNatoriProject(project.id, reason.trim());
      await reload();
      closeDetail();
      showToast("見送りにしました。");
    } catch (err) {
      console.error("[InquiriesBoard] close failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  /** 案件種別の確定。成功後は project と tasks を再取得する。 */
  const handleConfirmType = async (
    projectId: string,
    projectType: NatoriConcreteProjectType
  ) => {
    setError(null);
    try {
      await confirmNatoriProjectType(projectId, projectType);
      await reload();
    } catch (err) {
      console.error("[InquiriesBoard] confirm type failed");
      throw new Error(describeConfirmTypeError(err));
    }
  };

  /** 金額 / 納品予定日 / 納期プランの管理補正。request_data は送らない。 */
  const handleSaveCorrection = async (
    projectId: string,
    patch: UpdateNatoriProjectDetailsInput
  ) => {
    setError(null);
    await updateNatoriProjectDetails(projectId, patch);
    await reload();
  };

  /** 次のアクションのみの更新。既存の status 遷移 API を同一 status で使う。 */
  const handleSaveNextAction = async (project: NatoriProject, nextAction: string) => {
    setError(null);
    await updateNatoriProjectStatus(project.id, project.status, nextAction);
    await reload();
  };

  /** link 変更は成功・失敗どちらでも一覧を再取得し、既存集合を失わない。 */
  const handleLinkMutation = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      throw new Error(describeNatoriReferenceLinkError(err));
    } finally {
      await reload();
    }
  };

  const handleConfirmPayment = async (project: NatoriProject) => {
    const confirmed = await confirm({
      title: "入金を確認しますか？",
      description: `「${project.clientName}｜${project.title}」の入金を確認済みにして、ラフ開始に進めます。よろしいですか？`,
      confirmLabel: "入金確認してラフ開始",
      tone: "primary",
    });
    if (!confirmed) return;
    if (isDemo) {
      setProjects((current) =>
        (current ?? []).map((entry) =>
          entry.id === project.id
            ? {
                ...entry,
                status: "rough",
                nextAction: getNextActionForStatus("rough"),
                paymentConfirmedAt: new Date().toISOString(),
              }
            : entry
        )
      );
      closeDetail();
      showToast("入金確認しました。ラフ工程に進みました。");
      return;
    }
    setBusyId(project.id);
    setError(null);
    try {
      await confirmNatoriProjectPayment(project.id, getNextActionForStatus("rough"));
      await reload();
      closeDetail();
      showToast("入金確認しました。ラフ工程に進みました。");
    } catch (err) {
      console.error("[InquiriesBoard] confirm payment failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (error && !projects && !selectedId) {
    return (
      <NatoriLoadError
        resourceLabel="問い合わせデータ"
        error={error}
        onRetry={() => void loadServerData()}
      />
    );
  }

  if ((!projects && !selectedId) || !today) {
    return (
      <div className="space-y-3">
        <p role="status" className={natoriAdminUi.caption}>
          問い合わせを読み込んでいます
        </p>
        <NatoriSkeleton heightClassName="h-12" />
        <NatoriSkeleton heightClassName="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {confirmDialog}
      <div className="flex items-start justify-between gap-3">
        <details className="group min-w-0">
          <summary className={`${natoriAdminUi.btnLink} cursor-pointer list-none marker:hidden [&::-webkit-details-marker]:hidden`}>
            <Info className="h-4 w-4" aria-hidden />
            表示のルール
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className={`mt-1 max-w-2xl space-y-1 rounded-xl bg-white p-3 ring-1 ring-inset ring-zinc-200/80 ${natoriAdminUi.caption}`}>
            <p>制作の進捗と返信待ちは別に表示します。既読の判定ではありません。</p>
            <p>
              相談の最終発言が古い順（会話がなければ受付順）です。経過はその日からの日数で、7日で黄色・14日で赤になります。
            </p>
          </div>
        </details>
        {!isDemo ? (
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void reload()
                .catch(() => setError("最新の状況を取得できませんでした。"))
                .finally(() => setRefreshing(false));
            }}
            className={`${natoriAdminUi.btnSecondary} shrink-0`}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw className="h-4 w-4 text-zinc-500" aria-hidden />}
            状態を更新
          </button>
        ) : null}
      </div>
      {selectedId && !selectedProject ? <div role={selectedError ? "alert" : "status"} className="rounded-xl border border-zinc-200/80 bg-white p-3 text-sm">
        {selectedError || "案件詳細を読み込み中…"}
        {selectedError ? <button type="button" onClick={() => setDetailVersion(n => n + 1)} className="ml-3 underline">詳細を再試行</button> : null}
        <button type="button" onClick={closeDetail} className="ml-3 underline">閉じる</button>
      </div> : null}
      {/* 状態フィルタ（返信状況＝チップ / 工程＝セレクト。どちらも同じ filter を更新する） */}
      <div className={`space-y-3 rounded-2xl ${natoriAdminUi.surface} p-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6 sm:space-y-0 sm:p-4`}>
        <div className="min-w-0">
          <p className={`mb-1.5 ${natoriAdminUi.groupLabel}`}>返信状況</p>
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
            {REPLY_FILTER_KEYS.map((key) => {
              const entry = STATUS_FILTERS.find((item) => item.key === key);
              if (!entry) return null;
              const on = filter === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setFilter(entry.key)}
                  aria-pressed={on}
                  className={cn(natoriAdminUi.chip, on ? natoriAdminUi.chipOn : natoriAdminUi.chipOff)}
                >
                  {entry.key === "all" ? "すべて" : entry.label}
                  <span
                    className={cn(
                      "ml-0.5 inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums",
                      on ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
                    )}
                  >
                    {rows.filter((row) => matchesFilter(row, entry.key)).length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="inquiries-stage-filter" className={natoriAdminUi.groupLabel}>
            工程
          </label>
          <select
            id="inquiries-stage-filter"
            value={STAGE_FILTER_KEYS.includes(filter) ? filter : "all"}
            onChange={(event) => setFilter(event.target.value)}
            className={`${natoriAdminUi.input} !w-auto min-w-[10rem] sm:py-1.5 sm:text-sm`}
          >
            {STAGE_FILTER_KEYS.map((key) => {
              const entry = STATUS_FILTERS.find((item) => item.key === key);
              if (!entry) return null;
              const label = key === "all" ? "すべて" : key === "quoted" ? "見積もり提示済み" : entry.label;
              return (
                <option key={key} value={key}>
                  {label}（{rows.filter((row) => matchesFilter(row, key)).length}）
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {error ? (
        <p className={`${natoriAdminUi.alert.error} text-xs font-semibold`}>
          {error}
        </p>
      ) : null}

      {!projects ? <p role="status" className="text-sm">一覧を取得できていません。案件詳細は個別に確認します。</p> : filteredRows.length === 0 ? (
        <div className={`rounded-2xl ${natoriAdminUi.surface} p-8 text-center`}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500">
            <Inbox className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-zinc-900">
            {rows.length === 0
              ? "対応中の問い合わせはありません"
              : filter === "attention"
                ? "今、対応・確認が必要な問い合わせはありません"
                : "この条件の問い合わせはありません"}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            制作中・納品後の相談も、ここから開けます。終了した案件は「終了・アーカイブ」で確認できます。
          </p>
          {rows.length > 0 && filter !== "all" ? (
            <button type="button" onClick={() => setFilter("all")} className={`${natoriAdminUi.btnSecondary} mt-3`}>
              すべての問い合わせを表示
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* スマホ: カード表示 */}
          <ul className="space-y-2 sm:hidden">
            {filteredRows.map((row) => {
              const meta = natoriProjectStatusMeta[row.project.status];
              const elapsed = daysSinceISO(row.lastActivityISO, today);
              return (
                <li key={row.project.id}>
                  <button
                    type="button"
                    onClick={() => openProject(row.project.id)}
                    className={`w-full rounded-2xl ${natoriAdminUi.surface} p-3.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 break-words text-sm font-semibold text-zinc-900">
                        <ClientInitial name={row.project.clientName} />
                        {row.project.clientName}
                      </p>
                      {isFinishedProject(row.project) ? (
                        <span className="text-xs text-zinc-500">—</span>
                      ) : (
                        <ElapsedBadge days={elapsed} />
                      )}
                    </div>
                    <p className="mt-1 break-words text-xs text-zinc-600">{row.project.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-xs font-semibold",
                          meta.chipClassName
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {formatNatoriProjectAmount(row.project.amount)}
                      </span>
                      <span className="ml-auto text-zinc-500">
                        {row.lastActionLabel}・{formatDate(row.lastActivityISO)}
                      </span>
                    </div>
                    <span className="mt-2 block"><ConsultationStatus project={row.project} /></span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* PC: テーブル表示 */}
          <div className={`hidden sm:block ${natoriAdminUi.tableWrap}`}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className={natoriAdminUi.th}>受付日</th>
                <th scope="col" className={natoriAdminUi.th}>依頼者・内容</th>
                <th scope="col" className={`${natoriAdminUi.th} text-right`}>金額</th>
                <th scope="col" className={natoriAdminUi.th}>ステータス</th>
                <th scope="col" className={natoriAdminUi.th}>最終アクション</th>
                <th scope="col" className={`${natoriAdminUi.th} text-right`}>経過</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const meta = natoriProjectStatusMeta[row.project.status];
                const elapsed = daysSinceISO(row.lastActivityISO, today);
                return (
                  <tr
                    key={row.project.id}
                    className={`relative cursor-pointer transition ${natoriAdminUi.tr}`}
                  >
                    <td className={`whitespace-nowrap ${natoriAdminUi.td} text-xs text-zinc-600`}>
                      {formatDate(row.receivedISO)}
                    </td>
                    <td className={`max-w-[300px] ${natoriAdminUi.td}`}>
                      <div className="flex min-w-0 items-start gap-3">
                        <ClientInitial name={row.project.clientName} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => openProject(row.project.id)} className="max-w-full text-left decoration-zinc-300 underline-offset-4 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#831843]">
                            <span className="block truncate font-semibold text-zinc-900">{row.project.clientName}</span>
                            <span className="block truncate text-xs text-zinc-600">{row.project.title}</span>
                          </button>
                          <ConsultationStatus project={row.project} />
                        </div>
                      </div>
                    </td>
                    <td className={`whitespace-nowrap text-right font-semibold tabular-nums text-zinc-900 ${natoriAdminUi.td}`}>
                      {formatNatoriProjectAmount(row.project.amount)}
                    </td>
                    <td className={`whitespace-nowrap ${natoriAdminUi.td}`}>
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-xs font-semibold",
                          meta.chipClassName
                        )}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className={`whitespace-nowrap ${natoriAdminUi.td} text-xs text-zinc-600`}>
                      {row.lastActionLabel}
                      <span className="ml-1 text-zinc-500">{formatDate(row.lastActivityISO)}</span>
                    </td>
                    <td className={`whitespace-nowrap text-right ${natoriAdminUi.td}`}>
                      {isFinishedProject(row.project) ? (
                        <span className="text-xs text-zinc-500">—</span>
                      ) : (
                        <ElapsedBadge days={elapsed} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* 詳細パネル */}
      {selectedRow && !mailKind ? (
        <InquiryDetailPanel
          key={selectedRow.project.id}
          initialScreen={initialScreen}
          refreshError={selectedError || error || undefined}
          onRetryRefresh={() => { setError(null); setDetailVersion(n => n + 1); void reload().catch(() => setError("返信状況を更新できませんでした。")); }}
          onConversationChanged={() => { void reload().catch(() => setError("返信状況を更新できませんでした。状態を更新してください。")); }}
          project={selectedRow.project}
          view={selectedRow.view}
          busy={busyId === selectedRow.project.id}
          demoMode={isDemo}
          onClose={closeDetail}
          onOpenMail={(kind) => setMailKind(kind)}
          onCloseInquiry={() => void handleCloseInquiry(selectedRow.project)}
          onConfirmPayment={() => void handleConfirmPayment(selectedRow.project)}
          onConfirmType={
            isDemo ? undefined : (type) => handleConfirmType(selectedRow.project.id, type)
          }
          onSaveCorrection={
            isDemo ? undefined : (patch) => handleSaveCorrection(selectedRow.project.id, patch)
          }
          onSaveNextAction={
            isDemo
              ? undefined
              : (nextAction) =>
                  handleSaveNextAction(selectedRow.project, nextAction)
          }
          onAddLink={
            isDemo
              ? undefined
              : (url, label) => handleLinkMutation(() =>
                  addNatoriProjectReferenceLink(selectedRow.project.id, url, label)
                )
          }
          onUpdateLink={
            isDemo
              ? undefined
              : (linkId, url, label) =>
                  handleLinkMutation(() =>
                    updateNatoriProjectReferenceLink(
                      selectedRow.project.id,
                      linkId,
                      url,
                      label
                    )
                  )
          }
          onDeleteLink={
            isDemo
              ? undefined
              : (linkId) =>
                  handleLinkMutation(() =>
                    deleteNatoriProjectReferenceLink(selectedRow.project.id, linkId)
                  )
          }
          estimateHref={
            isDemo
              ? `/etorie/demo/app/estimate?inquiry=${selectedRow.project.id}`
              : `/natori/estimate?inquiry=${selectedRow.project.id}`
          }
          projectsHref={isDemo ? "/etorie/demo/app/projects" : "/natori/projects"}
        />
      ) : null}

      {/* メール送信パネル（詳細パネルの上に重ねず、切り替えて表示） */}
      {selectedRow && mailKind ? (
        <OrderMailPanel
          project={selectedRow.project}
          kind={mailKind}
          demoMode={isDemo}
          artistName={demoArtistName}
          onClose={() => setMailKind(null)}
          onSent={() => {
            if (isDemo) {
              // デモ: 本物と同じステータス遷移をローカルにだけ反映
              const nextStatus = mailKind === "estimate" ? "quoted" : "awaiting_payment";
              setProjects((current) =>
                (current ?? []).map((entry) =>
                  entry.id === selectedRow.project.id
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
            reload().catch((err) => {
              console.error("[InquiriesBoard] reload after mail failed", err);
            });
          }}
        />
      ) : null}
    </div>
  );
}

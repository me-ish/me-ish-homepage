"use client";

// features/natori/components/dashboard/InquiriesBoard.tsx
// 問い合わせ管理画面。フォームから来た依頼（＝ラフ開始前の案件）を
// 受付日・最終アクション・経過日数付きの一覧で見て、詳細パネルから
// 見積もり / 支払い依頼メールの送信・入金確認・見送りまで行える。
// データソースは案件管理と同じ natori_projects（別テーブルは持たない）。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { natoriProjectStatusMeta } from "@/features/natori/constants/mockProjects";
import {
  daysSinceISO,
  getInquiryLastActivityISO,
  parseInquiryNote,
  type NatoriInquiryNoteView,
} from "@/features/natori/lib/inquiryNoteView";
import { getNextActionForStatus, isPreworkStatus } from "@/features/natori/lib/projects";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  closeNatoriProject,
  confirmNatoriProjectPayment,
  fetchNatoriProjects,
} from "@/features/natori/data/supabaseProjects";
import type { NatoriProject, NatoriProjectStatus } from "@/features/natori/types/projects";
import InquiryDetailPanel from "./InquiryDetailPanel";
import OrderMailPanel, { type OrderMailKind } from "./OrderMailPanel";

/** 一覧の状態フィルタ。consulting は inquiry と同じ「依頼受付」扱い */
const STATUS_FILTERS: Array<{ key: string; label: string; statuses: NatoriProjectStatus[] }> = [
  { key: "all", label: "すべて", statuses: [] },
  { key: "inquiry", label: "依頼受付", statuses: ["inquiry", "consulting"] },
  { key: "estimating", label: "見積もり中", statuses: ["estimating"] },
  { key: "quoted", label: "提示済み", statuses: ["quoted"] },
  { key: "awaiting_payment", label: "入金待ち", statuses: ["awaiting_payment"] },
];

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

/** 経過日数バッジ。7日で注意、14日で警告 */
function ElapsedBadge({ days }: { days: number }) {
  const tone =
    days >= 14
      ? "border-red-200 bg-red-50 text-red-700"
      : days >= 7
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-gray-200 bg-gray-50 text-gray-600";
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold", tone)}>
      {days === 0 ? "今日" : `${days}日`}
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
  const isDemo = Boolean(demoProjects);
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mailKind, setMailKind] = useState<OrderMailKind | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await fetchNatoriProjects();
    setProjects(data);
  }, []);

  useEffect(() => {
    setToday(new Date());
    if (demoProjects) {
      setProjects(demoProjects);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        console.error("[InquiriesBoard] load failed", err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, demoProjects]);

  const rows = useMemo<InquiryRow[]>(() => {
    if (!projects) return [];
    return projects
      .filter((project) => isPreworkStatus(project.status))
      .map((project) => {
        const view = parseInquiryNote(project.note);
        const receivedISO = project.startDate ?? project.dueDate;
        const lastActivityISO = getInquiryLastActivityISO(view, receivedISO);
        const lastLog = view.logs[view.logs.length - 1];
        return {
          project,
          view,
          receivedISO,
          lastActivityISO,
          lastActionLabel: lastLog ? lastLog.label : "受付のみ",
        };
      })
      // 対応が止まっているものが上に来るよう、最終アクションの古い順
      .sort((a, b) => a.lastActivityISO.localeCompare(b.lastActivityISO));
  }, [projects]);

  const filteredRows = useMemo(() => {
    const entry = STATUS_FILTERS.find((item) => item.key === filter);
    if (!entry || entry.statuses.length === 0) return rows;
    const set = new Set(entry.statuses);
    return rows.filter((row) => set.has(row.project.status));
  }, [rows, filter]);

  const countFor = (statuses: NatoriProjectStatus[]) => {
    if (statuses.length === 0) return rows.length;
    const set = new Set(statuses);
    return rows.filter((row) => set.has(row.project.status)).length;
  };

  const selectedRow = selectedId
    ? filteredRows.find((row) => row.project.id === selectedId) ??
      rows.find((row) => row.project.id === selectedId) ??
      null
    : null;

  const handleCloseInquiry = async (project: NatoriProject) => {
    const reason = window.prompt(
      `「${project.clientName}｜${project.title}」を見送りにします。理由があれば入力してください（履歴として残ります）。`,
      ""
    );
    if (reason === null) return;
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
      setSelectedId(null);
      return;
    }
    setBusyId(project.id);
    setError(null);
    try {
      await closeNatoriProject(project.id, reason.trim());
      await reload();
      setSelectedId(null);
    } catch (err) {
      console.error("[InquiriesBoard] close failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmPayment = async (project: NatoriProject) => {
    const confirmed = window.confirm(
      `「${project.clientName}｜${project.title}」の入金を確認済みにして、ラフ開始に進めます。よろしいですか？`
    );
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
      setSelectedId(null);
      return;
    }
    setBusyId(project.id);
    setError(null);
    try {
      await confirmNatoriProjectPayment(project.id, getNextActionForStatus("rough"));
      await reload();
      setSelectedId(null);
    } catch (err) {
      console.error("[InquiriesBoard] confirm payment failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  if (error && !projects) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
        問い合わせデータの読み込みに失敗しました。合言葉付きのブックマークから開き直すか、時間をおいて再読み込みしてください。
        <p className="mt-1 text-[11px] opacity-80">{error}</p>
      </div>
    );
  }

  if (!projects || !today) {
    return (
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-pink-50/60" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 状態フィルタ */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            aria-pressed={filter === entry.key}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-bold transition",
              filter === entry.key
                ? "border-pink-500 bg-pink-500 text-white"
                : "border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
            )}
          >
            {entry.label}
            <span className={cn("ml-1", filter === entry.key ? "opacity-90" : "text-gray-400")}>
              {countFor(entry.statuses)}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-pink-100 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-50 text-pink-500">
            <Inbox className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold text-gray-900">
            {rows.length === 0 ? "対応中の問い合わせはありません" : "この条件の問い合わせはありません"}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            ご依頼フォームから送信があると、ここに自動で並びます。ラフ開始後の案件は案件ボードで管理します。
          </p>
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
                    onClick={() => setSelectedId(row.project.id)}
                    className="w-full rounded-2xl border border-pink-100 bg-white p-3 text-left shadow-sm transition hover:bg-pink-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-black text-gray-900">
                        {row.project.clientName}
                      </p>
                      <ElapsedBadge days={elapsed} />
                    </div>
                    <p className="mt-0.5 break-words text-xs text-gray-600">{row.project.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          meta.chipClassName
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="font-bold text-gray-900">
                        {row.project.amount > 0 ? formatYen(row.project.amount) : "金額未定"}
                      </span>
                      <span className="ml-auto text-gray-500">
                        {row.lastActionLabel}・{formatDate(row.lastActivityISO)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* PC: テーブル表示 */}
          <div className="hidden overflow-x-auto rounded-2xl border border-pink-100 bg-white shadow-sm sm:block">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-pink-100 text-[11px] font-bold uppercase tracking-wide text-pink-700">
                <th className="px-3 py-2.5">受付日</th>
                <th className="px-3 py-2.5">依頼者・内容</th>
                <th className="px-3 py-2.5 text-right">金額</th>
                <th className="px-3 py-2.5">ステータス</th>
                <th className="px-3 py-2.5">最終アクション</th>
                <th className="px-3 py-2.5 text-right">経過</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const meta = natoriProjectStatusMeta[row.project.status];
                const elapsed = daysSinceISO(row.lastActivityISO, today);
                return (
                  <tr
                    key={row.project.id}
                    onClick={() => setSelectedId(row.project.id)}
                    className="cursor-pointer border-b border-pink-50 transition last:border-b-0 hover:bg-pink-50/50"
                    title="クリックで詳細を開く"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">
                      {formatDate(row.receivedISO)}
                    </td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <p className="truncate font-bold text-gray-900">{row.project.clientName}</p>
                      <p className="truncate text-xs text-gray-600">{row.project.title}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-gray-900">
                      {row.project.amount > 0 ? formatYen(row.project.amount) : "未定"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          meta.chipClassName
                        )}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600">
                      {row.lastActionLabel}
                      <span className="ml-1 text-gray-400">{formatDate(row.lastActivityISO)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <ElapsedBadge days={elapsed} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      <p className="text-[11px] text-gray-500">
        最終アクションが古い順に並びます。経過は最後の対応（無ければ受付）からの日数で、7日で黄色・14日で赤になります。
      </p>

      {/* 詳細パネル */}
      {selectedRow && !mailKind ? (
        <InquiryDetailPanel
          project={selectedRow.project}
          view={selectedRow.view}
          busy={busyId === selectedRow.project.id}
          onClose={() => setSelectedId(null)}
          onOpenMail={(kind) => setMailKind(kind)}
          onCloseInquiry={() => void handleCloseInquiry(selectedRow.project)}
          onConfirmPayment={() => void handleConfirmPayment(selectedRow.project)}
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

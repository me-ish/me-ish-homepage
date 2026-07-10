"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { fetchNatoriProjects } from "@/features/natori/data/supabaseProjects";
import { formatYen } from "@/features/natori/lib/pricing";
import {
  summarizeNatoriResults,
  type NatoriResultsSummary,
} from "@/features/natori/lib/results";
import type {
  NatoriProject,
  NatoriProjectStatus,
  NatoriProjectType,
} from "@/features/natori/types/projects";

const PROJECT_TYPE_LABELS: Record<NatoriProjectType, string> = {
  icon: "アイコン",
  sd: "SD",
  standing: "立ち絵",
  illustration: "イラスト",
};

const RESULT_STATUS_LABELS: Partial<Record<NatoriProjectStatus, string>> = {
  delivered: "納品済み",
  completed: "対応完了",
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${year}/${month}/${day}`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">{label}</p>
      <p className="mt-1 text-xl font-black text-gray-900 sm:text-2xl">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </div>
  );
}

function MeterRow({
  label,
  count,
  amount,
  maxAmount,
}: {
  label: string;
  count: number;
  amount: number;
  maxAmount: number;
}) {
  const ratio = maxAmount > 0 ? amount / maxAmount : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-bold text-gray-900 sm:text-sm">
          {label}
          <span className="ml-1.5 font-medium text-gray-500">{count}件</span>
        </p>
        <p className="shrink-0 text-xs font-bold text-gray-900 sm:text-sm">{formatYen(amount)}</p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-pink-50">
        <div
          className="h-full rounded-full bg-pink-500"
          style={{ width: `${Math.max(ratio * 100, amount > 0 ? 2 : 0)}%` }}
          aria-hidden="true"
        />
      </div>
    </li>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      {children}
    </section>
  );
}

function CompletedProjectRow({ project }: { project: NatoriProject }) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 break-words text-sm font-bold text-gray-900">{project.title}</p>
        <p className="shrink-0 text-sm font-bold text-gray-900">{formatYen(project.amount)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
        <span>{project.clientName}</span>
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-pink-700">
          {PROJECT_TYPE_LABELS[project.type]}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-emerald-700">
          {RESULT_STATUS_LABELS[project.status] ?? project.status}
        </span>
        <span className="ml-auto">納期 {formatDate(project.dueDate)}</span>
      </div>
    </li>
  );
}

export default function ResultsBoard() {
  const [projects, setProjects] = useState<NatoriProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchNatoriProjects();
        if (cancelled) return;
        setProjects(data);
      } catch (err) {
        console.error("[ResultsBoard] load failed", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo<NatoriResultsSummary | null>(
    () => (projects && now ? summarizeNatoriResults(projects, now) : null),
    [projects, now]
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:text-sm">
        実績データの読み込みに失敗しました。合言葉付きのブックマークから開き直すか、時間をおいて再読み込みしてください。
        <p className="mt-1 text-[11px] opacity-80">{error}</p>
      </div>
    );
  }

  if (!summary || !now) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-48 animate-pulse rounded-2xl bg-pink-50/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-pink-50/60" />
      </div>
    );
  }

  if (summary.totalCount === 0) {
    return (
      <div className="rounded-2xl border border-pink-100 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-pink-50 text-pink-500">
          <Trophy className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-bold text-gray-900">まだ実績がありません</p>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          案件のステータスが「納品済み」または「対応完了」になると、ここに件数や売上が表示されます。
        </p>
      </div>
    );
  }

  const maxMonthlyAmount = Math.max(...summary.monthly.map((month) => month.amount));
  const maxTypeAmount = Math.max(...summary.byType.map((entry) => entry.amount));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="実績件数" value={`${summary.totalCount}件`} />
        <StatTile label="総売上" value={formatYen(summary.totalAmount)} />
        <StatTile
          label={`今年（${now.getFullYear()}年）`}
          value={formatYen(summary.thisYearAmount)}
          sub={`${summary.thisYearCount}件`}
        />
        <StatTile label="平均単価" value={formatYen(summary.averageAmount)} />
      </div>

      <SectionCard title="月別の実績" description="納期の月ごとの件数と売上です。">
        <ul className="mt-3 space-y-3">
          {summary.monthly.map((month) => (
            <MeterRow
              key={month.ym}
              label={month.label}
              count={month.count}
              amount={month.amount}
              maxAmount={maxMonthlyAmount}
            />
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="タイプ別の実績">
        <ul className="mt-3 space-y-3">
          {summary.byType.map((entry) => (
            <MeterRow
              key={entry.type}
              label={PROJECT_TYPE_LABELS[entry.type]}
              count={entry.count}
              amount={entry.amount}
              maxAmount={maxTypeAmount}
            />
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="実績一覧"
        description="納品済み・対応完了の案件を納期の新しい順に表示しています。"
      >
        <ul className="mt-3 space-y-2">
          {summary.completed.map((project) => (
            <CompletedProjectRow key={project.id} project={project} />
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

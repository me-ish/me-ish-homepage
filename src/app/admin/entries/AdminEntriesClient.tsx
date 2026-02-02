// src/app/admin/entries/AdminEntriesClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  approveEntryAction,
  rejectEntryAction,
  resetEntryAction,
  type ProcessingJob,
} from './actions';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  ExternalLink,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';

type Entry = {
  id: number;
  artist_name: string;
  title: string;
  image_url: string;
  confirmed: boolean | null;
  file_name: string;
  processed?: boolean;
  email: string;
  external_user_id: string;
  edition_total?: number | null;
  edition_sold?: number | null;
  gallery_type?: string | null;
  created_at?: string | null;
  confirmed_at?: string | null;
  display_start_at?: string | null;
  display_end_at?: string | null;
  display_plan?: string | null;
  display_ready?: boolean | null;
  is_sold?: boolean | null;
  meish_fee_yen?: number | null;
  artist_reward_yen?: number | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  reject_email_sent_at?: string | null;
  processing_job?: ProcessingJob | null;
};

type SortKey = 'created_at' | 'confirmed_at' | 'display_start_at';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'unreviewed' | 'approved' | 'rejected' | 'processing';
type WorkflowPhase =
  | 'unreviewed'
  | 'approved_queued'
  | 'processing'
  | 'processing_failed'
  | 'ready_to_enable'
  | 'displaying'
  | 'ended'
  | 'rejected';

type WorkflowOverview = {
  total: number;
  phases: Record<WorkflowPhase, number>;
  actionRequired: {
    needsReview: number;
    processingFailed: number;
    stalled: number;
    readyToEnable: number;
    total: number;
  };
};

type Props = { adminEmail: string };

const WORKFLOW_FLOW: { key: WorkflowPhase; label: string; className: string }[] = [
  { key: 'unreviewed', label: '未審査', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'approved_queued', label: '承認済(待機)', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'processing', label: '処理中', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'processing_failed', label: '処理失敗', className: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'ready_to_enable', label: '展示準備OK', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'displaying', label: '展示中', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'ended', label: '展示終了', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'rejected', label: '却下', className: 'bg-rose-50 text-rose-700 border-rose-200' },
];

// ステータスタブの定義
const STATUS_TABS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'すべて', color: 'gray' },
  { value: 'unreviewed', label: '未審査', color: 'amber' },
  { value: 'approved', label: '承認済み', color: 'emerald' },
  { value: 'processing', label: '展示待ち', color: 'sky' },
  { value: 'rejected', label: '却下', color: 'red' },
];

// ユーティリティ
const formatDate = (d?: string | null) => {
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));
  } catch {
    return '-';
  }
};

const formatDateFull = (d?: string | null) => {
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));
  } catch {
    return '-';
  }
};

// ステータスバッジ
function StatusBadge({ entry }: { entry: Entry }) {
  if (entry.confirmed === true) {
    if (entry.display_ready) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
          <Eye className="h-3 w-3" />
          展示中
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium">
        <Clock className="h-3 w-3" />
        展示待ち
      </span>
    );
  }
  if (entry.confirmed === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
        <XCircle className="h-3 w-3" />
        却下
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
      <AlertCircle className="h-3 w-3" />
      未審査
    </span>
  );
}

// 処理ステータスバッジ
function ProcessingBadge({ entry }: { entry: Entry }) {
  const job = entry.processing_job;

  if (entry.display_ready) {
    return <span className="text-xs text-emerald-600">完了</span>;
  }

  if (!job) {
    if (entry.confirmed === true) {
      return <span className="text-xs text-gray-400">-</span>;
    }
    return null;
  }

  switch (job.status) {
    case 'queued':
      return <span className="text-xs text-blue-600">キュー待ち</span>;
    case 'running':
      return <span className="text-xs text-amber-600">処理中</span>;
    case 'succeeded':
      return <span className="text-xs text-sky-600">処理完了</span>;
    case 'failed':
      return (
        <span className="text-xs text-red-600" title={job.last_error || undefined}>
          失敗
        </span>
      );
    default:
      return null;
  }
}

// 展示有効化可能かどうか
function canEnableDisplay(e: Entry): boolean {
  if (e.confirmed !== true) return false;
  if (e.display_ready) return false;
  const hasFinalUrl = typeof e.image_url === 'string' && e.image_url.includes('/final/');
  const jobOk = e.processing_job?.status === 'succeeded';
  return hasFinalUrl || jobOk;
}

function toTime(d?: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

function getEntryPhase(entry: Entry): WorkflowPhase {
  if (entry.confirmed === false) return 'rejected';
  if (entry.display_ready) {
    const endAt = toTime(entry.display_end_at);
    if (endAt && endAt <= Date.now()) return 'ended';
    return 'displaying';
  }
  if (entry.confirmed === null) return 'unreviewed';
  if (entry.confirmed === true && canEnableDisplay(entry)) return 'ready_to_enable';
  if (entry.processing_job?.status === 'failed') return 'processing_failed';
  if (entry.processing_job?.status === 'running') return 'processing';
  return 'approved_queued';
}

function getRowAccent(phase: WorkflowPhase): string {
  if (phase === 'processing_failed') return 'bg-red-500';
  if (phase === 'unreviewed') return 'bg-amber-500';
  if (phase === 'ready_to_enable') return 'bg-sky-500';
  if (phase === 'displaying') return 'bg-emerald-500';
  if (phase === 'processing') return 'bg-indigo-500';
  if (phase === 'approved_queued') return 'bg-blue-500';
  if (phase === 'rejected') return 'bg-rose-500';
  return 'bg-gray-400';
}

export default function AdminEntriesClient({ adminEmail }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [overview, setOverview] = useState<WorkflowOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // フィルタ・並び
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [galleryFilter, setGalleryFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [keyword, setKeyword] = useState<string>('');

  // 展開行
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 処理中フラグ
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const mountedRef = useRef(true);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // API
  const api = useMemo(() => ({
    list: async () => {
      const sp = new URLSearchParams({
        gallery: galleryFilter,
        status: statusFilter,
        sortKey,
        sortOrder,
        keyword,
      });
      const res = await fetch(`/admin/api/entries?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('取得に失敗しました');
      return (await res.json()) as Entry[];
    },
    patch: async (id: number, patch: Partial<Entry>) => {
      const res = await fetch(`/admin/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      return (await res.json()) as Entry;
    },
  }), [galleryFilter, statusFilter, sortKey, sortOrder, keyword]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.list();
      if (mountedRef.current) setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api]);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const sp = new URLSearchParams();
      if (galleryFilter !== 'all') {
        sp.set('gallery', galleryFilter);
      }
      const suffix = sp.toString() ? `?${sp.toString()}` : '';
      const res = await fetch(`/admin/api/entries/overview${suffix}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('overview_fetch_failed');
      const json = (await res.json()) as WorkflowOverview;
      if (mountedRef.current) setOverview(json);
    } catch {
      if (mountedRef.current) setOverview(null);
    } finally {
      if (mountedRef.current) setOverviewLoading(false);
    }
  }, [galleryFilter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEntries();
    fetchOverview();
    return () => { mountedRef.current = false; };
  }, [fetchEntries, fetchOverview]);

  // 集計
  const counts = useMemo(() => ({
    all: entries.length,
    unreviewed: entries.filter((e) => e.confirmed === null).length,
    approved: entries.filter((e) => e.confirmed === true).length,
    rejected: entries.filter((e) => e.confirmed === false).length,
    processing: entries.filter((e) => e.confirmed === true && !e.display_ready).length,
    enableCandidates: entries.filter(canEnableDisplay).length,
  }), [entries]);

  const sortedEntries = useMemo(() => {
    const rank: Record<WorkflowPhase, number> = {
      unreviewed: 0,
      processing_failed: 1,
      ready_to_enable: 2,
      processing: 3,
      approved_queued: 4,
      rejected: 5,
      displaying: 6,
      ended: 7,
    };

    return [...entries].sort((a, b) => {
      const pa = getEntryPhase(a);
      const pb = getEntryPhase(b);
      if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
      const ta = toTime(a.created_at) ?? 0;
      const tb = toTime(b.created_at) ?? 0;
      return tb - ta;
    });
  }, [entries]);

  // アクション
  const approveEntry = async (entry: Entry) => {
    if (processingIds.has(entry.id)) return;
    setProcessingIds((prev) => new Set(prev).add(entry.id));
    try {
      const result = await approveEntryAction(entry.id);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, ...result.entry, processing_job: result.job } : e
        )
      );
      fetchOverview();
      showToast('承認しました');
    } catch (e: unknown) {
      showToast(`承認に失敗: ${e instanceof Error ? e.message : 'エラー'}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const rejectEntry = async (entry: Entry) => {
    if (processingIds.has(entry.id)) return;
    const reason = window.prompt('却下理由（任意）') || null;
    setProcessingIds((prev) => new Set(prev).add(entry.id));
    try {
      const result = await rejectEntryAction(entry.id, reason);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...result.entry } : e)));
      fetchOverview();
      showToast('却下しました');
    } catch (e: unknown) {
      showToast(`却下に失敗: ${e instanceof Error ? e.message : 'エラー'}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const resetReview = async (entry: Entry) => {
    if (processingIds.has(entry.id)) return;
    setProcessingIds((prev) => new Set(prev).add(entry.id));
    try {
      const result = await resetEntryAction(entry.id);
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, ...result.entry, processing_job: null } : e))
      );
      fetchOverview();
      showToast('未審査に戻しました');
    } catch (e: unknown) {
      showToast(`リセットに失敗: ${e instanceof Error ? e.message : 'エラー'}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const enableDisplay = async (entry: Entry) => {
    if (processingIds.has(entry.id)) return;
    if (!canEnableDisplay(entry)) {
      const ok = window.confirm('画像処理が完了していない可能性があります。それでも展示を有効化しますか？');
      if (!ok) return;
    }
    setProcessingIds((prev) => new Set(prev).add(entry.id));
    try {
      const saved = await api.patch(entry.id, { display_ready: true });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...saved } : e)));
      fetchOverview();
      showToast('展示を有効化しました');
    } catch (e: unknown) {
      showToast(`有効化に失敗: ${e instanceof Error ? e.message : 'エラー'}`);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  const bulkEnableDisplay = async () => {
    const targets = entries.filter(canEnableDisplay);
    if (targets.length === 0) {
      showToast('有効化候補がありません');
      return;
    }
    const ok = window.confirm(`${targets.length}件の展示を一括有効化します。続行しますか？`);
    if (!ok) return;

    setProcessingIds((prev) => {
      const next = new Set(prev);
      targets.forEach((t) => next.add(t.id));
      return next;
    });

    try {
      for (const t of targets) {
        await api.patch(t.id, { display_ready: true });
      }
      showToast(`${targets.length}件を有効化しました`);
      await fetchEntries();
      fetchOverview();
    } catch {
      showToast('一括有効化で失敗しました');
      await fetchEntries();
      fetchOverview();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
    }
  };

  const updateField = async <K extends keyof Entry>(id: number, field: K, value: Entry[K]) => {
    const before = entries.find((e) => e.id === id);
    if (!before) return;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    try {
      const saved = await api.patch(id, { [field]: value } as Partial<Entry>);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...saved } : e)));
      showToast('保存しました');
    } catch {
      setEntries((prev) => prev.map((e) => (e.id === id ? before : e)));
      showToast('保存に失敗しました');
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 pt-[70px]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 rounded-lg bg-gray-900 text-white px-4 py-2 shadow-lg">
            {toast}
          </div>
        )}

        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">作品管理</h1>
          <p className="text-sm text-gray-500 mt-1">ログイン中: {adminEmail}</p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <button
            onClick={() => setStatusFilter('unreviewed')}
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left hover:bg-amber-100"
          >
            <div className="text-xs font-medium text-amber-700">今やる: 未審査を処理</div>
            <div className="mt-1 text-2xl font-bold text-amber-900">{overview?.actionRequired.needsReview ?? counts.unreviewed}件</div>
          </button>
          <button
            onClick={() => setStatusFilter('processing')}
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-left hover:bg-red-100"
          >
            <div className="text-xs font-medium text-red-700">今やる: 失敗/停滞を解消</div>
            <div className="mt-1 text-2xl font-bold text-red-900">
              {(overview?.actionRequired.processingFailed ?? 0) + (overview?.actionRequired.stalled ?? 0)}件
            </div>
          </button>
          <button
            onClick={() => setStatusFilter('processing')}
            className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-left hover:bg-sky-100"
          >
            <div className="text-xs font-medium text-sky-700">今やる: 展示を有効化</div>
            <div className="mt-1 text-2xl font-bold text-sky-900">{overview?.actionRequired.readyToEnable ?? counts.enableCandidates}件</div>
          </button>
        </div>

        <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">現在の運用フロー</h2>
            <span className="text-xs text-gray-500">
              {overviewLoading ? '集計中...' : `対象: ${overview?.total ?? 0}件`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
            {WORKFLOW_FLOW.map((phase) => (
              <div
                key={phase.key}
                className={`rounded-lg border px-3 py-2 ${phase.className}`}
              >
                <div className="text-[11px] font-medium">{phase.label}</div>
                <div className="mt-1 text-lg font-semibold">{overview?.phases[phase.key] ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[11px] text-amber-700">要審査</div>
              <div className="text-sm font-semibold text-amber-900">{overview?.actionRequired.needsReview ?? 0}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <div className="text-[11px] text-red-700">処理失敗</div>
              <div className="text-sm font-semibold text-red-900">{overview?.actionRequired.processingFailed ?? 0}</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <div className="text-[11px] text-orange-700">停滞中</div>
              <div className="text-sm font-semibold text-orange-900">{overview?.actionRequired.stalled ?? 0}</div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <div className="text-[11px] text-sky-700">展示可</div>
              <div className="text-sm font-semibold text-sky-900">{overview?.actionRequired.readyToEnable ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-[11px] text-gray-600">要対応合計</div>
              <div className="text-sm font-semibold text-gray-900">{overview?.actionRequired.total ?? 0}</div>
            </div>
          </div>
        </div>

        {/* タブフィルター */}
        <div className="flex flex-wrap items-center gap-2 mb-4 border-b">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? counts.all :
              tab.value === 'unreviewed' ? counts.unreviewed :
              tab.value === 'approved' ? counts.approved :
              tab.value === 'rejected' ? counts.rejected :
              counts.processing;

            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  isActive
                    ? `border-${tab.color}-500 text-${tab.color}-700`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={isActive ? {
                  borderColor: tab.color === 'gray' ? '#6b7280' :
                    tab.color === 'amber' ? '#f59e0b' :
                    tab.color === 'emerald' ? '#10b981' :
                    tab.color === 'sky' ? '#0ea5e9' : '#ef4444',
                  color: tab.color === 'gray' ? '#374151' :
                    tab.color === 'amber' ? '#b45309' :
                    tab.color === 'emerald' ? '#047857' :
                    tab.color === 'sky' ? '#0369a1' : '#b91c1c',
                } : {}}
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ツールバー */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* 検索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="タイトル / 作家名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* ギャラリー */}
          <select
            value={galleryFilter}
            onChange={(e) => setGalleryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">全ギャラリー</option>
            <option value="white">White</option>
            <option value="float">Float</option>
            <option value="special">Special</option>
          </select>

          {/* ソート */}
          <select
            value={`${sortKey}-${sortOrder}`}
            onChange={(e) => {
              const [k, o] = e.target.value.split('-') as [SortKey, SortOrder];
              setSortKey(k);
              setSortOrder(o);
            }}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="created_at-desc">応募日時（新しい順）</option>
            <option value="created_at-asc">応募日時（古い順）</option>
            <option value="confirmed_at-desc">承認日時（新しい順）</option>
            <option value="display_start_at-desc">展示開始（新しい順）</option>
          </select>

          <div className="flex-1" />

          {/* 一括有効化 */}
          {counts.enableCandidates > 0 && (
            <button
              onClick={bulkEnableDisplay}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              一括有効化（{counts.enableCandidates}）
            </button>
          )}

          {/* 更新 */}
          <button
            onClick={fetchEntries}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {/* テーブル */}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            該当する作品がありません
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-2"></th>
                  <th className="w-10 px-4 py-3"></th>
                  <th className="w-16 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作品</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作家</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">処理</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">次アクション</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">応募日</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedEntries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const isProcessing = processingIds.has(entry.id);
                  const canEnable = canEnableDisplay(entry);
                  const phase = getEntryPhase(entry);

                  return (
                    <>
                      {/* メイン行 */}
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-sky-50' : ''}`}
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <td className="p-0">
                          <div className={`h-full min-h-[72px] w-1.5 ${getRowAccent(phase)}`} />
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                            {entry.image_url ? (
                              <img
                                src={entry.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                No img
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]">
                            {entry.title || `(無題 #${entry.id})`}
                          </div>
                          <div className="text-xs text-gray-500">{entry.gallery_type || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 truncate max-w-[150px]">
                            {entry.artist_name || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge entry={entry} />
                        </td>
                        <td className="px-4 py-3">
                          <ProcessingBadge entry={entry} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {entry.confirmed === null ? (
                            <button
                              onClick={() => approveEntry(entry)}
                              disabled={isProcessing}
                              className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                              まず承認
                            </button>
                          ) : entry.confirmed === true && !entry.display_ready ? (
                            <button
                              onClick={() => enableDisplay(entry)}
                              disabled={isProcessing}
                              className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                                canEnable
                                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {canEnable ? '展示を開始' : '強制で展示開始'}
                            </button>
                          ) : entry.confirmed === false ? (
                            <button
                              onClick={() => resetReview(entry)}
                              disabled={isProcessing}
                              className="px-3 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-50"
                            >
                              未審査に戻す
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">対応不要</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* 未審査の場合 */}
                            {entry.confirmed === null && (
                              <>
                                <button
                                  onClick={() => approveEntry(entry)}
                                  disabled={isProcessing}
                                  className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  承認
                                </button>
                                <button
                                  onClick={() => rejectEntry(entry)}
                                  disabled={isProcessing}
                                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  却下
                                </button>
                              </>
                            )}

                            {/* 承認済み・展示待ち */}
                            {entry.confirmed === true && !entry.display_ready && (
                              <button
                                onClick={() => enableDisplay(entry)}
                                disabled={isProcessing}
                                className={`px-3 py-1 text-xs rounded disabled:opacity-50 ${
                                  canEnable
                                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                                >
                                  展示有効化
                                </button>
                            )}

                            {/* 展示中 */}
                            {entry.display_ready && (
                              <span className="text-xs text-emerald-600 font-medium">展示中</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 展開行 */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-gray-50">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* 画像・基本情報 */}
                              <div className="flex gap-4">
                                <a
                                  href={entry.image_url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0"
                                >
                                  <img
                                    src={entry.image_url || '/images/placeholder.png'}
                                    alt=""
                                    className="w-32 h-32 object-cover rounded-lg shadow"
                                  />
                                </a>
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-500">ID:</span> {entry.id}
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Email:</span>{' '}
                                    <a href={`mailto:${entry.email}`} className="text-sky-600 hover:underline">
                                      {entry.email}
                                    </a>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">応募日:</span> {formatDateFull(entry.created_at)}
                                  </div>
                                  <div>
                                    <span className="text-gray-500">承認日:</span> {formatDateFull(entry.confirmed_at)}
                                  </div>
                                </div>
                              </div>

                              {/* 展示設定 */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900">展示設定</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">開始日時</span>
                                    <input
                                      type="datetime-local"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_start_at?.slice(0, 16) || ''}
                                      onChange={(e) => updateField(entry.id, 'display_start_at', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">終了日時</span>
                                    <input
                                      type="datetime-local"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_end_at?.slice(0, 16) || ''}
                                      onChange={(e) => updateField(entry.id, 'display_end_at', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">プラン</span>
                                    <input
                                      type="text"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_plan || ''}
                                      onChange={(e) => updateField(entry.id, 'display_plan', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-gray-500 text-xs">エディション</span>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        className="px-2 py-1 border rounded text-sm w-16"
                                        value={entry.edition_sold ?? 0}
                                        onChange={(e) => updateField(entry.id, 'edition_sold', Number(e.target.value))}
                                      />
                                      <span>/</span>
                                      <input
                                        type="number"
                                        className="px-2 py-1 border rounded text-sm w-16"
                                        value={entry.edition_total ?? 0}
                                        onChange={(e) => updateField(entry.id, 'edition_total', Number(e.target.value))}
                                      />
                                    </div>
                                  </label>
                                </div>
                              </div>

                              {/* アクション */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900">アクション</h4>
                                <div className="flex flex-wrap gap-2">
                                  {entry.confirmed !== null && (
                                    <button
                                      onClick={() => resetReview(entry)}
                                      disabled={isProcessing}
                                      className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 disabled:opacity-50"
                                    >
                                      未審査に戻す
                                    </button>
                                  )}
                                  {entry.image_url && (
                                    <a
                                      href={entry.image_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      画像を開く
                                    </a>
                                  )}
                                  {entry.email && (
                                    <a
                                      href={`mailto:${entry.email}`}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 border rounded text-sm hover:bg-gray-100"
                                    >
                                      <Mail className="h-3 w-3" />
                                      メール
                                    </a>
                                  )}
                                </div>

                                {/* 却下理由（却下済みの場合） */}
                                {entry.confirmed === false && entry.reject_reason && (
                                  <div className="mt-3 p-2 bg-red-50 rounded text-sm">
                                    <span className="text-red-600 font-medium">却下理由:</span>{' '}
                                    <span className="text-red-700">{entry.reject_reason}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

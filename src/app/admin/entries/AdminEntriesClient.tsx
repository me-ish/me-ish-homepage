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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  RefreshCw,
  ExternalLink,
  Mail,
  Loader2,
  AlertCircle,
  LayoutGrid,
  List,
  Square,
  CheckSquare,
  Minus,
} from 'lucide-react';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type Entry = {
  id: number;
  artist_name: string;
  title: string;
  image_url: string;
  confirmed: boolean | null;
  file_name: string;
  processed?: boolean;
  email: string;
  is_for_sale?: boolean;
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
  plan_payment_status?: 'unneeded' | 'pending' | 'paid' | null;
  plan_payment_amount_yen?: number | null;
  plan_payment_session_id?: string | null;
  plan_payment_paid_at?: string | null;
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
type ViewMode = 'table' | 'kanban';
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
  { key: 'unreviewed', label: '未審査', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'approved_queued', label: '承認済(待機)', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'processing', label: '処理中', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { key: 'ready_to_enable', label: '展示可', className: 'bg-sky-100 text-sky-800 border-sky-300' },
  { key: 'displaying', label: '展示中', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { key: 'ended', label: '展示終了', className: 'bg-neutral-100 text-neutral-700 border-neutral-300' },
];

const WORKFLOW_BRANCHES: { key: WorkflowPhase; label: string; className: string }[] = [
  { key: 'rejected', label: '却下', className: 'bg-rose-100 text-rose-800 border-rose-300' },
  { key: 'processing_failed', label: '処理失敗', className: 'bg-red-100 text-red-800 border-red-300' },
];

const FLOW_NODE_WIDTH = 132;
const FLOW_ARROW_GAP = 20;
const FLOW_NODE_LEFTS = [0, 152, 304, 456, 608, 760] as const;
const FLOW_CANVAS_WIDTH = 892;
const FLOW_MAIN_Y = 0;
const FLOW_NODE_HEIGHT = 58;
const FLOW_BRANCH_Y = 102;

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
      return <span className="text-xs text-neutral-500">-</span>;
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
  const paidPlan = e.is_for_sale === true && (e.display_plan ?? 'free') !== 'free';
  const planPaid = (e.plan_payment_status ?? 'unneeded') === 'paid';
  if (paidPlan && !planPaid) return false;
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
  return 'bg-neutral-600';
}

function phaseToStatusFilter(phase: WorkflowPhase): StatusFilter {
  if (phase === 'unreviewed') return 'unreviewed';
  if (phase === 'rejected') return 'rejected';
  if (phase === 'displaying' || phase === 'ended') return 'approved';
  return 'processing';
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

  // 選択状態
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 表示モード
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

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

  // 自動同期: 処理完了したエントリのdisplay_readyを自動更新
  const syncDisplayReady = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/entries/sync-display-ready', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.updated > 0) {
          showToast(`${data.updated}件を自動同期しました`);
        }
      }
    } catch {
      // 自動同期の失敗は静かに無視
    } finally {
      // 同期成否に関わらずデータを取得
      fetchEntries();
      fetchOverview();
    }
  }, [fetchEntries, fetchOverview]);

  useEffect(() => {
    mountedRef.current = true;
    // 初回ロード時に自動同期を実行してからデータ取得
    syncDisplayReady();
    return () => { mountedRef.current = false; };
  }, [syncDisplayReady]);

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

  // ページネーション計算
  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedEntries.slice(start, start + pageSize);
  }, [sortedEntries, currentPage, pageSize]);

  // フィルタ変更時にページをリセット
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, galleryFilter, keyword, pageSize]);

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

  const createPlanCheckoutLink = async (entry: Entry) => {
    if (processingIds.has(entry.id)) return;
    setProcessingIds((prev) => new Set(prev).add(entry.id));
    try {
      const res = await fetch(`/admin/api/entries/${entry.id}/plan-checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const json = await res.json().catch(() => ({} as { url?: string; error?: string; alreadyPaid?: boolean }));
      if (!res.ok) {
        throw new Error(json?.error || 'checkout_create_failed');
      }
      if (json.alreadyPaid) {
        showToast('この作品のプラン料金はすでに決済済みです');
        return;
      }
      if (!json.url) {
        throw new Error('checkout_url_missing');
      }
      try {
        await navigator.clipboard.writeText(json.url);
        showToast('決済URLをクリップボードにコピーしました');
      } catch {
        showToast('決済URLを作成しました（コピーに失敗）');
      }
      fetchEntries();
      fetchOverview();
    } catch (e: unknown) {
      showToast(`決済URL作成に失敗: ${e instanceof Error ? e.message : 'エラー'}`);
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

  // 選択ヘルパー
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedEntries.map((e) => e.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id)),
    [entries, selectedIds]
  );

  // 一括承認
  const bulkApprove = async () => {
    const targets = selectedEntries.filter((e) => e.confirmed === null);
    if (targets.length === 0) {
      showToast('承認可能な作品がありません');
      return;
    }
    const ok = window.confirm(`${targets.length}件を一括承認します。続行しますか？`);
    if (!ok) return;

    setProcessingIds((prev) => {
      const next = new Set(prev);
      targets.forEach((t) => next.add(t.id));
      return next;
    });

    let successCount = 0;
    try {
      for (const t of targets) {
        try {
          const result = await approveEntryAction(t.id);
          setEntries((prev) =>
            prev.map((e) =>
              e.id === t.id ? { ...e, ...result.entry, processing_job: result.job } : e
            )
          );
          successCount++;
        } catch {
          // 個別エラーは無視して続行
        }
      }
      showToast(`${successCount}件を承認しました`);
      fetchOverview();
      clearSelection();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
    }
  };

  // 一括却下
  const bulkReject = async () => {
    const targets = selectedEntries.filter((e) => e.confirmed === null);
    if (targets.length === 0) {
      showToast('却下可能な作品がありません');
      return;
    }
    const reason = window.prompt(`${targets.length}件を一括却下します。却下理由（任意）:`);
    if (reason === null) return; // キャンセル

    setProcessingIds((prev) => {
      const next = new Set(prev);
      targets.forEach((t) => next.add(t.id));
      return next;
    });

    let successCount = 0;
    try {
      for (const t of targets) {
        try {
          const result = await rejectEntryAction(t.id, reason || null);
          setEntries((prev) => prev.map((e) => (e.id === t.id ? { ...e, ...result.entry } : e)));
          successCount++;
        } catch {
          // 個別エラーは無視して続行
        }
      }
      showToast(`${successCount}件を却下しました`);
      fetchOverview();
      clearSelection();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
    }
  };

  // 一括展示有効化（選択ベース）
  const bulkEnableSelected = async () => {
    const targets = selectedEntries.filter(canEnableDisplay);
    if (targets.length === 0) {
      showToast('有効化可能な作品がありません');
      return;
    }
    const ok = window.confirm(`${targets.length}件の展示を有効化します。続行しますか？`);
    if (!ok) return;

    setProcessingIds((prev) => {
      const next = new Set(prev);
      targets.forEach((t) => next.add(t.id));
      return next;
    });

    let successCount = 0;
    try {
      for (const t of targets) {
        try {
          const saved = await api.patch(t.id, { display_ready: true });
          setEntries((prev) => prev.map((e) => (e.id === t.id ? { ...e, ...saved } : e)));
          successCount++;
        } catch {
          // 個別エラーは無視して続行
        }
      }
      showToast(`${successCount}件を有効化しました`);
      fetchOverview();
      clearSelection();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.id));
        return next;
      });
    }
  };

  // カンバン用: フェーズごとにエントリをグループ化
  const entriesByPhase = useMemo(() => {
    const grouped: Record<WorkflowPhase, Entry[]> = {
      unreviewed: [],
      approved_queued: [],
      processing: [],
      processing_failed: [],
      ready_to_enable: [],
      displaying: [],
      ended: [],
      rejected: [],
    };
    for (const entry of sortedEntries) {
      const phase = getEntryPhase(entry);
      grouped[phase].push(entry);
    }
    return grouped;
  }, [sortedEntries]);

  return (
    <main className="min-h-screen bg-[#f7fbff] pt-[70px]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-neutral-800 shadow-lg">
            {toast}
          </div>
        )}

        {/* ヘッダー */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">作品管理</h1>
            <p className="text-sm text-neutral-500 mt-1">{adminEmail}</p>
          </div>
          <div className="text-sm text-neutral-600">
            {overviewLoading ? '集計中...' : `${overview?.total ?? entries.length}件`}
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">ワークフロー</h2>
            <span className="text-xs text-neutral-500">クリックで絞り込み</span>
          </div>
          <div className="mt-3 overflow-x-auto pb-2">
            <div className="relative h-[158px]" style={{ width: FLOW_CANVAS_WIDTH }}>
              <svg
                className="pointer-events-none absolute inset-0"
                width={FLOW_CANVAS_WIDTH}
                height={158}
                viewBox={`0 0 ${FLOW_CANVAS_WIDTH} 158`}
                aria-hidden
              >
                <defs>
                  <marker
                    id="workflow-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="#cbd5e1" />
                  </marker>
                </defs>
                {FLOW_NODE_LEFTS.slice(0, -1).map((left, i) => {
                  const mainLineColor =
                    i === 0 ? '#93c5fd' :
                    i === 1 ? '#a5b4fc' :
                    i === 2 ? '#7dd3fc' :
                    i === 3 ? '#86efac' : '#d1d5db';
                  return (
                  <line
                    key={`main-${i}`}
                    x1={left + FLOW_NODE_WIDTH}
                    y1={FLOW_MAIN_Y + FLOW_NODE_HEIGHT / 2}
                    x2={FLOW_NODE_LEFTS[i + 1]}
                    y2={FLOW_MAIN_Y + FLOW_NODE_HEIGHT / 2}
                    stroke={mainLineColor}
                    strokeWidth="1.5"
                    markerEnd="url(#workflow-arrow)"
                  />
                  );
                })}
                <line
                  x1={FLOW_NODE_LEFTS[0] + FLOW_NODE_WIDTH / 2}
                  y1={FLOW_MAIN_Y + FLOW_NODE_HEIGHT}
                  x2={FLOW_NODE_LEFTS[0] + FLOW_NODE_WIDTH / 2}
                  y2={FLOW_BRANCH_Y - 6}
                  stroke="#f9a8d4"
                  strokeWidth="1.5"
                  markerEnd="url(#workflow-arrow)"
                />
                <line
                  x1={FLOW_NODE_LEFTS[2] + FLOW_NODE_WIDTH / 2}
                  y1={FLOW_MAIN_Y + FLOW_NODE_HEIGHT}
                  x2={FLOW_NODE_LEFTS[2] + FLOW_NODE_WIDTH / 2}
                  y2={FLOW_BRANCH_Y - 6}
                  stroke="#fca5a5"
                  strokeWidth="1.5"
                  markerEnd="url(#workflow-arrow)"
                />
              </svg>

              {WORKFLOW_FLOW.map((phase, idx) => {
                const count = overview?.phases[phase.key] ?? 0;
                const isActionable = (phase.key === 'unreviewed' || phase.key === 'ready_to_enable') && count > 0;
                return (
                  <button
                    key={phase.key}
                    onClick={() => setStatusFilter(phaseToStatusFilter(phase.key))}
                    className={`absolute w-[132px] rounded-lg border px-3 py-2 text-left transition hover:opacity-90 ${phase.className} ${
                      isActionable ? 'ring-1 ring-amber-400/50' : ''
                    }`}
                    style={{ left: FLOW_NODE_LEFTS[idx], top: FLOW_MAIN_Y }}
                  >
                    <div className="text-[11px] font-medium">{phase.label}</div>
                    <div className="mt-1 text-lg font-semibold leading-none">{count}</div>
                  </button>
                );
              })}

              {WORKFLOW_BRANCHES.map((phase) => {
                const count = overview?.phases[phase.key] ?? 0;
                const left = phase.key === 'rejected' ? FLOW_NODE_LEFTS[0] : FLOW_NODE_LEFTS[2];
                return (
                  <button
                    key={phase.key}
                    onClick={() => setStatusFilter(phaseToStatusFilter(phase.key))}
                    className={`absolute w-[132px] rounded-lg border px-3 py-2 text-left ${phase.className}`}
                    style={{ left, top: FLOW_BRANCH_Y }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{phase.label}</span>
                      <span className="text-lg font-semibold">{count}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* タブフィルター */}
        <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-neutral-200">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all' ? counts.all :
              tab.value === 'unreviewed' ? counts.unreviewed :
              tab.value === 'approved' ? counts.approved :
              tab.value === 'rejected' ? counts.rejected :
              counts.processing;

            const isActive = statusFilter === tab.value;
            const activeColors: Record<string, string> = {
              gray: 'border-neutral-400 text-neutral-700',
              amber: 'border-amber-400 text-amber-300',
              emerald: 'border-emerald-400 text-emerald-300',
              sky: 'border-sky-400 text-sky-300',
              red: 'border-red-400 text-red-300',
            };
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  isActive
                    ? activeColors[tab.color]
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  isActive ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="タイトル / 作家名"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-64 rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
            />
          </div>

          {/* ギャラリー */}
          <select
            value={galleryFilter}
            onChange={(e) => setGalleryFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none"
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
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none"
          >
            <option value="created_at-desc">応募日時（新しい順）</option>
            <option value="created_at-asc">応募日時（古い順）</option>
            <option value="confirmed_at-desc">承認日時（新しい順）</option>
            <option value="display_start_at-desc">展示開始（新しい順）</option>
          </select>

          <div className="flex-1" />

          {/* 表示切替 */}
          <div className="inline-flex overflow-hidden rounded-lg border border-neutral-300">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${
                viewMode === 'table'
                  ? 'bg-neutral-100 text-neutral-800'
                  : 'bg-white text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <List className="h-4 w-4" />
              テーブル
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition ${
                viewMode === 'kanban'
                  ? 'bg-neutral-100 text-neutral-800'
                  : 'bg-white text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              カンバン
            </button>
          </div>

          {/* 一括有効化 */}
          {counts.enableCandidates > 0 && viewMode === 'table' && (
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
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {/* 選択時の一括操作バー */}
        {selectedIds.size > 0 && viewMode === 'table' && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3">
            <span className="text-sm font-medium text-sky-300">
              {selectedIds.size}件選択中
              {selectedIds.size < sortedEntries.length && (
                <button
                  onClick={selectAll}
                  className="ml-2 text-sky-400 hover:text-sky-200 underline"
                >
                  全{sortedEntries.length}件を選択
                </button>
              )}
            </span>
            <div className="h-4 w-px bg-sky-500/30" />
            <button
              onClick={bulkApprove}
              disabled={selectedEntries.filter((e) => e.confirmed === null).length === 0}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              一括承認
            </button>
            <button
              onClick={bulkReject}
              disabled={selectedEntries.filter((e) => e.confirmed === null).length === 0}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              一括却下
            </button>
            <button
              onClick={bulkEnableSelected}
              disabled={selectedEntries.filter(canEnableDisplay).length === 0}
              className="px-3 py-1.5 bg-sky-600 text-white text-xs font-medium rounded hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              一括有効化
            </button>
            <div className="flex-1" />
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 border border-sky-500/30 text-sky-300 text-xs font-medium rounded hover:bg-sky-500/20"
            >
              選択解除
            </button>
          </div>
        )}

        {/* テーブル表示 */}
        {viewMode === 'table' && (
          <>
            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                {error}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-20 text-neutral-500">
                該当する作品がありません
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <table className="w-full">
                  <thead className="border-b border-neutral-200 bg-neutral-50">
                    <tr>
                      <th className="w-2"></th>
                      {/* チェックボックス */}
                      <th className="w-10 px-2 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const pageIds = paginatedEntries.map((e) => e.id);
                            const allPageSelected = pageIds.every((id) => selectedIds.has(id));
                            if (allPageSelected) {
                              // このページの選択を解除
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                pageIds.forEach((id) => next.delete(id));
                                return next;
                              });
                            } else {
                              // このページを全選択
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                pageIds.forEach((id) => next.add(id));
                                return next;
                              });
                            }
                          }}
                          className="rounded p-1 hover:bg-neutral-100"
                          title="このページを選択"
                        >
                          {(() => {
                            const pageIds = paginatedEntries.map((e) => e.id);
                            const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
                            if (selectedOnPage === 0) {
                              return <Square className="h-4 w-4 text-neutral-500" />;
                            } else if (selectedOnPage === pageIds.length) {
                              return <CheckSquare className="h-4 w-4 text-sky-400" />;
                            } else {
                              return <Minus className="h-4 w-4 text-sky-400" />;
                            }
                          })()}
                        </button>
                      </th>
                      <th className="w-10 px-4 py-3"></th>
                      <th className="w-16 px-4 py-3"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">作品</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">作家</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">処理</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">応募日</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {paginatedEntries.map((entry) => {
                      const isExpanded = expandedId === entry.id;
                      const isProcessing = processingIds.has(entry.id);
                      const canEnable = canEnableDisplay(entry);
                      const paidPlan = entry.is_for_sale === true && (entry.display_plan ?? 'free') !== 'free';
                      const planPaid = (entry.plan_payment_status ?? 'unneeded') === 'paid';
                      const phase = getEntryPhase(entry);
                      const isSelected = selectedIds.has(entry.id);

                      return (
                        <>
                          {/* メイン行 */}
                          <tr
                            key={entry.id}
                            className={`cursor-pointer hover:bg-neutral-50 ${isExpanded ? 'bg-neutral-50' : ''} ${isSelected ? 'bg-sky-500/10' : ''}`}
                            onClick={() => toggleExpand(entry.id)}
                          >
                            <td className="p-0">
                              <div className={`h-full min-h-[72px] w-1.5 ${getRowAccent(phase)}`} />
                            </td>
                            {/* チェックボックス */}
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => toggleSelect(entry.id)}
                                className="rounded p-1 hover:bg-neutral-100"
                              >
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-sky-400" />
                                ) : (
                                  <Square className="h-4 w-4 text-neutral-500" />
                                )}
                              </button>
                            </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-neutral-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-neutral-500" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-12 w-12 overflow-hidden rounded bg-neutral-100">
                            {entry.image_url ? (
                              <img
                                src={entry.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                                No img
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[200px] truncate font-medium text-neutral-900">
                            {entry.title || `(無題 #${entry.id})`}
                          </div>
                          <div className="text-xs text-neutral-500">{entry.gallery_type || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[150px] truncate text-sm text-neutral-900">
                            {entry.artist_name || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge entry={entry} />
                        </td>
                        <td className="px-4 py-3">
                          <ProcessingBadge entry={entry} />
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* 未審査: 承認・却下ボタン */}
                            {entry.confirmed === null && (
                              <>
                                <button
                                  onClick={() => approveEntry(entry)}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  承認
                                </button>
                                <button
                                  onClick={() => rejectEntry(entry)}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-medium rounded hover:bg-red-50 disabled:opacity-50"
                                >
                                  却下
                                </button>
                              </>
                            )}

                            {/* 承認済み・展示待ち: 展示有効化 */}
                            {entry.confirmed === true && !entry.display_ready && (
                              <>
                                {paidPlan && !planPaid && (
                                  <button
                                    onClick={() => createPlanCheckoutLink(entry)}
                                    disabled={isProcessing}
                                    className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                  >
                                    Payment URL
                                  </button>
                                )}
                                <button
                                  onClick={() => enableDisplay(entry)}
                                  disabled={isProcessing}
                                  className={`px-3 py-1.5 text-xs font-medium rounded disabled:opacity-50 ${
                                    canEnable
                                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                                      : 'border border-neutral-300 text-neutral-500 hover:bg-neutral-100'
                                  }`}
                                >
                                  {canEnable ? 'Enable display' : 'Payment/processing required'}
                                </button>
                              </>
                            )}

                            {/* 展示中 */}
                            {entry.display_ready && (
                              <span className="text-xs text-emerald-600 font-medium px-2 py-1 bg-emerald-50 rounded">展示中</span>
                            )}

                            {/* 却下済み */}
                            {entry.confirmed === false && (
                              <button
                                onClick={() => resetReview(entry)}
                                disabled={isProcessing}
                                className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                              >
                                再審査
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 展開行 */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-neutral-50">
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
                                    <span className="text-neutral-500">ID:</span> {entry.id}
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">Email:</span>{' '}
                                    <a href={`mailto:${entry.email}`} className="text-sky-600 hover:underline">
                                      {entry.email}
                                    </a>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">応募日:</span> {formatDateFull(entry.created_at)}
                                  </div>
                                  <div>
                                    <span className="text-neutral-500">承認日:</span> {formatDateFull(entry.confirmed_at)}
                                  </div>
                                </div>
                              </div>

                              {/* 展示設定 */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-neutral-800">展示設定</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs text-neutral-500">開始日時</span>
                                    <input
                                      type="datetime-local"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_start_at?.slice(0, 16) || ''}
                                      onChange={(e) => updateField(entry.id, 'display_start_at', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs text-neutral-500">終了日時</span>
                                    <input
                                      type="datetime-local"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_end_at?.slice(0, 16) || ''}
                                      onChange={(e) => updateField(entry.id, 'display_end_at', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs text-neutral-500">プラン</span>
                                    <input
                                      type="text"
                                      className="px-2 py-1 border rounded text-sm"
                                      value={entry.display_plan || ''}
                                      onChange={(e) => updateField(entry.id, 'display_plan', e.target.value)}
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs text-neutral-500">エディション</span>
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
                              <div className="space-y-4">
                                <h4 className="font-medium text-neutral-800">アクション</h4>

                                {/* 主要アクション */}
                                <div className="flex flex-wrap gap-2">
                                  {/* 未審査: 承認/却下 */}
                                  {entry.confirmed === null && (
                                    <>
                                      <button
                                        onClick={() => approveEntry(entry)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                        承認する
                                      </button>
                                      <button
                                        onClick={() => rejectEntry(entry)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center gap-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        却下する
                                      </button>
                                    </>
                                  )}

                                  {/* 承認済み・展示待ち: 展示有効化 */}
                                  {entry.confirmed === true && !entry.display_ready && (
                                    <>
                                      {paidPlan && !planPaid && (
                                        <button
                                          onClick={() => createPlanCheckoutLink(entry)}
                                          disabled={isProcessing}
                                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                        >
                                          Payment URL
                                        </button>
                                      )}
                                      <button
                                        onClick={() => enableDisplay(entry)}
                                        disabled={isProcessing}
                                        className={`inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
                                          canEnable
                                            ? 'bg-sky-600 text-white hover:bg-sky-700'
                                            : 'border-2 border-dashed border-neutral-300 text-neutral-500 hover:bg-neutral-100'
                                        }`}
                                      >
                                        <Eye className="h-4 w-4" />
                                        {canEnable ? 'Enable display' : 'Payment/processing required'}
                                      </button>
                                    </>
                                  )}

                                  {/* 却下済み: 再審査 */}
                                  {entry.confirmed === false && (
                                    <button
                                      onClick={() => resetReview(entry)}
                                      disabled={isProcessing}
                                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                      再審査に戻す
                                    </button>
                                  )}
                                </div>

                                {/* セカンダリアクション */}
                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                  {entry.confirmed !== null && entry.confirmed !== false && (
                                    <button
                                      onClick={() => resetReview(entry)}
                                      disabled={isProcessing}
                                      className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                                    >
                                      未審査に戻す
                                    </button>
                                  )}
                                  {entry.image_url && (
                                    <a
                                      href={entry.image_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      画像を開く
                                    </a>
                                  )}
                                  {entry.email && (
                                    <a
                                      href={`mailto:${entry.email}`}
                                      className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
                                    >
                                      <Mail className="h-3 w-3" />
                                      メール送信
                                    </a>
                                  )}
                                </div>

                                {/* 却下理由（却下済みの場合） */}
                                {entry.confirmed === false && entry.reject_reason && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
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

                {/* ページネーション */}
                {sortedEntries.length > 0 && (
                  <div className="flex items-center justify-between border-t bg-neutral-50 px-4 py-3">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-neutral-600">
                        {sortedEntries.length}件中 {(currentPage - 1) * pageSize + 1}-
                        {Math.min(currentPage * pageSize, sortedEntries.length)}件を表示
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-neutral-600">表示件数:</label>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                          className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}件
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* 最初へ */}
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="rounded p-1.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="最初のページ"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </button>
                      {/* 前へ */}
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded p-1.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="前のページ"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* ページ番号 */}
                      <div className="flex items-center gap-1 mx-2">
                        {(() => {
                          const pages: (number | 'ellipsis')[] = [];
                          const showPages = 5;
                          let start = Math.max(1, currentPage - Math.floor(showPages / 2));
                          const end = Math.min(totalPages, start + showPages - 1);
                          start = Math.max(1, end - showPages + 1);

                          if (start > 1) {
                            pages.push(1);
                            if (start > 2) pages.push('ellipsis');
                          }
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }
                          if (end < totalPages) {
                            if (end < totalPages - 1) pages.push('ellipsis');
                            pages.push(totalPages);
                          }

                          return pages.map((p, i) =>
                            p === 'ellipsis' ? (
                              <span key={`ellipsis-${i}`} className="px-1 text-neutral-500">
                                ...
                              </span>
                            ) : (
                              <button
                                key={p}
                                onClick={() => setCurrentPage(p)}
                                className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium transition ${
                                  currentPage === p
                                    ? 'bg-sky-600 text-white'
                                    : 'text-neutral-700 hover:bg-neutral-100'
                                }`}
                              >
                                {p}
                              </button>
                            )
                          );
                        })()}
                      </div>

                      {/* 次へ */}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded p-1.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="次のページ"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      {/* 最後へ */}
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="rounded p-1.5 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="最後のページ"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* カンバン表示 */}
        {viewMode === 'kanban' && (
          <>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* 未審査 */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-800">未審査</h3>
                    <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      {entriesByPhase.unreviewed.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {entriesByPhase.unreviewed.map((entry) => (
                      <KanbanCard
                        key={entry.id}
                        entry={entry}
                        onApprove={() => approveEntry(entry)}
                        onReject={() => rejectEntry(entry)}
                        isProcessing={processingIds.has(entry.id)}
                      />
                    ))}
                    {entriesByPhase.unreviewed.length === 0 && (
                      <div className="text-xs text-amber-600/60 text-center py-4">なし</div>
                    )}
                  </div>
                </div>

                {/* 処理待ち/処理中 */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-indigo-800">処理中</h3>
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {entriesByPhase.approved_queued.length + entriesByPhase.processing.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {[...entriesByPhase.approved_queued, ...entriesByPhase.processing].map((entry) => (
                      <KanbanCard key={entry.id} entry={entry} isProcessing={processingIds.has(entry.id)} />
                    ))}
                    {entriesByPhase.approved_queued.length + entriesByPhase.processing.length === 0 && (
                      <div className="text-xs text-indigo-600/60 text-center py-4">なし</div>
                    )}
                  </div>
                </div>

                {/* 展示可 */}
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-sky-800">展示可</h3>
                    <span className="text-xs font-medium text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
                      {entriesByPhase.ready_to_enable.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {entriesByPhase.ready_to_enable.map((entry) => (
                      <KanbanCard
                        key={entry.id}
                        entry={entry}
                        onEnable={() => enableDisplay(entry)}
                        isProcessing={processingIds.has(entry.id)}
                      />
                    ))}
                    {entriesByPhase.ready_to_enable.length === 0 && (
                      <div className="text-xs text-sky-600/60 text-center py-4">なし</div>
                    )}
                  </div>
                </div>

                {/* 展示中 */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-emerald-800">展示中</h3>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {entriesByPhase.displaying.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {entriesByPhase.displaying.map((entry) => (
                      <KanbanCard key={entry.id} entry={entry} isProcessing={processingIds.has(entry.id)} />
                    ))}
                    {entriesByPhase.displaying.length === 0 && (
                      <div className="text-xs text-emerald-600/60 text-center py-4">なし</div>
                    )}
                  </div>
                </div>

                {/* 展示終了 */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-neutral-700">終了</h3>
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {entriesByPhase.ended.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {entriesByPhase.ended.map((entry) => (
                      <KanbanCard key={entry.id} entry={entry} isProcessing={processingIds.has(entry.id)} />
                    ))}
                    {entriesByPhase.ended.length === 0 && (
                      <div className="py-4 text-center text-xs text-neutral-500">なし</div>
                    )}
                  </div>
                </div>

                {/* 却下/失敗 */}
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-red-800">却下/失敗</h3>
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      {entriesByPhase.rejected.length + entriesByPhase.processing_failed.length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {[...entriesByPhase.rejected, ...entriesByPhase.processing_failed].map((entry) => (
                      <KanbanCard
                        key={entry.id}
                        entry={entry}
                        onReset={() => resetReview(entry)}
                        isProcessing={processingIds.has(entry.id)}
                      />
                    ))}
                    {entriesByPhase.rejected.length + entriesByPhase.processing_failed.length === 0 && (
                      <div className="text-xs text-red-600/60 text-center py-4">なし</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// カンバンカードコンポーネント
function KanbanCard({
  entry,
  onApprove,
  onReject,
  onEnable,
  onReset,
  isProcessing,
}: {
  entry: Entry;
  onApprove?: () => void;
  onReject?: () => void;
  onEnable?: () => void;
  onReset?: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-2.5 hover:shadow-md transition">
      {/* サムネイル */}
      <div className="relative mb-2 aspect-square overflow-hidden rounded bg-neutral-100">
        {entry.image_url ? (
          <img
            src={entry.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
            No img
          </div>
        )}
      </div>

      {/* 情報 */}
      <div className="mb-2">
        <div className="truncate text-xs font-medium text-neutral-900" title={entry.title || undefined}>
          {entry.title || `(無題 #${entry.id})`}
        </div>
        <div className="truncate text-[10px] text-neutral-500">
          {entry.artist_name || '-'}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-1">
        {onApprove && (
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1 px-2 py-1 bg-emerald-600 text-white text-[10px] font-medium rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            承認
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1 px-2 py-1 bg-red-600 text-white text-[10px] font-medium rounded hover:bg-red-700 disabled:opacity-50"
          >
            却下
          </button>
        )}
        {onEnable && (
          <button
            onClick={onEnable}
            disabled={isProcessing}
            className="flex-1 px-2 py-1 bg-sky-600 text-white text-[10px] font-medium rounded hover:bg-sky-700 disabled:opacity-50"
          >
            有効化
          </button>
        )}
        {onReset && (
          <button
            onClick={onReset}
            disabled={isProcessing}
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
          >
            再審査
          </button>
        )}
      </div>
    </div>
  );
}

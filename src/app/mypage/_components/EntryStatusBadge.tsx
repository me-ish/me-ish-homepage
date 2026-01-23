// src/app/mypage/_components/EntryStatusBadge.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import type { EntryWithStatus } from '@/lib/portfolio/types';

type StatusInfo = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
};

/**
 * エントリのステータスを判定してバッジを表示
 * 優先順位:
 * 1. display_ready=true => 展示中
 * 2. job_status in (queued, running) => 処理中
 * 3. job_status=failed => 失敗
 * 4. confirmed=true => 承認済み
 * 5. else => 審査中
 */
export function getEntryStatus(entry: EntryWithStatus): StatusInfo {
  // 展示中
  if (entry.display_ready) {
    return {
      label: '展示中',
      variant: 'default',
      className: 'bg-emerald-500 hover:bg-emerald-500 text-white',
    };
  }

  // 処理中
  if (entry.job_status === 'queued' || entry.job_status === 'running') {
    return {
      label: '処理中',
      variant: 'secondary',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }

  // 失敗
  if (entry.job_status === 'failed') {
    return {
      label: '失敗',
      variant: 'destructive',
    };
  }

  // 承認済み（展示準備待ち）
  if (entry.confirmed) {
    return {
      label: '承認済み',
      variant: 'secondary',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    };
  }

  // 審査中
  return {
    label: '審査中',
    variant: 'outline',
    className: 'text-gray-500',
  };
}

export function EntryStatusBadge({ entry }: { entry: EntryWithStatus }) {
  const status = getEntryStatus(entry);
  return (
    <Badge variant={status.variant} className={status.className}>
      {status.label}
    </Badge>
  );
}

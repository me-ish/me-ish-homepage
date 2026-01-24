// src/app/mypage/_components/EntryStatusBadge.tsx
'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  FileCheck,
  HelpCircle,
} from 'lucide-react';
import type { EntryWithStatus } from '@/lib/portfolio/types';

export type EntryStatus =
  | 'failed'
  | 'running'
  | 'queued'
  | 'displaying'
  | 'ready'
  | 'approved'
  | 'reviewing';

export type StatusInfo = {
  status: EntryStatus;
  label: string;
  description: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon: ReactNode;
  animate?: boolean;
};

/**
 * エントリのステータスを判定
 * 優先順位:
 * 1. job_status='failed' => エラー
 * 2. job_status='running' => 処理中
 * 3. job_status='queued' => 待機中
 * 4. display_ready=true => 展示中
 * 5. job_status='succeeded' && !display_ready => 展示準備完了
 * 6. confirmed=true => 承認済み
 * 7. else => 審査中
 */
export function getEntryStatus(entry: EntryWithStatus): StatusInfo {
  if (entry.job_status === 'failed') {
    return {
      status: 'failed',
      label: 'エラー',
      description: entry.job_error
        ? `処理に失敗しました: ${entry.job_error}`
        : '処理中にエラーが発生しました。運営が確認中です。',
      variant: 'destructive',
      className: 'bg-red-500 hover:bg-red-500 text-white border-red-500',
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }

  if (entry.job_status === 'running') {
    return {
      status: 'running',
      label: '処理中',
      description: '画像処理を実行しています。しばらくお待ちください。',
      variant: 'secondary',
      className: 'bg-amber-100 text-amber-700 border-amber-300',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      animate: true,
    };
  }

  if (entry.job_status === 'queued') {
    return {
      status: 'queued',
      label: '待機中',
      description: '処理の順番を待っています。',
      variant: 'secondary',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      icon: <Clock className="h-3 w-3" />,
    };
  }

  if (entry.display_ready) {
    return {
      status: 'displaying',
      label: '公開中',
      description: 'ギャラリーで公開中です。',
      variant: 'default',
      className: 'bg-emerald-500 hover:bg-emerald-500 text-white border-emerald-500',
      icon: <Eye className="h-3 w-3" />,
    };
  }

  if (entry.job_status === 'succeeded') {
    return {
      status: 'ready',
      label: '展示準備完了',
      description: '処理が完了しました。まもなく展示が開始されます。',
      variant: 'secondary',
      className: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: <FileCheck className="h-3 w-3" />,
    };
  }

  if (entry.confirmed) {
    return {
      status: 'approved',
      label: '承認済み',
      description: '審査を通過しました。処理を待っています。',
      variant: 'secondary',
      className: 'bg-sky-100 text-sky-700 border-sky-300',
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }

  return {
    status: 'reviewing',
    label: '審査中',
    description: '作品を審査しています。しばらくお待ちください。',
    variant: 'outline',
    className: 'text-gray-500 border-gray-300',
    icon: <HelpCircle className="h-3 w-3" />,
  };
}

interface EntryStatusBadgeProps {
  entry: EntryWithStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function EntryStatusBadge({ entry, showIcon = true, size = 'sm' }: EntryStatusBadgeProps) {
  const statusInfo = getEntryStatus(entry);
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <Badge
      variant={statusInfo.variant}
      className={`${statusInfo.className} ${sizeClasses} inline-flex items-center gap-1`}
    >
      {showIcon && statusInfo.icon}
      {statusInfo.label}
    </Badge>
  );
}

export function getStatusDescription(entry: EntryWithStatus): string {
  return getEntryStatus(entry).description;
}

// src/app/admin/entries/actions.ts
'use server';

/**
 * Admin Entries Server Actions
 *
 * クライアントから直接 ADMIN_API_TOKEN を送らず、
 * サーバーサイドで安全にトークンを付与して内部APIを呼び出す。
 */

import { getSiteUrl } from '@/lib/constants';

export type ProcessingJob = {
  id: string;
  entry_id: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ApproveResult = {
  ok: boolean;
  entry: {
    id: number;
    artist_name: string;
    email: string;
    external_user_id: string;
    title: string;
    gallery_type: string | null;
    file_name: string;
    image_url: string;
    confirmed: boolean;
    confirmed_at: string;
  };
  job: ProcessingJob;
};

export async function approveEntryAction(entryId: number): Promise<ApproveResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    throw new Error('Server configuration error: missing ADMIN_API_TOKEN');
  }

  const response = await fetch(`${getSiteUrl()}/admin/api/entries/${entryId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-meish-admin-token': token,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'unknown' }));
    throw new Error(errorData.error || `approve_failed (${response.status})`);
  }

  return response.json();
}

export type RejectResult = {
  ok: boolean;
  entry: {
    id: number;
    confirmed: boolean;
    rejected_at: string;
    reject_reason: string | null;
  };
};

export async function rejectEntryAction(entryId: number, reason: string | null): Promise<RejectResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    throw new Error('Server configuration error: missing ADMIN_API_TOKEN');
  }

  const response = await fetch(`${getSiteUrl()}/admin/api/entries/${entryId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-meish-admin-token': token,
    },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'unknown' }));
    throw new Error(errorData.error || 'reject_failed');
  }

  return response.json();
}

export type ResetResult = {
  ok: boolean;
  entry: {
    id: number;
    confirmed: boolean | null;
  };
};

export async function resetEntryAction(entryId: number): Promise<ResetResult> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    throw new Error('Server configuration error: missing ADMIN_API_TOKEN');
  }

  const response = await fetch(`${getSiteUrl()}/admin/api/entries/${entryId}/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-meish-admin-token': token,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'unknown' }));
    throw new Error(errorData.error || 'reset_failed');
  }

  return response.json();
}

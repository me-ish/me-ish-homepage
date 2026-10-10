'use server';

// Old action IDs remain inert for already-open browser tabs.

import { LEGACY_SERVICE_PAUSED_MESSAGE } from '@/lib/legacyServiceSuspension';

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

export async function approveEntryAction(_entryId: number): Promise<ApproveResult> {
  throw new Error(LEGACY_SERVICE_PAUSED_MESSAGE);
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

export async function rejectEntryAction(_entryId: number, _reason: string | null): Promise<RejectResult> {
  throw new Error(LEGACY_SERVICE_PAUSED_MESSAGE);
}

export type ResetResult = {
  ok: boolean;
  entry: {
    id: number;
    confirmed: boolean | null;
  };
};

export async function resetEntryAction(_entryId: number): Promise<ResetResult> {
  throw new Error(LEGACY_SERVICE_PAUSED_MESSAGE);
}

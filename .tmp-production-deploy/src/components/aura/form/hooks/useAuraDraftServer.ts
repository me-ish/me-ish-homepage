// src/components/aura/form/hooks/useAuraDraftServer.ts
// Server-side draft creation and email sync, extracted from AuraFormWizard.

import { useState, useCallback, useEffect, useRef } from "react";

/* =========================================================
 * Types
 * ========================================================= */
export type DraftState = {
  requestId: string | null;
  status: "idle" | "creating" | "ready" | "error";
  error?: string | null;
};

export type EmailSyncState = {
  status: "idle" | "syncing" | "synced" | "error";
  error?: string | null;
};

/* =========================================================
 * Hook
 * ========================================================= */
export function useAuraDraftServer(
  email: string,
  name: string,
  setError: (msg: string | null) => void,
) {
  const [draft, setDraft] = useState<DraftState>({
    requestId: null,
    status: "idle",
    error: null,
  });

  const [emailSync, setEmailSync] = useState<EmailSyncState>({
    status: "idle",
    error: null,
  });

  const emailSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------- createDraftIfNeeded ---------- */
  const createDraftIfNeeded = useCallback(async (emailArg: string, nameArg: string) => {
    if (!emailArg) {
      setError("先にメールアドレスを入力してください（画像アップロードに必要です）。");
      throw new Error("email_required_for_draft");
    }

    if (draft.requestId) return draft.requestId;

    setDraft((p) => ({ ...p, status: "creating", error: null }));
    try {
      const res = await fetch("/api/aura/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({ email: emailArg, name: nameArg }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok || !json?.requestId) {
        const message = json?.error ? String(json.error) : "draft_create_failed";
        setDraft({ requestId: null, status: "error", error: message });
        setError("下書き作成に失敗しました。時間をおいて再度お試しください。");
        throw new Error(message);
      }

      setDraft({
        requestId: String(json.requestId),
        status: "ready",
        error: null,
      });
      return String(json.requestId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setDraft({ requestId: null, status: "error", error: message });
      throw e;
    }
  }, [draft.requestId, setError]);

  /* ---------- Auto-create draft when email is valid ---------- */
  useEffect(() => {
    if (draft.requestId || draft.status === "creating") return;
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    createDraftIfNeeded(trimmed, name).catch(() => {});
  }, [email, name, draft.requestId, draft.status, createDraftIfNeeded]);

  /* ---------- syncEmailToDb ---------- */
  const syncEmailToDb = useCallback(async (emailArg: string) => {
    if (!draft.requestId) return;
    const normalized = emailArg.trim().toLowerCase();
    if (!normalized) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return;

    setEmailSync({ status: "syncing", error: null });

    try {
      const res = await fetch(`/api/aura/request/${draft.requestId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "me-ish" },
        body: JSON.stringify({ email: normalized }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const errMsg = json?.message ?? json?.error ?? "メール更新に失敗しました";
        console.error("[email-sync] error:", errMsg);
        setEmailSync({ status: "error", error: errMsg });
        return;
      }

      setEmailSync({ status: "synced", error: null });
    } catch (e) {
      console.error("[email-sync] network error:", e);
      setEmailSync({ status: "error", error: "通信エラーが発生しました" });
    }
  }, [draft.requestId]);

  /* ---------- Debounced email sync ---------- */
  useEffect(() => {
    if (!draft.requestId) return;

    if (emailSyncTimeoutRef.current) {
      clearTimeout(emailSyncTimeoutRef.current);
    }

    emailSyncTimeoutRef.current = setTimeout(() => {
      syncEmailToDb(email);
    }, 400);

    return () => {
      if (emailSyncTimeoutRef.current) {
        clearTimeout(emailSyncTimeoutRef.current);
      }
    };
  }, [email, draft.requestId, syncEmailToDb]);

  return { draft, emailSync, createDraftIfNeeded };
}

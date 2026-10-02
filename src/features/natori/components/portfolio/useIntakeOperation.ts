"use client";
import { useEffect, useRef, useState } from "react";
import { clearFrozenIntakeOperation, frozenIntakeFromForm, loadFrozenIntakeOperation, recoverFrozenIntakeOperation, saveFrozenIntakeOperation, sendFrozenIntakeOperation, checkFrozenIntakeOperation, type FrozenIntakeOperation, type IntakeClientResult } from "../../data/intakeOperationClient";

const STORAGE_KEY = "natori-intake-operation-v1";
export type IntakeCompleted = { receipt: string; clientEmail: string };
export function useIntakeOperation(onCompleted: (result: IntakeCompleted) => void, enabled = true, onRestore?: (fields: FrozenIntakeOperation["fields"]) => void) {
  const [operation, setOperation] = useState<FrozenIntakeOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(!enabled);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const lifecycleRef = useRef({ active: enabled });
  const busyRef = useRef(false), operationRef = useRef<FrozenIntakeOperation | null>(null);
  const filesRef = useRef<File[]>([]), completedRef = useRef(onCompleted);
  completedRef.current = onCompleted;
  const restoreRef = useRef(onRestore); restoreRef.current = onRestore;

  const acceptResult = (result: IntakeClientResult, current: FrozenIntakeOperation) => {
    // A delayed observation for a settled operation must not clear or complete
    // a newer frozen submission, including the automatic recovery on mount.
    if (!lifecycleRef.current.active || operationRef.current?.operationId !== current.operationId ||
        operationRef.current.requestHash !== current.requestHash) return;
    // Another mounted form may already own this session's recovery record.
    try {
      const saved = loadFrozenIntakeOperation(STORAGE_KEY);
      if (saved && (saved.operationId !== current.operationId || saved.requestHash !== current.requestHash)) return;
    } catch { setRecoveryBlocked(true); return; }
    if (result.kind === "completed") {
      // Keep the minimal recovery record in this session so reload recovers the committed receipt.
      completedRef.current({ receipt: result.receipt, clientEmail: typeof current.fields.email === "string" ? current.fields.email : "" });
      return;
    }
    if (result.kind === "failed") {
      clearFrozenIntakeOperation(STORAGE_KEY); operationRef.current = null; setOperation(null);
      setMessage("受付が保存されていないことを確認できました。入力内容を修正して送信できます。");
      return;
    }
    setMessage(result.kind === "needs_review" || result.kind === "conflict"
      ? "送信内容の確認が必要です。新しく応募せず、公開連絡先へお問い合わせください。"
      : result.retryAfter ? `同じ送信の結果を確認中です。約${Math.ceil(result.retryAfter / 60)}分後に確認してください。`
        : "同じ送信の結果を確認中です。新しく応募せず、下のボタンで受付結果をご確認ください。");
  };

  useEffect(() => {
    const lifecycle = { active: enabled };
    lifecycleRef.current = lifecycle;
    busyRef.current = false; setBusy(false);
    if (!enabled) return;
    let active = true;
    try {
      const saved = loadFrozenIntakeOperation(STORAGE_KEY);
      if (saved) {
        operationRef.current = saved; setOperation(saved);
        // A rollout can display a different form version; recovery must still remain available.
        try { restoreRef.current?.(saved.fields); } catch { /* Frozen receipt recovery remains authoritative. */ }
        setMessage("前回の送信結果を確認中です。新しく応募する必要はありません。");
        void recoverFrozenIntakeOperation(saved).then(result => { if (active) acceptResult(result, saved); });
      }
    } catch { setRecoveryBlocked(true); setMessage("前回の送信情報を読み取れませんでした。新しく応募せず、公開連絡先へ保存状況をご確認ください。"); }
    setHydrated(true);
    return () => { active = false; lifecycle.active = false; };
    // Recovery runs once per mounted form; callback identity is kept in completedRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const run = async (job: (isCurrent: () => boolean) => Promise<void>) => {
    const lifecycle = lifecycleRef.current;
    const isCurrent = () => lifecycle.active && lifecycleRef.current === lifecycle;
    if (!isCurrent() || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await job(isCurrent); }
    catch (error) {
      if (!isCurrent()) return;
      setMessage(error instanceof Error && error.message === "attachment_reselect_required"
        ? "前回と同じ画像を、同じ順番で選択してください。異なる画像では再試行しません。"
        : operationRef.current ? "送信結果を確認できませんでした。同じ送信として確認・再試行できます。"
          : "送信情報をこのブラウザに保存できませんでした。設定をご確認ください。受付はまだ送信していません。");
    } finally { if (isCurrent()) { busyRef.current = false; setBusy(false); } }
  };
  const submit = async (form: FormData, files: File[]) => {
    if (!enabled || !hydrated || recoveryBlocked || operationRef.current) return;
    await run(async isCurrent => {
      const frozen = await frozenIntakeFromForm(form, files);
      if (!isCurrent()) return;
      // Hashing can outlive a screen or overlap another mounted form's send.
      const saved = loadFrozenIntakeOperation(STORAGE_KEY);
      if (saved) {
        operationRef.current = saved; setOperation(saved);
        try { restoreRef.current?.(saved.fields); } catch { /* Receipt recovery remains authoritative. */ }
        setMessage("前回の送信情報を保持しています。新しく送信せず、受付結果をご確認ください。");
        return;
      }
      saveFrozenIntakeOperation(STORAGE_KEY, frozen);
      operationRef.current = frozen; setOperation(frozen); filesRef.current = files;
      const result = await sendFrozenIntakeOperation(frozen, files);
      if (!isCurrent()) return;
      // Rejection still needs a fenced determination before raw fields may be edited.
      const reconciled = result.kind === "not_found" ? await recoverFrozenIntakeOperation(frozen) : result;
      if (isCurrent()) acceptResult(reconciled, frozen);
    });
  };
  const check = () => run(async isCurrent => {
    const current = operationRef.current; if (!current) return;
    const result = await recoverFrozenIntakeOperation(current);
    if (isCurrent()) acceptResult(result, current);
  });
  const retry = () => run(async isCurrent => {
    const current = operationRef.current; if (!current) return;
    const result = await recoverFrozenIntakeOperation(current);
    if (!isCurrent()) return;
    if (result.kind === "completed" || result.kind === "failed" || result.kind === "conflict" || result.kind === "needs_review") { acceptResult(result, current); return; }
    const resent = await sendFrozenIntakeOperation(current, filesRef.current);
    if (isCurrent()) acceptResult(resent, current);
  });
  const settle = () => run(async isCurrent => {
    const current = operationRef.current; if (!current) return;
    const result = await checkFrozenIntakeOperation(current, "settle");
    if (isCurrent()) acceptResult(result, current);
  });
  const selectFiles = (files: File[]) => { filesRef.current = files; setSelectedNames(files.map(file => file.name)); };
  return { operation, busy, frozen: !!operation || !hydrated || recoveryBlocked, message, selectedNames, submit, check, retry, settle, selectFiles };
}

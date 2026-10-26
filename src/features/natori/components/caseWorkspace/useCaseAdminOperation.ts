"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  caseAdminRequest,
  type CaseAdminRequest,
} from "../../lib/caseAdministration";
import {
  loadCaseAdministration,
  submitCaseAdministration,
} from "../../data/supabaseCaseAdministration";
const savedSchema = z.object({
  request: caseAdminRequest,
  summary: z.array(z.string().max(20000)).max(20),
  started: z.boolean(),
});
type Saved = z.infer<typeof savedSchema>;
const savedResults = new Set(["applied", "queued"]);
const refusalMessages = new Map<string, string>([
  ["duplicate","同じ参考リンクが登録済みです。最新版の一覧を確認してください。"],
  ["link_limit","参考リンクは既存の上限5件までです。最新版を確認してください。"],
  [
    "stale",
    "確認後に案件が更新されました。実行していません。最新版を取得して確認し直してください。",
  ],
  [
    "confirmation_stale",
    "通知内容が確認後に変わりました。実行していません。最新版で確認し直してください。",
  ],
  [
    "agreement_locked",
    "承諾・入金の記録があるため、金額を変更できません。取引の記録を確認してください。",
  ],
  [
    "payment_review",
    "入金は記録していません。種別・管理額・承諾額と、未解決の入金や請求リンクを確認してください。",
  ],
  [
    "notice_review",
    "この通知は復旧できません。最新の試行・対象版・期限・処理結果を確認してください。",
  ],
  [
    "review_required",
    "未解決の処理があります。見送り・保管の前に取引内の照合で確認してください。",
  ],
  [
    "unresolved",
    "未停止の請求リンク等があるため保管できません。取引の記録と停止結果を確認してください。",
  ],
  [
    "invalid_state",
    "現在の案件状態では実行できません。最新の記録と必要な操作を確認してください。",
  ],
  [
    "inactive",
    "保管中の案件では実行できません。復元の必要性を先に確認してください。",
  ],
  [
    "not_found",
    "対象の案件・通知を確認できません。表示とログイン状態を確認してください。",
  ],
  [
    "invalid",
    "入力した内容を保存していません。対象と内容を確認し直してください。",
  ],
]);
export function useCaseAdminOperation(
  key: string,
  onChanged: () => void,
  onDirty: (v: boolean) => void,
) {
  // Server and first client render agree. Restore tab state after hydration,
  // and refuse new commands until the persisted operation has been inspected.
  const [saved, setSaved] = useState<Saved | null>(null);
  const [blocked, setBlocked] = useState(false),
    [ready, setReady] = useState(false);
  const [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [projectId, setProjectId] = useState<string | null>(null);
  const lock = useRef(false),
    alive = useRef(true),
    generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    invalidate();
    lock.current = false;
    setBusy(false);
    setDone(false);
    setProjectId(null);
    setMessage("");
    setReady(false);
    try {
      const raw = sessionStorage.getItem(key);
      setSaved(raw ? savedSchema.parse(JSON.parse(raw)) : null);
      setBlocked(false);
    } catch {
      setSaved(null);
      setBlocked(true);
    }
    setReady(true);
    return invalidate;
  }, [key, invalidate]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onDirty(!!saved || blocked);
    return () => onDirty(false);
  }, [saved, blocked, onDirty]);
  const store = (next: Saved | null) => {
    if (next) sessionStorage.setItem(key, JSON.stringify(next));
    else sessionStorage.removeItem(key);
    setSaved(next);
  };
  const prepare = (request: CaseAdminRequest, summary: string[]) => {
    if (!ready || saved || blocked || lock.current) return;
    try {
      store({
        request: caseAdminRequest.parse(request),
        summary,
        started: false,
      });
      setDone(false);
      setMessage("");
    } catch {
      setBlocked(true);
      setMessage("確認内容を保存できません。実行していません。");
    }
  };
  const lookup = async () => {
    if (!ready || !saved || lock.current) return;
    const current = generation.current;
    lock.current = true;
    setBusy(true);
    try {
      const next = await loadCaseAdministration(
        saved.request.projectId,
        saved.request.operationId,
      );
      if (!alive.current || current !== generation.current) return;
      if (next.receipt) {
        if (!savedResults.has(next.receipt.result)) {
          try {
            store({ ...saved, started: true });
          } catch {
            setBlocked(true);
          }
          setDone(false);
          setMessage(
            "保存記録の結果を判定できません。新しい操作を作らず、同じ操作の確認を続けてください。",
          );
          return;
        }
        setDone(true);
        setProjectId(next.receipt.projectId);
        setMessage(
          next.receipt.result === "queued"
            ? "通知の復旧要求は保存済みです。送信結果は案件の通知記録で確認してください。"
            : "同じ操作の保存済み結果を確認しました。",
        );
        onChanged();
      } else
        setMessage(
          "この照会では保存結果を確認できません。未実行とは断定していません。新しい操作を作らず同じ操作を確認してください。",
        );
    } catch (e) {
      if (alive.current && current === generation.current)
        setMessage(e instanceof Error ? e.message : "結果未確認");
    } finally {
      if (current === generation.current) {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    }
  };
  const execute = async () => {
    if (!ready || !saved || done || lock.current) return;
    const current = generation.current;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      // Persist the frozen operation BEFORE the first request. A reload only offers lookup/same-ID recovery.
      store({ ...saved, started: true });
      const result = await submitCaseAdministration(saved.request);
      if (!alive.current || current !== generation.current) return;
      if (result.result === "conflict") {
        setMessage(
          "同じ操作IDに保存済みの別結果がある可能性があります。結果を照会して確認してください。",
        );
        onChanged();
        return;
      }
      const refused = refusalMessages.get(result.result);
      if (!savedResults.has(result.result) && !refused) {
        setMessage(
          "保存結果を判定できません。新しい操作を作らず、同じ操作の結果を照会してください。",
        );
        onChanged();
        return;
      }
      setDone(true);
      setProjectId(result.projectId ?? null);
      setMessage(
        result.result === "queued"
          ? "通知の復旧要求を保存しました。受付・到達は最新の通知記録で別に確認してください。"
          : result.result === "applied"
            ? "記録を保存しました。"
            : refused!,
      );
      onChanged();
    } catch (e) {
      if (alive.current && current === generation.current) {
        setMessage(e instanceof Error ? e.message : "結果未確認");
        onChanged();
      }
    } finally {
      if (current === generation.current) {
        lock.current = false;
        if (alive.current) setBusy(false);
      }
    }
  };
  const close = () => {
    if (!ready || blocked || busy || (saved?.started && !done)) return;
    try {
      store(null);
      setDone(false);
      setMessage("");
      onChanged();
    } catch {
      setBlocked(true);
    }
  };
  return {
    ready,
    saved,
    blocked,
    message,
    done,
    busy,
    projectId,
    prepare,
    lookup,
    execute,
    close,
  };
}

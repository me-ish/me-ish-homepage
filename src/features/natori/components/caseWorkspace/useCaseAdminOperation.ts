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
  ["duplicate","同じ参考リンクがもうあります。"],
  ["link_limit","参考リンクは5件までです。"],
  [
    "stale",
    "ほかの画面で案件が変わったので、保存していません。ページを読み込み直してください。",
  ],
  [
    "confirmation_stale",
    "メールの内容が変わったので、送っていません。ページを読み込み直してください。",
  ],
  [
    "agreement_locked",
    "お客さんのOKか入金があるので、金額は変えられません。",
  ],
  [
    "payment_review",
    "入金を記録できませんでした。金額と、使える支払いリンクが残っていないかを見てください。",
  ],
  [
    "notice_review",
    "このメールは送り直せません。新しいメールがあるか、期限が切れています。",
  ],
  [
    "review_required",
    "終わっていない処理があります。先に「見積・支払い」で結果を調べてください。",
  ],
  [
    "unresolved",
    "使える支払いリンクが残っているので、しまえません。",
  ],
  [
    "invalid_state",
    "いまの段階ではできません。",
  ],
  [
    "inactive",
    "しまってある案件なのでできません。先に戻してください。",
  ],
  [
    "not_found",
    "案件が見つかりません。ログインが切れていないか見てください。",
  ],
  [
    "invalid",
    "保存できませんでした。入力を見直してください。",
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
      setMessage("保存できませんでした。");
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
            "うまくいったか分かりません。「結果を見る」を押してください。",
          );
          return;
        }
        setDone(true);
        setProjectId(next.receipt.projectId);
        setMessage(
          next.receipt.result === "queued"
            ? "送り直しを受け付けました。結果は「履歴」で見られます。"
            : "保存できていました。",
        );
        onChanged();
      } else
        setMessage(
          "まだ結果が分かりません。少し待ってから、もう一度「結果を見る」を押してください。",
        );
    } catch (e) {
      if (alive.current && current === generation.current)
        setMessage(e instanceof Error ? e.message : "うまくいったか分かりません。");
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
          "前の保存と食い違っているかもしれません。「結果を見る」を押してください。",
        );
        onChanged();
        return;
      }
      const refused = refusalMessages.get(result.result);
      if (!savedResults.has(result.result) && !refused) {
        setMessage(
          "うまくいったか分かりません。「結果を見る」を押してください。",
        );
        onChanged();
        return;
      }
      setDone(true);
      setProjectId(result.projectId ?? null);
      setMessage(
        result.result === "queued"
          ? "送り直しを受け付けました。結果は「履歴」で見られます。"
          : result.result === "applied"
            ? "保存しました。"
            : refused!,
      );
      onChanged();
    } catch (e) {
      if (alive.current && current === generation.current) {
        setMessage(e instanceof Error ? e.message : "うまくいったか分かりません。");
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

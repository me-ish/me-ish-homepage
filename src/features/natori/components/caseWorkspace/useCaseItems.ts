"use client";
// 案件の品目を1か所で持つ。相談タブの品目カードと制作タブの進みが同じ値を見るため。
import { useCallback, useEffect, useState } from "react";
import { loadCaseItems, type CaseItemsWrite } from "../../data/supabaseCaseItems";
import type { NatoriCaseItem } from "../../types/caseItems";

export type CaseItemsStore = {
  /** null は読み込み中。 */
  items: NatoriCaseItem[] | null;
  /** 表がまだ無い・読めないとき。画面は品目なしとして動く。 */
  unavailable: boolean;
  busy: boolean;
  message: string;
  clearMessage: () => void;
  reload: () => Promise<void>;
  /** 書き込みを1つ実行する。うまくいけば true。 */
  run: (action: () => Promise<CaseItemsWrite>) => Promise<boolean>;
};

export function useCaseItems(projectId: string): CaseItemsStore {
  const [items, setItems] = useState<NatoriCaseItem[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const result = await loadCaseItems(projectId);
    if (result.kind === "ok") { setItems(result.items); setUnavailable(false); } else { setItems([]); setUnavailable(true); }
  }, [projectId]);
  useEffect(() => { setItems(null); void reload(); }, [reload]);

  const run = useCallback(async (action: () => Promise<CaseItemsWrite>) => {
    setBusy(true); setMessage("");
    const result = await action();
    setBusy(false);
    if (result.kind === "ok") { setItems(result.items); return true; }
    setMessage(result.message);
    return false;
  }, []);
  const clearMessage = useCallback(() => setMessage(""), []);

  return { items, unavailable, busy, message, clearMessage, reload, run };
}

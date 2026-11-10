"use client";
// 依頼フォームの下書きをこの端末（localStorage）に置く hook。localStorage に触るのはここだけ。
// 使えない環境（プライベートモードなど）では何もしない。
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PORTFOLIO_DRAFT_STORAGE_KEY,
  isBlankPortfolioDraftState,
  parsePortfolioDraft,
  serializePortfolioDraft,
  type PortfolioDraft,
} from "@/features/natori/lib/portfolioDraft";
import type { PortfolioRequestFormState } from "@/features/natori/lib/portfolioRequestForm";

const SAVE_DELAY_MS = 500;

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(PORTFOLIO_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function removeStorage() {
  try {
    window.localStorage.removeItem(PORTFOLIO_DRAFT_STORAGE_KEY);
  } catch {
    /* 保存できない環境では何もしない */
  }
}

function writeStorage(value: string) {
  try {
    window.localStorage.setItem(PORTFOLIO_DRAFT_STORAGE_KEY, value);
  } catch {
    /* 容量不足・プライベートモードなど。下書きは任意の機能なので黙って諦める */
  }
}

export type RestoredIntakeDraft = { hadImages: boolean };

export function useIntakeDraft({
  enabled,
  state,
  step,
  hadImages,
  canRestore,
  onRestore,
}: {
  enabled: boolean;
  state: PortfolioRequestFormState;
  step: number;
  hadImages: boolean;
  /** 読み込み時に呼ぶ。false なら下書きを読まない（送信の復元や、料金表から来たときなど）。 */
  canRestore: () => boolean;
  onRestore: (draft: PortfolioDraft) => void;
}) {
  const [restored, setRestored] = useState<RestoredIntakeDraft | null>(null);
  const loadedRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const canRestoreRef = useRef(canRestore);
  canRestoreRef.current = canRestore;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const cancelPendingSave = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  // 読み込みはマウント時に1回だけ。
  useEffect(() => {
    if (!enabled) return;
    const raw = readStorage();
    const draft = parsePortfolioDraft(raw, Date.now());
    if (raw !== null && !draft) removeStorage();
    if (draft && canRestoreRef.current()) {
      onRestoreRef.current(draft);
      setRestored({ hadImages: draft.hadImages });
    }
    loadedRef.current = true;
  }, [enabled]);

  // 入力が止まって 500ms たったら保存する。何も書いていなければ消す。
  useEffect(() => {
    if (!enabled || !loadedRef.current || stoppedRef.current) return;
    cancelPendingSave();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (stoppedRef.current) return;
      if (isBlankPortfolioDraftState(state)) removeStorage();
      else writeStorage(serializePortfolioDraft({ state, step, savedAt: Date.now(), hadImages }));
    }, SAVE_DELAY_MS);
  }, [enabled, state, step, hadImages]);

  useEffect(() => () => cancelPendingSave(), []);

  /** 下書きを消す。stop=true なら、この画面ではもう保存しない（送信が済んだとき）。 */
  const clear = useCallback((stop = false) => {
    cancelPendingSave();
    if (stop) stoppedRef.current = true;
    setRestored(null);
    if (enabled) removeStorage();
  }, [enabled]);

  return { restored, clear };
}

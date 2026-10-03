"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export const NATORI_TOAST_DURATION_MS = 4000;

type NatoriToastContextValue = { showToast: (message: string) => void };

const NatoriToastContext = createContext<NatoriToastContextValue | null>(null);

/** Mount once per page. The live region stays in the DOM so screen readers announce changes. */
export function NatoriToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      // 同じ文言が続いても別の通知として扱う（key が変わり、ライブ領域に再挿入される）
      nextId.current += 1;
      setToast({ id: nextId.current, message: next });
      timer.current = setTimeout(dismiss, NATORI_TOAST_DURATION_MS);
    },
    [dismiss],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <NatoriToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6"
      >
        {toast ? (
          <div key={toast.id} className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
            <p className="leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="通知を閉じる"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </NatoriToastContext.Provider>
  );
}

export function useNatoriToast(): NatoriToastContextValue {
  const context = useContext(NatoriToastContext);
  if (!context) throw new Error("useNatoriToast must be used inside NatoriToastProvider");
  return context;
}

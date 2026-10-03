"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

export const NATORI_TOAST_DURATION_MS = 4000;

type NatoriToastContextValue = { showToast: (message: string) => void };

const NatoriToastContext = createContext<NatoriToastContextValue | null>(null);

/** Mount once per page. The live region stays in the DOM so screen readers announce changes. */
export function NatoriToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMessage(null);
  }, []);

  const showToast = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
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
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
      >
        {message ? (
          <div className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
            <p className="leading-6">{message}</p>
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

const noopToast: NatoriToastContextValue = { showToast: () => undefined };

/**
 * Boards shared with the Etorie demo (which has no provider) use this: without a
 * provider it silently does nothing instead of throwing.
 */
export function useOptionalNatoriToast(): NatoriToastContextValue {
  return useContext(NatoriToastContext) ?? noopToast;
}

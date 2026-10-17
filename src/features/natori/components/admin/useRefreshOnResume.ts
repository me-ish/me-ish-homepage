"use client";

import { useEffect, useRef } from "react";

/** Refresh when returning to a management page, coalescing mobile resume events. */
export function useRefreshOnResume(
  refresh: () => Promise<void>,
  onError: (error: unknown) => void,
  enabled = true,
) {
  const callbacks = useRef({ refresh, onError });
  callbacks.current = { refresh, onError };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = false;
    let lastAttempt = Date.now();
    const resume = () => {
      if (!active || pending || document.visibilityState !== "visible" || Date.now() - lastAttempt < 1000) return;
      pending = true;
      lastAttempt = Date.now();
      void Promise.resolve().then(() => { if (active) return callbacks.current.refresh(); })
        .catch(error => { if (active) callbacks.current.onError(error); })
        .finally(() => { pending = false; });
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enabled]);
}

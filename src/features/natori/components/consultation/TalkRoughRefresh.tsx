"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Same cadence as the thread's own poll. */
const POLL_MS = 15000;

/**
 * Keeps the server-rendered rough cards current: while the page is open it watches the thread's light
 * probe and, when staff mark or un-mark a rough (or an OK is recorded), asks Next.js to re-render the page.
 * Renders nothing; failures stay silent and the next tick retries.
 */
export default function TalkRoughRefresh({ token }: { token: string }) {
  const router = useRouter();
  useEffect(() => {
    let seen: string | null = null;
    let busy = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/natori/consult/${encodeURIComponent(token)}?probe=1`, { cache: "no-store" });
        if (!response.ok) return;
        const probe = await response.json() as { roughs?: unknown };
        if (typeof probe.roughs !== "string") return;
        if (seen !== null && probe.roughs !== seen) router.refresh();
        seen = probe.roughs;
      } catch { /* Silent: the next tick retries. */ } finally { busy = false; }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [token, router]);
  return null;
}

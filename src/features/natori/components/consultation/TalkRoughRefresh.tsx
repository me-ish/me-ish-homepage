"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Same cadence as the thread's own poll. */
const POLL_MS = 15000;

/**
 * Keeps the server-rendered status cards current: while the page is open it watches the thread's light
 * probe and, when staff mark or un-mark a rough (or an OK is recorded), or the quote / payment / delivery
 * state changes, asks Next.js to re-render the page. It also checks right away when the tab becomes visible
 * again. Renders nothing; failures stay silent and the next tick retries.
 */
export default function TalkRoughRefresh({ token, initialTalk }: { token: string; initialTalk: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let seen: string | null = null;
    // The fingerprint the page was rendered from; null means it was unknown, so the first readable one refreshes.
    let seenTalk: string | null = initialTalk;
    let busy = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/natori/consult/${encodeURIComponent(token)}?probe=1`, { cache: "no-store" });
        if (!response.ok) return;
        const probe = await response.json() as { roughs?: unknown; talk?: unknown };
        if (typeof probe.roughs !== "string") return;
        // `talk` is absent when the server could not read it; that is "no news", not a change.
        const talk = typeof probe.talk === "string" ? probe.talk : null;
        const changed = (seen !== null && probe.roughs !== seen) || (talk !== null && talk !== seenTalk);
        if (changed) router.refresh();
        seen = probe.roughs;
        if (talk !== null) seenTalk = talk;
      } catch { /* Silent: the next tick retries. */ } finally { busy = false; }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [token, router, initialTalk]);
  return null;
}

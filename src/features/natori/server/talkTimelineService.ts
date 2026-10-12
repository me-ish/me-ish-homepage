import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTalkTimeline } from "../lib/talkTimeline";
import type { TalkFacts, TalkQuoteFact, TalkTimeline } from "../types/talk";
import { getClientProject } from "./consultationService";
import { getQuotePaymentOverview } from "./paymentReadModelService";
import { listProjectRoughs } from "./talkRoughStore";
import type { NatoriPaymentLinkFact, NatoriPaymentOverview } from "../types/payment";

type AttemptRow = { state: string; link_url: string | null; deadline: string };
type AttemptReader = { from(table: "natori_payment_link_attempts"): { select(columns: string): { eq(column: string, value: string): {
  order(column: string, options: { ascending: boolean }): { limit(count: number): { maybeSingle(): PromiseLike<{ data: AttemptRow | null; error: unknown }> } } } } } };

/**
 * Read-only status cards for the client consultation page. Everything is derived
 * from the existing quote / payment / delivery rows; nothing is written and no
 * access link is created. A failed payment read removes its action and keeps the other cards.
 */
export async function getClientTalkTimeline(token: string): Promise<TalkTimeline | null> {
  try {
    const project = await getClientProject(token);
    if (!project || project.deleted_at) return null;
    const db = supabaseAdmin();
    const [projectRow, quoteRows, releaseRow, attemptRow, roughRows] = await Promise.all([
      db.from("natori_projects")
        .select("status, deleted_at, payment_confirmed_at, payment_link_url, payment_link_status, delivery_token_expires_at, delivery_accepted_at")
        .eq("id", project.id).maybeSingle(),
      db.from("natori_quotes")
        .select("id, version, amount, created_at, issued_at, expires_at, accepted_at, superseded_at")
        .eq("project_id", project.id).order("version", { ascending: true }),
      db.from("natori_delivery_releases").select("expires_at, accepted_at, manifest").eq("project_id", project.id).maybeSingle(),
      // The generation table is not in the generated Supabase types yet; this read is typed by hand.
      // Isolate sync/async failures: payment reads must not remove quote/rough/delivery cards.
      Promise.resolve().then(() => (db as unknown as AttemptReader).from("natori_payment_link_attempts").select("state, link_url, deadline")
        .eq("project_id", project.id).order("generation", { ascending: false }).limit(1).maybeSingle())
        .then(result => result && typeof result === "object" && !Array.isArray(result) && "data" in result && "error" in result
          ? result : { data: null, error: "attempt_read_malformed" })
        .catch(() => ({ data: null, error: "attempt_read_failed" })),
      listProjectRoughs(project.id),
    ]);
    if (projectRow.error || !projectRow.data) return null;
    const p = projectRow.data;
    if (p.deleted_at) return null;

    const quotes: TalkQuoteFact[] = quoteRows.error ? [] : (quoteRows.data ?? []).map(row => ({
      id: row.id, version: row.version, amount: row.amount, issuedAt: row.issued_at ?? row.created_at,
      expiresAt: row.expires_at, acceptedAt: row.accepted_at, supersededAt: row.superseded_at,
    }));

    // Legacy columns only count after a successful no-generation read. The authoritative
    // payment overview can veto either source; a failed read is never legacy absence.
    const legacyLive = p.payment_link_status === "ready" || p.payment_link_status === "sent";
    const attempt = attemptRow.data;
    const validAttempt = attempt !== null && typeof attempt === "object" && !Array.isArray(attempt)
      && typeof attempt.state === "string" && (attempt.link_url === null || typeof attempt.link_url === "string")
      && typeof attempt.deadline === "string";
    const link: NatoriPaymentLinkFact = attemptRow.error !== null || (attempt !== null && !validAttempt)
      ? { kind: "unavailable" }
      : attempt && validAttempt ? { kind: "generation", state: attempt.state, url: attempt.link_url, deadline: attempt.deadline }
      : legacyLive ? { kind: "legacy", url: p.payment_link_url, deadline: null } : { kind: "absent" };

    let overview: NatoriPaymentOverview | undefined;
    try { overview = await getQuotePaymentOverview(project.id); }
    catch { overview = { available: false, confirmedAt: null, requiresReview: false, processing: false }; }

    const release = releaseRow.error ? null : releaseRow.data;
    const manifest = release && Array.isArray(release.manifest) ? release.manifest.length : null;
    const legacyDelivery = !release && Boolean(p.delivery_token_expires_at);
    const facts: TalkFacts = {
      linksAllowed: project.status !== "closed" && p.status !== "closed" && overview?.linkState !== "terminal",
      quotes,
      roughs: (roughRows ?? []).map(row => ({ id: row.id, messageId: row.message_id, beforeQuote: row.before_quote, createdAt: row.created_at, okAt: row.client_ok_at })),
      payment: { confirmedAt: p.payment_confirmed_at, link, overview },
      delivery: {
        exists: Boolean(release) || legacyDelivery,
        expiresAt: release?.expires_at ?? p.delivery_token_expires_at,
        acceptedAt: p.delivery_accepted_at ?? release?.accepted_at ?? null,
        fileCount: manifest,
        openable: Boolean(release),
      },
    };
    const timeline = buildTalkTimeline(facts, new Date());
    return timeline.cards.length ? timeline : null;
  } catch (error) {
    console.error("[natori-talk] timeline unavailable", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TalkOpenTarget } from "../types/talk";
import { getClientProject } from "./consultationService";
import { effectiveDeliveryExpiry, readLatestDeliveryExtension } from "./deliveryExpiry";

export type OpenTalkLinkResult =
  | { kind: "ok"; path: string }
  | { kind: "not-found" }
  | { kind: "unavailable" }
  | { kind: "throttled" }
  | { kind: "db-error" };

/** A card may mint at most this many fresh links per quote / release per hour. */
export const OPEN_LINKS_PER_HOUR = 10;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * Opens the quote or delivery page from a card on the consultation page.
 * Emailed links are stored only as hashes and cannot be rebuilt, so a card adds one
 * more access row with a new random token. The new link expires exactly when the
 * original would (quote: its expiry; delivery: the release expiry), so nothing is
 * extended. The approval and receipt themselves still go through the existing pages.
 */
export async function openTalkLink(consultToken: string, target: TalkOpenTarget): Promise<OpenTalkLinkResult> {
  try {
    const project = await getClientProject(consultToken);
    if (!project || project.deleted_at) return { kind: "not-found" };
    if (project.status === "closed") return { kind: "unavailable" };
    const db = supabaseAdmin();
    const since = new Date(Date.now() - 3600000).toISOString();
    const token = randomBytes(32).toString("base64url");

    if (target === "quote") {
      const pointer = await db.from("natori_projects").select("active_quote_id").eq("id", project.id).maybeSingle();
      if (pointer.error) return { kind: "db-error" };
      const quoteId = pointer.data?.active_quote_id;
      if (!quoteId) return { kind: "unavailable" };
      const quote = await db.from("natori_quotes").select("id, project_id, expires_at, accepted_at, superseded_at").eq("id", quoteId).maybeSingle();
      if (quote.error) return { kind: "db-error" };
      const row = quote.data;
      if (!row || row.project_id !== project.id || row.accepted_at || row.superseded_at || Date.parse(row.expires_at) <= Date.now()) return { kind: "unavailable" };
      const recent = await db.from("natori_quote_access").select("token_hash", { count: "exact", head: true }).eq("quote_id", row.id).gte("created_at", since);
      if (recent.error) return { kind: "db-error" };
      if ((recent.count ?? 0) >= OPEN_LINKS_PER_HOUR) return { kind: "throttled" };
      const inserted = await db.from("natori_quote_access").insert({ token_hash: sha256(token), quote_id: row.id, expires_at: row.expires_at });
      return inserted.error ? { kind: "db-error" } : { kind: "ok", path: `/natori/quote/${token}` };
    }

    const [release, paid] = await Promise.all([
      db.from("natori_delivery_releases").select("id, expires_at").eq("project_id", project.id).maybeSingle(),
      db.from("natori_projects").select("payment_confirmed_at").eq("id", project.id).maybeSingle(),
    ]);
    if (release.error || paid.error) return { kind: "db-error" };
    const row = release.data;
    const expiresAt = row ? effectiveDeliveryExpiry(row.expires_at, await readLatestDeliveryExtension(db, project.id)) : null;
    if (!row || !expiresAt || !paid.data?.payment_confirmed_at || Date.parse(expiresAt) <= Date.now()) return { kind: "unavailable" };
    const recent = await db.from("natori_delivery_access").select("token_hash", { count: "exact", head: true }).eq("release_id", row.id).gte("created_at", since);
    if (recent.error) return { kind: "db-error" };
    if ((recent.count ?? 0) >= OPEN_LINKS_PER_HOUR) return { kind: "throttled" };
    const inserted = await db.from("natori_delivery_access").insert({ token_hash: sha256(token), release_id: row.id, expires_at: expiresAt });
    return inserted.error ? { kind: "db-error" } : { kind: "ok", path: `/natori/delivery/${token}` };
  } catch (error) {
    console.error("[natori-talk] open link failed", error instanceof Error ? error.message : "unknown");
    return { kind: "db-error" };
  }
}

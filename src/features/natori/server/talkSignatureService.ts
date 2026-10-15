import "server-only";

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * 相談ページ上部の業務カード（見積・支払い・納品）が依存する状態の指紋。ポーリング用で、
 * ファイルのリンクは署名せず、本文も読まない。指紋が変わったら画面側がページを再描画する。
 * どれかの読み取りに失敗したときは null を返す。画面側は null（項目なし）を「変化なし」とみなすので、
 * 一時的な失敗で再描画が繰り返されることはない。
 */
export async function readTalkSignature(projectId: string): Promise<string | null> {
  try {
    const db = supabaseAdmin();
    const [project, quotes, release, attempt, extension] = await Promise.all([
      db.from("natori_projects")
        .select("status, payment_confirmed_at, payment_link_status, payment_link_url, delivery_token_expires_at, delivery_accepted_at")
        .eq("id", projectId).maybeSingle(),
      db.from("natori_quotes").select("id, version, accepted_at, superseded_at, expires_at")
        .eq("project_id", projectId).order("version", { ascending: true }),
      db.from("natori_delivery_releases").select("expires_at, accepted_at, manifest").eq("project_id", projectId).maybeSingle(),
      // The generation table is not in the generated Supabase types yet.
      (db as unknown as { from(table: string): { select(columns: string): { eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): { limit(count: number): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> } } } } } })
        .from("natori_payment_link_attempts").select("state, deadline, link_url").eq("project_id", projectId)
        .order("generation", { ascending: false }).limit(1).maybeSingle(),
      // Not readLatestDeliveryExtension: that helper turns a failed read into "no extension".
      db.from("natori_delivery_extensions").select("new_expires_at").eq("project_id", projectId)
        .order("new_expires_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (project.error || !project.data || quotes.error || release.error || attempt.error || extension.error) return null;
    const manifest = release.data && Array.isArray(release.data.manifest) ? release.data.manifest.length : null;
    // The cards also depend on the clock (expired quotes / links / deliveries), so each deadline
    // contributes whether it has passed; the fingerprint then changes when a deadline is crossed.
    const now = Date.now();
    const passed = (at: unknown) => typeof at === "string" && Date.parse(at) <= now;
    const attemptDeadline = attempt.data && typeof attempt.data === "object" ? (attempt.data as { deadline?: unknown }).deadline : null;
    const phases = [
      passed(project.data.delivery_token_expires_at), passed(release.data?.expires_at), passed(extension.data?.new_expires_at),
      passed(attemptDeadline), ...(quotes.data ?? []).map(quote => passed(quote.expires_at)),
    ];
    const material = JSON.stringify([project.data, quotes.data, release.data ? { ...release.data, manifest } : null, attempt.data, extension.data?.new_expires_at ?? null, phases]);
    return createHash("sha256").update(material).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}

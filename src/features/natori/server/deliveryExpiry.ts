import "server-only";

import type { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The release row keeps its original expires_at as evidence. An extension is a separate
 * append-only fact, so the effective expiry of a delivery is the later of the two.
 * A failed read falls back to the original expiry, which can only show a delivery as expired.
 */
export async function readLatestDeliveryExtension(db: ReturnType<typeof supabaseAdmin>, projectId: string): Promise<string | null> {
  try {
    const result = await db.from("natori_delivery_extensions").select("new_expires_at")
      .eq("project_id", projectId).order("new_expires_at", { ascending: false }).limit(1).maybeSingle();
    return result.error ? null : result.data?.new_expires_at ?? null;
  } catch { return null; }
}

export function effectiveDeliveryExpiry(original: string, extension: string | null): string {
  return extension && Date.parse(extension) > Date.parse(original) ? extension : original;
}

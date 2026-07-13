import "server-only";

// features/natori/server/linksSiteService.ts
// /natori/links の掲載内容の読み込み・保存（portfolioSiteService と同じ構成）。
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseNatoriLinksContent } from "@/features/natori/lib/linksContent";
import { defaultNatoriLinksContent } from "@/features/natori/constants/linksContent";
import type { NatoriLinksContent } from "@/features/natori/types/links";

const TABLE = "natori_links_content";
const ROW_ID = "main";

// 生成済みのDB型に natori_links_content が未反映のため非ジェネリックに扱う
function adminClient(): SupabaseClient {
  return supabaseAdmin() as unknown as SupabaseClient;
}

/** 掲載内容を読み込む。DB行が無い/壊れている/テーブル未作成ならデフォルトを返す */
export async function loadNatoriLinksContent(): Promise<NatoriLinksContent> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from(TABLE)
      .select("content")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) {
      console.error("[natori-links] content load failed:", error);
      return defaultNatoriLinksContent;
    }
    if (!data) return defaultNatoriLinksContent;
    return parseNatoriLinksContent(data.content) ?? defaultNatoriLinksContent;
  } catch (err) {
    console.error("[natori-links] content load threw:", err);
    return defaultNatoriLinksContent;
  }
}

export type SaveNatoriLinksContentResult =
  | { kind: "ok"; content: NatoriLinksContent }
  | { kind: "invalid" }
  | { kind: "db-error" };

export async function saveNatoriLinksContent(
  value: unknown
): Promise<SaveNatoriLinksContentResult> {
  const content = parseNatoriLinksContent(value);
  if (!content) return { kind: "invalid" };

  const admin = adminClient();
  const { error } = await admin
    .from(TABLE)
    .upsert({ id: ROW_ID, content }, { onConflict: "id" });
  if (error) {
    console.error("[natori-links] content save failed:", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", content };
}

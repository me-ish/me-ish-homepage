import "server-only";

// features/natori/server/clientCaseItems.ts
// お客さまの相談ページに出す品目。相談リンク（トークン）で案件を確かめてから読む。
// 金額・メモ・公開条件はここで落とす。読めないときは null（ページは品目なしで出す）。
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientProject } from "./consultationService";
import type { NatoriClientCaseItem } from "../types/caseItems";

export async function getClientCaseItems(token: string): Promise<NatoriClientCaseItem[] | null> {
  try {
    const project = await getClientProject(token);
    if (!project || project.deleted_at) return null;
    const { data, error } = await supabaseAdmin()
      .from("natori_case_items")
      .select("position, title, progress, due_date, handed_over_at")
      .eq("project_id", project.id)
      .order("position", { ascending: true });
    if (error) {
      console.error("[natori-case-items] client read failed");
      return null;
    }
    type Row = { position: number; title: string; progress: NatoriClientCaseItem["progress"]; due_date: string | null; handed_over_at: string | null };
    return ((data ?? []) as Row[]).map((row) => ({
      position: row.position, title: row.title, progress: row.progress, dueDate: row.due_date, handedOverAt: row.handed_over_at,
    }));
  } catch {
    return null;
  }
}

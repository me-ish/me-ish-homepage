import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabase/server";

/**
 * 合言葉キー方式（ログインセッション無し）で natori 管理画面から書き込む際に
 * 使う user_id を解決する。優先順:
 * 1. ログイン中の Supabase ユーザー
 * 2. env NATORI_OWNER_USER_ID
 * 3. 既存データ（profiles → projects → events）の user_id
 *
 * 夫婦2人で1つのデータセットを共有する運用のため、未ログイン時は
 * 「既にデータを持っている所有者」に書き込みを帰属させる。
 */
export async function resolveNatoriActingUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  const envOwner = process.env.NATORI_OWNER_USER_ID?.trim();
  if (envOwner) return envOwner;

  const admin = supabaseAdmin() as any;
  for (const table of ["natori_user_profiles", "natori_projects", "natori_events"]) {
    const { data, error } = await admin
      .from(table)
      .select("user_id")
      .limit(1)
      .maybeSingle();
    if (!error && data?.user_id) return data.user_id as string;
  }
  return null;
}

export const NATORI_OWNER_UNRESOLVED_MESSAGE =
  "所有者ユーザーを特定できませんでした。一度ログインするか、NATORI_OWNER_USER_ID を設定してください。";

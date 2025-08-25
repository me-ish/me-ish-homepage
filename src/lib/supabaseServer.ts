import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function supabaseServer(): Promise<SupabaseClient> {
  // cookies() は同期でOK（await不要）
  const cookieStore = cookies();

  // App Router の RSC 用のクライアントを返す
  return createServerComponentClient({
    cookies: () => cookieStore,
  });
}

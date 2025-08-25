import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

/** どこから呼んでも同じインスタンスを返す */
export function supabaseBrowser() {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // プロジェクト固有のstorageKeyにして衝突回避
        storageKey: 'meish-auth',
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
  return browserClient;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storageKey: 'meish-auth',      // 衝突回避
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
  return browserClient;
}

import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

export function supabaseServer(): SupabaseClient {
  const cookieStore = cookies(); // 同期でOK
  // Database 型があれば <Database> を型引数に入れてください
  return createServerComponentClient({ cookies: () => cookieStore });
}

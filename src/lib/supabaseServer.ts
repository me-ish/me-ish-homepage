// src/lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

export function supabaseServer(): SupabaseClient {
  // 推奨形：関数ラップをやめて、cookies をそのまま渡す
  return createServerComponentClient({ cookies });
}

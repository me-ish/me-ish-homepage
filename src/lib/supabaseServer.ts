import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export function supabaseServer() {
  return createServerComponentClient({ cookies });
}
export const createClient = supabaseServer; // 互換エイリアス

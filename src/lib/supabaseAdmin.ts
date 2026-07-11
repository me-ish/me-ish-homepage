import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // ← ここで明示的に throw することで Digest の裏に隠れない
    throw new Error(
      `Supabase env missing. NEXT_PUBLIC_SUPABASE_URL=${!!url}, SUPABASE_SERVICE_ROLE_KEY=${!!key}`
    );
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      headers: { 'X-Client-Info': 'me-ish-coa-server' },
      // Next.js が patch した fetch はレンダリング文脈によっては既定で force-cache になり、
      // クライアント遷移 (RSC flight) 時に古い REST 応答が Vercel Data Cache から返って
      // 旧コンテンツが表示される（/natori/portfolio で実際に発生）。service role での
      // 読み書きは常に最新であるべきなので、明示的に no-store で実行する。
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return cached;
}

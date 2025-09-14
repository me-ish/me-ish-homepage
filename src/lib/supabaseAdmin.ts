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
    global: { headers: { 'X-Client-Info': 'me-ish-coa-server' } },
  });
  return cached;
}

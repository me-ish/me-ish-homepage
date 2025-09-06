// src/lib/supabaseAdmin.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,     // ← URL
    process.env.SUPABASE_SERVICE_ROLE_KEY!,    // ← service role key（必ずServer専用）
    { auth: { persistSession: false } }
  );
}

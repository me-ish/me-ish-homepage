'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// NEXT_PUBLIC_SUPABASE_URL / ANON_KEY を自動で読むので引数不要
export function supabaseBrowser() {
  return createClientComponentClient();
}

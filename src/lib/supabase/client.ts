// src/lib/supabase/client.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { publicAcceptanceTarget } from '../caseAcceptanceEnvironment';

export function createClient() {
  publicAcceptanceTarget(true);
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

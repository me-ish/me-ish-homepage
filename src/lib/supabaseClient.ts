// src/lib/supabaseClient.ts
'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createBrowserSupabaseClient();

    
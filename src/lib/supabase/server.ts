// src/lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const createClient = () =>
  createServerComponentClient<any>({ cookies }); // ← anyに直接型指定

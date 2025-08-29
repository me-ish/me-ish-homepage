// src/lib/supabaseServer.ts
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
// もし DB スキーマ型を生成しているなら：
// import type { Database } from '@/types/supabase';

export function supabaseServer() {
  // スキーマ型があるなら <Database> を付けてもOK
  // return createServerComponentClient<Database>({ cookies });
  return createServerComponentClient({ cookies });
}

// 既存コードが createClient を読んでいる場合のエイリアス
export const createClient = supabaseServer;

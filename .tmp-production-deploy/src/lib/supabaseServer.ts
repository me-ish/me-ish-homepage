// src/lib/supabaseServer.ts
// 互換性のためのラッパー - 新規コードは @/lib/supabase/server を使用してください
export { createClient, createClient as supabaseServer } from './supabase/server';

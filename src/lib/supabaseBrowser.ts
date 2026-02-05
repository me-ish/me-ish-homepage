// src/lib/supabaseBrowser.ts
'use client';
// 互換性のためのラッパー - 新規コードは @/lib/supabase/client を使用してください
import { createClient } from './supabase/client';

export const supabaseBrowser = createClient;

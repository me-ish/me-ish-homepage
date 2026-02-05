// src/lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export const createClient = () =>
  createServerComponentClient<Database>({ cookies }); 

// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvnfspyainrxtztjytbo.supabase.co';  // ←あなたのプロジェクトURLに置き換え
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bmZzcHlhaW5yeHR6dGp5dGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA5MDcxMzAsImV4cCI6MjA1NjQ4MzEzMH0.NuVwTRfARp0YNdPgtkluI7cFf5zEXpikDJ1Dj5u__3Q';      // ← Supabaseのanonキーに置き換え

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

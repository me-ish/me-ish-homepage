// src/types/supabase.ts

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: {
          id: string;
          title: string;
          artist_name: string;
          file_name: string;
          image_url: string;
          email: string | null;
          external_user_id: string | null;
          confirmed: boolean;
          created_at: string | null;
          edition_total: number | null; // ← 追加
          edition_sold: number | null;  // ← 追加
        };
      };
      renewals: {
        Row: {
          id: string;
          entry_id: string;
          user_id: string;
          plan: string;
        };
      };
    };
  };
};

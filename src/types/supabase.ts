// src/types/supabase.ts
export type Database = {
  public: {
    Tables: {
      entries: {
        Row: {
          id: string;
          title: string;
          status: string;
          user_id: string;
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

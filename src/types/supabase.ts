export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body_md: string
          category: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          link_url: string | null
          pinned: boolean
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body_md: string
          category?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          link_url?: string | null
          pinned?: boolean
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          category?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          link_url?: string | null
          pinned?: boolean
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cert_links: {
        Row: {
          created_at: string
          entry_id: number
          expires_at: string | null
          id: string
          revoked: boolean
          token_hash: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          entry_id: number
          expires_at?: string | null
          id?: string
          revoked?: boolean
          token_hash: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          entry_id?: number
          expires_at?: string | null
          id?: string
          revoked?: boolean
          token_hash?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          artist_name: string | null
          artist_reward_yen: number | null
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string
          description: string
          display_end_at: string | null
          display_plan: string | null
          display_ready: boolean | null
          display_start_at: string | null
          edition_remaining: number | null
          edition_sold: number
          edition_total: number | null
          email: string | null
          external_user_id: string | null
          file_name: string | null
          gallery_type: string | null
          id: number
          image_url: string
          is_for_sale: boolean
          is_paid_to_artist: boolean | null
          is_sold: boolean | null
          likes: number
          meish_fee_yen: number | null
          paid_at: string | null
          price: number | null
          reject_email_sent_at: string | null
          reject_reason: string | null
          rejected_at: string | null
          sale_type: string
          sns_links: string
          sold_out_calc: boolean | null
          title: string | null
          token_id: number | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          artist_name?: string | null
          artist_reward_yen?: number | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          description: string
          display_end_at?: string | null
          display_plan?: string | null
          display_ready?: boolean | null
          display_start_at?: string | null
          edition_remaining?: number | null
          edition_sold?: number
          edition_total?: number | null
          email?: string | null
          external_user_id?: string | null
          file_name?: string | null
          gallery_type?: string | null
          id?: number
          image_url: string
          is_for_sale?: boolean
          is_paid_to_artist?: boolean | null
          is_sold?: boolean | null
          likes?: number
          meish_fee_yen?: number | null
          paid_at?: string | null
          price?: number | null
          reject_email_sent_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          sale_type: string
          sns_links: string
          sold_out_calc?: boolean | null
          title?: string | null
          token_id?: number | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          artist_name?: string | null
          artist_reward_yen?: number | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          description?: string
          display_end_at?: string | null
          display_plan?: string | null
          display_ready?: boolean | null
          display_start_at?: string | null
          edition_remaining?: number | null
          edition_sold?: number
          edition_total?: number | null
          email?: string | null
          external_user_id?: string | null
          file_name?: string | null
          gallery_type?: string | null
          id?: number
          image_url?: string
          is_for_sale?: boolean
          is_paid_to_artist?: boolean | null
          is_sold?: boolean | null
          likes?: number
          meish_fee_yen?: number | null
          paid_at?: string | null
          price?: number | null
          reject_email_sent_at?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          sale_type?: string
          sns_links?: string
          sold_out_calc?: boolean | null
          title?: string | null
          token_id?: number | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      entry_processing_jobs: {
        Row: {
          id: string
          entry_id: number
          status: string
          attempts: number
          locked_at: string | null
          locked_by: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          entry_id: number
          status?: string
          attempts?: number
          locked_at?: string | null
          locked_by?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          entry_id?: number
          status?: string
          attempts?: number
          locked_at?: string | null
          locked_by?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_processing_jobs_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_read: boolean | null
          message: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_read?: boolean | null
          message: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_read?: boolean | null
          message?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          sns_links: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          sns_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          sns_links?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          buyer_email: string | null
          entry_id: number
          id: string
          metadata: Json | null
          price: number | null
          purchased_at: string | null
          stripe_session_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          entry_id: number
          id?: string
          metadata?: Json | null
          price?: number | null
          purchased_at?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          entry_id?: number
          id?: string
          metadata?: Json | null
          price?: number | null
          purchased_at?: string | null
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      special_thanks: {
        Row: {
          avatar_url: string | null
          display_name: string
          homepage_url: string | null
          id: string
          instagram_url: string | null
          is_public: boolean
          sort_order: number | null
          tagline: string | null
          twitter_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          homepage_url?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean
          sort_order?: number | null
          tagline?: string | null
          twitter_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          homepage_url?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean
          sort_order?: number | null
          tagline?: string | null
          twitter_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      announcements_public: {
        Row: {
          body_md: string | null
          category: string | null
          id: string | null
          link_url: string | null
          pinned: boolean | null
          published_at: string | null
          title: string | null
        }
        Insert: {
          body_md?: string | null
          category?: string | null
          id?: string | null
          link_url?: string | null
          pinned?: boolean | null
          published_at?: string | null
          title?: string | null
        }
        Update: {
          body_md?: string | null
          category?: string | null
          id?: string | null
          link_url?: string | null
          pinned?: boolean | null
          published_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      v_cert_links_active: {
        Row: {
          created_at: string | null
          entry_id: number | null
          expires_at: string | null
          id: string | null
          revoked: boolean | null
          token_hash: string | null
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_id?: number | null
          expires_at?: string | null
          id?: string | null
          revoked?: boolean | null
          token_hash?: string | null
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_id?: number | null
          expires_at?: string | null
          id?: string | null
          revoked?: boolean | null
          token_hash?: string | null
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      consume_cert_token: {
        Args: { p_entry_id: number; p_one_time?: boolean; p_token_hash: string }
        Returns: boolean
      }
      finalize_sale: {
        Args: { p_entry_id: number; p_quantity: number; p_session_id: string }
        Returns: {
          new_edition_sold: number
          sold_out: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

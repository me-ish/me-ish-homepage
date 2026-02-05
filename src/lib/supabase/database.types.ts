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
      artists_bank_accounts: {
        Row: {
          account_name_kana: string
          account_number: string
          account_type: string
          bank_code: string
          branch_code: string
          external_user_id: string
          id: number
          updated_at: string
        }
        Insert: {
          account_name_kana: string
          account_number: string
          account_type: string
          bank_code: string
          branch_code: string
          external_user_id: string
          id?: number
          updated_at?: string
        }
        Update: {
          account_name_kana?: string
          account_number?: string
          account_type?: string
          bank_code?: string
          branch_code?: string
          external_user_id?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      aura_first20_redemptions: {
        Row: {
          converted_to_meish_at: string | null
          created_at: string
          email: string
          request_id: string | null
          used_at: string
        }
        Insert: {
          converted_to_meish_at?: string | null
          created_at?: string
          email: string
          request_id?: string | null
          used_at?: string
        }
        Update: {
          converted_to_meish_at?: string | null
          created_at?: string
          email?: string
          request_id?: string | null
          used_at?: string
        }
        Relationships: []
      }
      aura_meish_free_claims: {
        Row: {
          created_at: string
          email: string
          entry_id: number | null
          request_id: string | null
          used_at: string
        }
        Insert: {
          created_at?: string
          email: string
          entry_id?: number | null
          request_id?: string | null
          used_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          entry_id?: number | null
          request_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aura_meish_free_claims_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_meish_free_claims_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "aura_meish_free_claims_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      aura_promo_counters: {
        Row: {
          key: string
          limit_count: number
        }
        Insert: {
          key: string
          limit_count: number
        }
        Update: {
          key?: string
          limit_count?: number
        }
        Relationships: []
      }
      aura_requests: {
        Row: {
          content: Json | null
          created_at: string
          design: Json | null
          email: string | null
          error: string | null
          id: string
          paid_at: string | null
          payload: Json | null
          payment_status: string
          public_id: string | null
          public_slug: string | null
          published_at: string | null
          renderer_version: string
          session_token: string | null
          slug: string | null
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          design?: Json | null
          email?: string | null
          error?: string | null
          id?: string
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string
          session_token?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          design?: Json | null
          email?: string | null
          error?: string | null
          id?: string
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string
          session_token?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          visibility?: string
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
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          agree_promotion: boolean
          agree_storage: boolean
          ai_usage: string | null
          ai_usage_note: string | null
          ai_usage_scope: string[] | null
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
          edition_mode: string | null
          edition_remaining: number | null
          edition_sold: number
          edition_total: number | null
          email: string | null
          ending_soon_notified_at: string | null
          external_user_id: string | null
          file_name: string | null
          force_wm: boolean
          gallery_type: string | null
          has_signature: boolean | null
          id: number
          image_url: string
          is_for_sale: boolean
          is_paid_to_artist: boolean | null
          is_sold: boolean | null
          likes: number
          meish_fee_yen: number | null
          paid_at: string | null
          plan_payment_amount_yen: number | null
          plan_payment_checkout_created_at: string | null
          plan_payment_paid_at: string | null
          plan_payment_session_id: string | null
          plan_payment_status: string
          portfolio_hidden: boolean
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
          agree_promotion?: boolean
          agree_storage?: boolean
          ai_usage?: string | null
          ai_usage_note?: string | null
          ai_usage_scope?: string[] | null
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
          edition_mode?: string | null
          edition_remaining?: number | null
          edition_sold?: number
          edition_total?: number | null
          email?: string | null
          ending_soon_notified_at?: string | null
          external_user_id?: string | null
          file_name?: string | null
          force_wm?: boolean
          gallery_type?: string | null
          has_signature?: boolean | null
          id?: number
          image_url: string
          is_for_sale?: boolean
          is_paid_to_artist?: boolean | null
          is_sold?: boolean | null
          likes?: number
          meish_fee_yen?: number | null
          paid_at?: string | null
          plan_payment_amount_yen?: number | null
          plan_payment_checkout_created_at?: string | null
          plan_payment_paid_at?: string | null
          plan_payment_session_id?: string | null
          plan_payment_status?: string
          portfolio_hidden?: boolean
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
          agree_promotion?: boolean
          agree_storage?: boolean
          ai_usage?: string | null
          ai_usage_note?: string | null
          ai_usage_scope?: string[] | null
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
          edition_mode?: string | null
          edition_remaining?: number | null
          edition_sold?: number
          edition_total?: number | null
          email?: string | null
          ending_soon_notified_at?: string | null
          external_user_id?: string | null
          file_name?: string | null
          force_wm?: boolean
          gallery_type?: string | null
          has_signature?: boolean | null
          id?: number
          image_url?: string
          is_for_sale?: boolean
          is_paid_to_artist?: boolean | null
          is_sold?: boolean | null
          likes?: number
          meish_fee_yen?: number | null
          paid_at?: string | null
          plan_payment_amount_yen?: number | null
          plan_payment_checkout_created_at?: string | null
          plan_payment_paid_at?: string | null
          plan_payment_session_id?: string | null
          plan_payment_status?: string
          portfolio_hidden?: boolean
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
          attempts: number
          created_at: string
          entry_id: number
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          entry_id: number
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          entry_id?: number
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          status?: string
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
          {
            foreignKeyName: "entry_processing_jobs_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_processing_jobs_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_view_events: {
        Row: {
          entry_id: number
          id: string
          occurred_at: string
          session_id: string | null
          viewer_user_id: string | null
        }
        Insert: {
          entry_id: number
          id?: string
          occurred_at?: string
          session_id?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          entry_id?: number
          id?: string
          occurred_at?: string
          session_id?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
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
      likes: {
        Row: {
          created_at: string
          entry_id: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: number
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "likes_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          artist_count: number | null
          closed_at: string | null
          created_at: string | null
          id: string
          paid_at: string | null
          period_ym: string
          sale_count: number | null
          status: string
          total_amount_yen: number | null
        }
        Insert: {
          artist_count?: number | null
          closed_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_ym: string
          sale_count?: number | null
          status?: string
          total_amount_yen?: number | null
        }
        Update: {
          artist_count?: number | null
          closed_at?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_ym?: string
          sale_count?: number | null
          status?: string
          total_amount_yen?: number | null
        }
        Relationships: []
      }
      payout_items: {
        Row: {
          created_at: string
          id: string
          payout_id: string
          sale_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout_id: string
          sale_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payout_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_yen: number
          created_at: string
          id: string
          note: string | null
          paid_at: string | null
          period_ym: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_yen?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          period_ym: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_yen?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          period_ym?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_settings: {
        Row: {
          bio_short: string | null
          contact_email: string | null
          contact_url: string | null
          created_at: string
          headline: string | null
          is_public: boolean
          public_display_name: string | null
          sort_key: string
          updated_at: string
          user_id: string
          works_filter: string
        }
        Insert: {
          bio_short?: string | null
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          headline?: string | null
          is_public?: boolean
          public_display_name?: string | null
          sort_key?: string
          updated_at?: string
          user_id: string
          works_filter?: string
        }
        Update: {
          bio_short?: string | null
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          headline?: string | null
          is_public?: boolean
          public_display_name?: string | null
          sort_key?: string
          updated_at?: string
          user_id?: string
          works_filter?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_focus_x: number
          banner_focus_y: number
          banner_url: string | null
          banner_zoom: number
          bio: string | null
          created_at: string | null
          display_name: string
          id: string
          sns_links: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_focus_x?: number
          banner_focus_y?: number
          banner_url?: string | null
          banner_zoom?: number
          bio?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          sns_links?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_focus_x?: number
          banner_focus_y?: number
          banner_url?: string | null
          banner_zoom?: number
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
          artist_reward_yen: number | null
          buyer_email: string | null
          close_batch_id: string | null
          entry_id: number
          id: string
          meish_fee_yen: number | null
          metadata: Json | null
          paid_at: string | null
          payout_batch_id: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          price: number | null
          purchased_at: string | null
          stripe_session_id: string
        }
        Insert: {
          artist_reward_yen?: number | null
          buyer_email?: string | null
          close_batch_id?: string | null
          entry_id: number
          id?: string
          meish_fee_yen?: number | null
          metadata?: Json | null
          paid_at?: string | null
          payout_batch_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          price?: number | null
          purchased_at?: string | null
          stripe_session_id: string
        }
        Update: {
          artist_reward_yen?: number | null
          buyer_email?: string | null
          close_batch_id?: string | null
          entry_id?: number
          id?: string
          meish_fee_yen?: number | null
          metadata?: Json | null
          paid_at?: string | null
          payout_batch_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          price?: number | null
          purchased_at?: string | null
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_close_batch_id_fkey"
            columns: ["close_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payout_batch_fk"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
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
      aura_first20_stats: {
        Row: {
          key: string | null
          limit_count: number | null
          remaining: number | null
          used_count: number | null
        }
        Relationships: []
      }
      entry_view_stats: {
        Row: {
          entry_id: number | null
          last_viewed_at: string | null
          unique_views: number | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_view_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      v_admin_entry_workflow: {
        Row: {
          age_hours: number | null
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          display_end_at: string | null
          display_ready: boolean | null
          display_start_at: string | null
          entry_id: number | null
          gallery_type: string | null
          image_url: string | null
          is_ended: boolean | null
          is_live: boolean | null
          is_ready_candidate: boolean | null
          is_stalled: boolean | null
          last_error: string | null
          phase: string | null
          processing_attempts: number | null
          processing_status: string | null
          processing_updated_at: string | null
          reject_email_sent_at: string | null
          reject_reason: string | null
          rejected_at: string | null
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
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "cert_links_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      v_my_external_user_ids: {
        Row: {
          external_user_id: string | null
        }
        Relationships: []
      }
      v_my_sales_summary: {
        Row: {
          gross_sales_yen: number | null
          paid_out_yen: number | null
          pending_payout_yen: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_pending_payouts: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          latest_purchase_at: string | null
          oldest_purchase_at: string | null
          pending_amount: number | null
          pending_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_public_portfolio_entries: {
        Row: {
          created_at: string | null
          description: string | null
          display_end_at: string | null
          display_ready: boolean | null
          display_start_at: string | null
          edition_remaining: number | null
          edition_sold: number | null
          edition_total: number | null
          gallery_type: string | null
          id: number | null
          image_url: string | null
          is_for_sale: boolean | null
          is_sold: boolean | null
          likes: number | null
          price: number | null
          sale_type: string | null
          sold_out_calc: boolean | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_end_at?: string | null
          display_ready?: boolean | null
          display_start_at?: string | null
          edition_remaining?: number | null
          edition_sold?: number | null
          edition_total?: number | null
          gallery_type?: string | null
          id?: number | null
          image_url?: string | null
          is_for_sale?: boolean | null
          is_sold?: boolean | null
          likes?: number | null
          price?: number | null
          sale_type?: string | null
          sold_out_calc?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_end_at?: string | null
          display_ready?: boolean | null
          display_start_at?: string | null
          edition_remaining?: number | null
          edition_sold?: number | null
          edition_total?: number | null
          gallery_type?: string | null
          id?: number | null
          image_url?: string | null
          is_for_sale?: boolean | null
          is_sold?: boolean | null
          likes?: number | null
          price?: number | null
          sale_type?: string | null
          sold_out_calc?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_mark_sales_paid: {
        Args: { p_batch_id?: string; p_user_id: string }
        Returns: {
          total_amount: number
          updated_count: number
        }[]
      }
      aura_claim_first20_free: {
        Args: { p_email: string; p_request_id?: string }
        Returns: Json
      }
      aura_claim_meish_free: {
        Args: { p_email: string; p_request_id?: string }
        Returns: Json
      }
      consume_cert_token: {
        Args: { p_entry_id: number; p_one_time?: boolean; p_token_hash: string }
        Returns: boolean
      }
      finalize_sale:
        | {
            Args: {
              p_entry_id: number
              p_quantity: number
              p_session_id: string
            }
            Returns: {
              new_edition_sold: number
              sold_out: boolean
            }[]
          }
        | {
            Args: {
              p_entry_id: number
              p_price?: number
              p_quantity: number
              p_session_id: string
            }
            Returns: {
              new_edition_sold: number
              sold_out: boolean
            }[]
          }
      get_public_portfolio: { Args: { p_user_id: string }; Returns: Json }
      increment_entry_likes: { Args: { p_entry_id: number }; Returns: number }
      set_entry_portfolio_hidden: {
        Args: { p_entry_id: number; p_hidden: boolean }
        Returns: undefined
      }
      toggle_like: {
        Args: { p_entry_id: unknown }
        Returns: {
          liked: boolean
          likes_count: number
        }[]
      }
    }
    Enums: {
      payout_status: "pending" | "scheduled" | "paid" | "failed"
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
    Enums: {
      payout_status: ["pending", "scheduled", "paid", "failed"],
    },
  },
} as const

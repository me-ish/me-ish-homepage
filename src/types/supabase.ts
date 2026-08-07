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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          detail: Json | null
          id: string
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          detail?: Json | null
          id?: string
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          detail?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: []
      }
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
      aura_projects: {
        Row: {
          accent_color: string | null
          avatar_path: string | null
          avatar_shape: string
          bg_pattern: string
          bio: string | null
          created_at: string
          display_title: string | null
          email: string | null
          font_preset: string | null
          id: string
          layout_pref: string | null
          name: string | null
          payment_status: string
          public_id: string | null
          public_slug: string | null
          published_at: string | null
          renderer_version: string
          section_order: string[] | null
          section_visibility: Json
          services: Json
          session_token: string
          skills: Json
          social: Json
          status: string
          tagline: string | null
          theme_id: string
          updated_at: string
          visibility: string
          works: Json
        }
        Insert: {
          accent_color?: string | null
          avatar_path?: string | null
          avatar_shape?: string
          bg_pattern?: string
          bio?: string | null
          created_at?: string
          display_title?: string | null
          email?: string | null
          font_preset?: string | null
          id?: string
          layout_pref?: string | null
          name?: string | null
          payment_status?: string
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string
          section_order?: string[] | null
          section_visibility?: Json
          services?: Json
          session_token: string
          skills?: Json
          social?: Json
          status?: string
          tagline?: string | null
          theme_id?: string
          updated_at?: string
          visibility?: string
          works?: Json
        }
        Update: {
          accent_color?: string | null
          avatar_path?: string | null
          avatar_shape?: string
          bg_pattern?: string
          bio?: string | null
          created_at?: string
          display_title?: string | null
          email?: string | null
          font_preset?: string | null
          id?: string
          layout_pref?: string | null
          name?: string | null
          payment_status?: string
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string
          section_order?: string[] | null
          section_visibility?: Json
          services?: Json
          session_token?: string
          skills?: Json
          social?: Json
          status?: string
          tagline?: string | null
          theme_id?: string
          updated_at?: string
          visibility?: string
          works?: Json
        }
        Relationships: []
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
      card_requests: {
        Row: {
          content: Json | null
          created_at: string | null
          design: Json | null
          email: string
          error: string | null
          id: string
          paid_at: string | null
          payload: Json | null
          payment_status: string | null
          public_id: string | null
          public_slug: string | null
          published_at: string | null
          renderer_version: string | null
          session_token: string
          status: string
          stripe_session_id: string | null
          tier: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          design?: Json | null
          email: string
          error?: string | null
          id?: string
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string | null
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string | null
          session_token: string
          status?: string
          stripe_session_id?: string | null
          tier?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          design?: Json | null
          email?: string
          error?: string | null
          id?: string
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string | null
          public_id?: string | null
          public_slug?: string | null
          published_at?: string | null
          renderer_version?: string | null
          session_token?: string
          status?: string
          stripe_session_id?: string | null
          tier?: string | null
          updated_at?: string | null
          visibility?: string | null
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
          end_notified_at: string | null
          ending_soon_notified_at: string | null
          external_user_id: string | null
          file_name: string | null
          force_wm: boolean
          gallery_type: string | null
          guarantee_extended_count: number | null
          guarantee_period_end: string | null
          guarantee_period_start: string | null
          guarantee_remaining: number | null
          guarantee_total: number | null
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
          end_notified_at?: string | null
          ending_soon_notified_at?: string | null
          external_user_id?: string | null
          file_name?: string | null
          force_wm?: boolean
          gallery_type?: string | null
          guarantee_extended_count?: number | null
          guarantee_period_end?: string | null
          guarantee_period_start?: string | null
          guarantee_remaining?: number | null
          guarantee_total?: number | null
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
          end_notified_at?: string | null
          ending_soon_notified_at?: string | null
          external_user_id?: string | null
          file_name?: string | null
          force_wm?: boolean
          gallery_type?: string | null
          guarantee_extended_count?: number | null
          guarantee_period_end?: string | null
          guarantee_period_start?: string | null
          guarantee_remaining?: number | null
          guarantee_total?: number | null
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
      entry_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          entry_id: number
          id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entry_id: number
          id?: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entry_id?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_daily_slots: {
        Row: {
          created_at: string
          display_date: string
          entry_id: number
          id: string
          slot_index: number
        }
        Insert: {
          created_at?: string
          display_date: string
          entry_id: number
          id?: string
          slot_index: number
        }
        Update: {
          created_at?: string
          display_date?: string
          entry_id?: number
          id?: string
          slot_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_daily_slots_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_daily_slots_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_daily_slots_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
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
      kpi_jobs: {
        Row: {
          content_type: string | null
          created_at: string
          duration_sec: number | null
          error_message: string | null
          executed_at: string
          id: string
          job_name: string
          slot: string | null
          success: boolean
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          executed_at: string
          id?: string
          job_name: string
          slot?: string | null
          success?: boolean
        }
        Update: {
          content_type?: string | null
          created_at?: string
          duration_sec?: number | null
          error_message?: string | null
          executed_at?: string
          id?: string
          job_name?: string
          slot?: string | null
          success?: boolean
        }
        Relationships: []
      }
      kpi_posts: {
        Row: {
          content: string | null
          created_at: string
          delay_sec: number | null
          engagement_rate: number | null
          error_message: string | null
          final_post_text: string | null
          id: string
          impressions: number | null
          impressions_fetched_at: string | null
          kind: string | null
          likes: number | null
          model_name: string | null
          posted_at: string | null
          profile_clicks: number | null
          prompt_version: string | null
          replies: number | null
          retweets: number | null
          safety_checked_at: string | null
          safety_reasons: Json | null
          safety_status: string | null
          scheduled_at: string | null
          source_market_snapshot: Json | null
          source_news_ids: string[] | null
          success: boolean | null
          x_post_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          delay_sec?: number | null
          engagement_rate?: number | null
          error_message?: string | null
          final_post_text?: string | null
          id?: string
          impressions?: number | null
          impressions_fetched_at?: string | null
          kind?: string | null
          likes?: number | null
          model_name?: string | null
          posted_at?: string | null
          profile_clicks?: number | null
          prompt_version?: string | null
          replies?: number | null
          retweets?: number | null
          safety_checked_at?: string | null
          safety_reasons?: Json | null
          safety_status?: string | null
          scheduled_at?: string | null
          source_market_snapshot?: Json | null
          source_news_ids?: string[] | null
          success?: boolean | null
          x_post_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          delay_sec?: number | null
          engagement_rate?: number | null
          error_message?: string | null
          final_post_text?: string | null
          id?: string
          impressions?: number | null
          impressions_fetched_at?: string | null
          kind?: string | null
          likes?: number | null
          model_name?: string | null
          posted_at?: string | null
          profile_clicks?: number | null
          prompt_version?: string | null
          replies?: number | null
          retweets?: number | null
          safety_checked_at?: string | null
          safety_reasons?: Json | null
          safety_status?: string | null
          scheduled_at?: string | null
          source_market_snapshot?: Json | null
          source_news_ids?: string[] | null
          success?: boolean | null
          x_post_id?: string | null
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
      natori_delivery_files: {
        Row: {
          created_at: string
          file_name: string
          folder: string
          id: string
          project_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          folder: string
          id?: string
          project_id: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          folder?: string
          id?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_delivery_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_events: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      natori_inquiry_reference_files: {
        Row: {
          created_at: string
          id: string
          project_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_inquiry_reference_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_links_content: {
        Row: {
          content: Json
          id: string
          updated_at: string
        }
        Insert: {
          content: Json
          id?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      natori_order_mail_logs: {
        Row: {
          amount: number
          body_snapshot: string
          created_at: string
          error_message: string | null
          id: number
          kind: string
          link_url: string | null
          project_id: string
          quote_id: string | null
          request_id: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          updated_at: string
        }
        Insert: {
          amount: number
          body_snapshot: string
          created_at?: string
          error_message?: string | null
          id?: never
          kind: string
          link_url?: string | null
          project_id: string
          quote_id?: string | null
          request_id: string
          sent_at?: string | null
          status: string
          subject: string
          to_email: string
          updated_at?: string
        }
        Update: {
          amount?: number
          body_snapshot?: string
          created_at?: string
          error_message?: string | null
          id?: never
          kind?: string
          link_url?: string | null
          project_id?: string
          quote_id?: string | null
          request_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_order_mail_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "natori_order_mail_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "natori_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_page_events: {
        Row: {
          created_at: string
          event: string
          id: number
          label: string
          path: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          label?: string
          path?: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          label?: string
          path?: string
        }
        Relationships: []
      }
      natori_payment_transactions: {
        Row: {
          amount: number
          id: string
          note: string | null
          project_id: string
          quote_id: string | null
          received_at: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          note?: string | null
          project_id: string
          quote_id?: string | null
          received_at?: string
          status: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          note?: string | null
          project_id?: string
          quote_id?: string | null
          received_at?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "natori_payment_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "natori_payment_transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "natori_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_portfolio_content: {
        Row: {
          content: Json
          id: string
          updated_at: string
        }
        Insert: {
          content: Json
          id?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      natori_pricing_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          preset_key: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          preset_key: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          preset_key?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      natori_project_activity: {
        Row: {
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          project_id: string
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          project_id: string
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          project_id?: string
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_project_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_project_reference_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          normalized_url: string
          project_id: string
          provider: string | null
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          normalized_url: string
          project_id: string
          provider?: string | null
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          normalized_url?: string
          project_id?: string
          provider?: string | null
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_project_reference_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_project_tasks: {
        Row: {
          done: boolean
          estimated_hours: number | null
          id: string
          label: string
          project_id: string
          sort_order: number
          stage: string
          task_key: string
        }
        Insert: {
          done?: boolean
          estimated_hours?: number | null
          id?: string
          label: string
          project_id: string
          sort_order?: number
          stage: string
          task_key: string
        }
        Update: {
          done?: boolean
          estimated_hours?: number | null
          id?: string
          label?: string
          project_id?: string
          sort_order?: number
          stage?: string
          task_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_projects: {
        Row: {
          active_quote_id: string | null
          amount: number | null
          client_email: string | null
          client_name: string
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          delivered_mail_at: string | null
          delivery_accepted_at: string | null
          delivery_plan: string
          delivery_token_expires_at: string | null
          delivery_token_hash: string | null
          due_date: string | null
          id: string
          next_action: string
          note: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_confirmed_at: string | null
          payment_link_id: string | null
          payment_link_status: string | null
          payment_link_url: string | null
          payment_quote_id: string | null
          priority: string | null
          quote_accept_token_hash: string | null
          quote_accepted_amount: number | null
          quote_accepted_at: string | null
          quote_token_expires_at: string | null
          quoted_amount: number | null
          request_data: Json | null
          start_date: string | null
          status: string
          stripe_payment_session_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_quote_id?: string | null
          amount?: number | null
          client_email?: string | null
          client_name: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_mail_at?: string | null
          delivery_accepted_at?: string | null
          delivery_plan?: string
          delivery_token_expires_at?: string | null
          delivery_token_hash?: string | null
          due_date?: string | null
          id?: string
          next_action?: string
          note?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_link_id?: string | null
          payment_link_status?: string | null
          payment_link_url?: string | null
          payment_quote_id?: string | null
          priority?: string | null
          quote_accept_token_hash?: string | null
          quote_accepted_amount?: number | null
          quote_accepted_at?: string | null
          quote_token_expires_at?: string | null
          quoted_amount?: number | null
          request_data?: Json | null
          start_date?: string | null
          status?: string
          stripe_payment_session_id?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_quote_id?: string | null
          amount?: number | null
          client_email?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_mail_at?: string | null
          delivery_accepted_at?: string | null
          delivery_plan?: string
          delivery_token_expires_at?: string | null
          delivery_token_hash?: string | null
          due_date?: string | null
          id?: string
          next_action?: string
          note?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_confirmed_at?: string | null
          payment_link_id?: string | null
          payment_link_status?: string | null
          payment_link_url?: string | null
          payment_quote_id?: string | null
          priority?: string | null
          quote_accept_token_hash?: string | null
          quote_accepted_amount?: number | null
          quote_accepted_at?: string | null
          quote_token_expires_at?: string | null
          quoted_amount?: number | null
          request_data?: Json | null
          start_date?: string | null
          status?: string
          stripe_payment_session_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "natori_projects_active_quote_id_fkey"
            columns: ["active_quote_id"]
            isOneToOne: false
            referencedRelation: "natori_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "natori_projects_payment_quote_id_fkey"
            columns: ["payment_quote_id"]
            isOneToOne: false
            referencedRelation: "natori_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_quotes: {
        Row: {
          accepted_at: string | null
          amount: number
          body_snapshot: string
          client_name: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string | null
          issued_at: string | null
          pricing_snapshot: Json | null
          project_id: string
          request_snapshot: Json | null
          subject: string
          superseded_at: string | null
          title: string
          to_email: string
          token_hash: string
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          body_snapshot: string
          client_name: string
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          pricing_snapshot?: Json | null
          project_id: string
          request_snapshot?: Json | null
          subject: string
          superseded_at?: string | null
          title: string
          to_email: string
          token_hash: string
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          body_snapshot?: string
          client_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          pricing_snapshot?: Json | null
          project_id?: string
          request_snapshot?: Json | null
          subject?: string
          superseded_at?: string | null
          title?: string
          to_email?: string
          token_hash?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "natori_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "natori_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      natori_user_profiles: {
        Row: {
          created_at: string
          daily_capacity_hours: number | null
          display_name: string | null
          handle: string | null
          links_url: string | null
          portfolio_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_capacity_hours?: number | null
          display_name?: string | null
          handle?: string | null
          links_url?: string | null
          portfolio_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_capacity_hours?: number | null
          display_name?: string | null
          handle?: string | null
          links_url?: string | null
          portfolio_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      processed_stripe_events: {
        Row: {
          event_id: string
          received_at: string
        }
        Insert: {
          event_id: string
          received_at?: string
        }
        Update: {
          event_id?: string
          received_at?: string
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
      youtube_videos: {
        Row: {
          comment_count: number | null
          content_type: string | null
          duration_iso: string | null
          duration_seconds: number | null
          fetched_at: string | null
          is_shorts: boolean | null
          like_count: number | null
          model_name: string | null
          prompt_version: string | null
          published_at: string | null
          safety_checked_at: string | null
          safety_reasons: Json | null
          safety_status: string | null
          shorts_type: string | null
          slot: string | null
          source_news_ids: string[] | null
          title: string | null
          video_id: string
          view_count: number | null
        }
        Insert: {
          comment_count?: number | null
          content_type?: string | null
          duration_iso?: string | null
          duration_seconds?: number | null
          fetched_at?: string | null
          is_shorts?: boolean | null
          like_count?: number | null
          model_name?: string | null
          prompt_version?: string | null
          published_at?: string | null
          safety_checked_at?: string | null
          safety_reasons?: Json | null
          safety_status?: string | null
          shorts_type?: string | null
          slot?: string | null
          source_news_ids?: string[] | null
          title?: string | null
          video_id: string
          view_count?: number | null
        }
        Update: {
          comment_count?: number | null
          content_type?: string | null
          duration_iso?: string | null
          duration_seconds?: number | null
          fetched_at?: string | null
          is_shorts?: boolean | null
          like_count?: number | null
          model_name?: string | null
          prompt_version?: string | null
          published_at?: string | null
          safety_checked_at?: string | null
          safety_reasons?: Json | null
          safety_status?: string | null
          shorts_type?: string | null
          slot?: string | null
          source_news_ids?: string[] | null
          title?: string | null
          video_id?: string
          view_count?: number | null
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
      entry_comment_counts: {
        Row: {
          comment_count: number | null
          entry_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_admin_entry_workflow"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "entry_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_public_portfolio_entries"
            referencedColumns: ["id"]
          },
        ]
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
      v_artist_view_stats: {
        Row: {
          last_viewed_at: string | null
          total_views: number | null
          unique_views: number | null
          user_id: string | null
          viewed_works_count: number | null
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
      v_viewer_stats: {
        Row: {
          last_viewed_at: string | null
          total_views: number | null
          unique_works_viewed: number | null
          user_id: string | null
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
      get_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_gallery_stats: {
        Args: never
        Returns: {
          artists_count: number
          unique_views: number
          works_count: number
        }[]
      }
      get_my_artist_view_stats: {
        Args: { p_user_id: string }
        Returns: {
          last_viewed_at: string
          total_views: number
          unique_views: number
          viewed_works_count: number
        }[]
      }
      get_my_viewer_stats: {
        Args: { p_user_id: string }
        Returns: {
          last_viewed_at: string
          total_views: number
          unique_works_viewed: number
        }[]
      }
      get_my_works_view_stats: {
        Args: { p_user_id: string }
        Returns: {
          entry_id: number
          last_viewed_at: string
          title: string
          unique_views: number
          view_count: number
        }[]
      }
      get_public_portfolio: { Args: { p_user_id: string }; Returns: Json }
      increment_entry_likes: { Args: { p_entry_id: number }; Returns: number }
      natori_accept_delivery_v1: {
        Args: { p_token_hash: string }
        Returns: {
          accepted_at: string
          client_name: string
          project_id: string
          project_title: string
          result: string
        }[]
      }
      natori_accept_quote: {
        Args: { p_token_hash: string }
        Returns: {
          accepted_at: string
          project_id: string
          quote_id: string
          result: string
        }[]
      }
      natori_confirm_manual_payment: {
        Args: { p_next_action: string; p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      natori_confirm_project_type_v1: {
        Args: { p_project_id: string; p_type: string; p_user_id: string }
        Returns: {
          project_id: string
          project_type: string
          result: string
          task_count: number
        }[]
      }
      natori_create_project_with_tasks: {
        Args: {
          p_project: Json
          p_reference_paths: Json
          p_tasks: Json
          p_user_id: string
        }
        Returns: string
      }
      natori_create_project_with_tasks_v2: {
        Args: {
          p_client_email: string
          p_client_name: string
          p_project_id: string
          p_reference_files: Json
          p_reference_links: Json
          p_request_data: Json
          p_user_id: string
        }
        Returns: {
          created_at: string
          project_id: string
        }[]
      }
      natori_delete_project: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      natori_issue_quote: {
        Args: {
          p_amount: number
          p_body_snapshot: string
          p_client_name: string
          p_expires_at: string
          p_project_id: string
          p_subject: string
          p_title: string
          p_to_email: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: string
      }
      natori_issue_quote_v1: {
        Args: {
          p_amount: number
          p_body_snapshot: string
          p_client_name: string
          p_expires_at: string
          p_idempotency_key: string
          p_pricing_snapshot: Json
          p_project_id: string
          p_request_snapshot: Json
          p_subject: string
          p_title: string
          p_to_email: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: {
          quote_id: string
          reused: boolean
          version: number
        }[]
      }
      natori_jsonb_has_exact_keys_v1: {
        Args: { p_keys: string[]; p_value: Json }
        Returns: boolean
      }
      natori_project_task_template_v1: {
        Args: { p_type: string }
        Returns: {
          done: boolean
          estimated_hours: number
          label: string
          sort_order: number
          stage: string
          task_key: string
        }[]
      }
      natori_record_stripe_payment: {
        Args: {
          p_amount: number
          p_project_id: string
          p_quote_id: string
          p_session_id: string
        }
        Returns: {
          advanced: boolean
          new_event: boolean
          recorded_amount: number
          result: string
        }[]
      }
      natori_request_data_is_valid_v1: {
        Args: { p_request_data: Json }
        Returns: boolean
      }
      natori_request_text_is_valid_v1: {
        Args: { p_max_length: number; p_min_length: number; p_value: string }
        Returns: boolean
      }
      natori_update_task_and_status: {
        Args: {
          p_done: boolean
          p_next_action: string
          p_project_id: string
          p_status: string
          p_task_key: string
          p_user_id: string
        }
        Returns: boolean
      }
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

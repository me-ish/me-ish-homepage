export type NatoriRefundLedgerRow = {
  id: string; owner_id: string; account_scope: string; livemode: boolean; refund_id: string;
  transaction_id: string | null; project_id: string | null; claimed_project_id: string | null;
  payment_intent_id: string | null; charge_id: string | null; amount: number | null; currency: string | null;
  provider_status: string; confirmed_at: string | null; source: string; resolution: string; review_reason: string | null;
  first_event_id: string; latest_event_id: string; provider_event_created: number; created_at: string; updated_at: string;
}

export type NatoriStripeInboxRow = {
  event_id: string; account_scope: string; livemode: boolean; event_type: string; request: Json;
  owner_id: string; project_id: string | null; status: string; claim_token: string | null; claim_generation: number;
  lease_until: string | null; processed_at: string | null; result: string | null; error_code: string | null;
  notification_ids: string[]; created_at: string; updated_at: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Phase N additive schema; existing generated table/function definitions remain unchanged.
export type NatoriNotificationRow = {
  id: string
  notification_key: string
  attempt_no: number
  project_id: string
  quote_id: string | null
  purpose: string
  snapshot: Json
  payload: Json | null
  status: string
  claim_token: string | null
  lease_expires_at: string | null
  claim_count: number
  send_started_at: string | null
  retry_after: string | null
  provider_id: string | null
  sent_at: string | null
  error_code: string | null
  created_at: string
  updated_at: string
}

export type NatoriDeliveryReleaseRow = {
  id: string; project_id: string; revision: number; manifest: Json; snapshot: Json;
  published_at: string; expires_at: string; accepted_at: string | null; legacy: boolean;
}
export type NatoriDeliveryAccessRow = {
  token_hash: string; release_id: string; expires_at: string; created_at: string;
}
export type NatoriDeliveryOperationRow = {
  project_id: string; operation_id: string; request_hash: string; release_id: string;
  notification_id: string; created_at: string;
}

export type NatoriIntakeOperationRpcRow = {
  result: string; replay_result: Json | null; project_id: string | null;
  reference_paths: Json | null; notification_ids: string[];
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      natori_consultation_operations: {Row:{project_id:string;sender:string;operation_id:string;request_hash:string;body:string;manifest:Json;status:string;claim_token:string|null;lease_expires_at:string|null;signed_expires_at:string|null;message_id:string|null;notification_id:string|null;notice_payload:Json|null;access_hash:string|null;access_expires_at:string|null;created_at:string};Insert:{project_id:string;sender:string;operation_id:string;request_hash:string;body:string;manifest:Json;status:string;claim_token?:string|null;lease_expires_at?:string|null;signed_expires_at?:string|null;message_id?:string|null;notification_id?:string|null;notice_payload?:Json|null;access_hash?:string|null;access_expires_at?:string|null;created_at?:string};Update:{status?:string;claim_token?:string|null;lease_expires_at?:string|null;signed_expires_at?:string|null;message_id?:string|null;notification_id?:string|null};Relationships:[]}
      natori_intake_operations: {
        Row: {
          owner_id: string; operation_id: string; request_hash: string; project_id: string;
          manifest: Json; reference_paths: Json; status: string; claim_token: string | null;
          lease_expires_at: string | null; replay_result: Json | null; notification_ids: string[];
          created_at: string; updated_at: string;
        }
        Insert: {
          owner_id: string; operation_id: string; request_hash: string; project_id?: string;
          manifest: Json; reference_paths: Json; status?: string; claim_token?: string | null;
          lease_expires_at?: string | null; replay_result?: Json | null; notification_ids?: string[];
          created_at?: string; updated_at?: string;
        }
        Update: {
          status?: string; claim_token?: string | null; lease_expires_at?: string | null;
          replay_result?: Json | null; notification_ids?: string[]; updated_at?: string;
        }
        Relationships: []
      }
      natori_delivery_releases: {
        Row: NatoriDeliveryReleaseRow
        Insert: Pick<NatoriDeliveryReleaseRow, "project_id" | "manifest" | "snapshot" | "expires_at"> & Partial<NatoriDeliveryReleaseRow>
        Update: Partial<NatoriDeliveryReleaseRow>
        Relationships: []
      }
      natori_delivery_access: {
        Row: NatoriDeliveryAccessRow
        Insert: Pick<NatoriDeliveryAccessRow, "token_hash" | "release_id" | "expires_at"> & Partial<NatoriDeliveryAccessRow>
        Update: Partial<NatoriDeliveryAccessRow>
        Relationships: []
      }
      natori_delivery_operations: {
        Row: NatoriDeliveryOperationRow
        Insert: Omit<NatoriDeliveryOperationRow, "created_at"> & Partial<NatoriDeliveryOperationRow>
        Update: Partial<NatoriDeliveryOperationRow>
        Relationships: []
      }
      natori_notification_jobs: {
        Row: NatoriNotificationRow
        Insert: Pick<NatoriNotificationRow, "notification_key" | "project_id" | "purpose" | "snapshot"> & Partial<NatoriNotificationRow>
        Update: Partial<NatoriNotificationRow>
        Relationships: [
          { foreignKeyName: "natori_notification_jobs_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "natori_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "natori_notification_jobs_quote_id_fkey"; columns: ["quote_id"]; isOneToOne: false; referencedRelation: "natori_quotes"; referencedColumns: ["id"] }
        ]
      }
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
      natori_delivery_files: {
        Row: {
          state: string
          content_type: string | null
          storage_version: string | null
          verified_at: string | null
          deleted_at: string | null
          created_at: string
          file_name: string
          folder: string
          id: string
          project_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          state?: string
          content_type?: string | null
          storage_version?: string | null
          verified_at?: string | null
          deleted_at?: string | null
          created_at?: string
          file_name: string
          folder: string
          id?: string
          project_id: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          state?: string
          content_type?: string | null
          storage_version?: string | null
          verified_at?: string | null
          deleted_at?: string | null
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
      natori_stripe_event_inbox: {
        Row: NatoriStripeInboxRow
        Insert: Partial<NatoriStripeInboxRow> & Pick<NatoriStripeInboxRow, "event_id" | "account_scope" | "livemode" | "event_type" | "request" | "owner_id">
        Update: Partial<NatoriStripeInboxRow>
        Relationships: []
      }
      natori_refund_ledger: {
        Row: NatoriRefundLedgerRow
        Insert: Partial<NatoriRefundLedgerRow> & Pick<NatoriRefundLedgerRow, "owner_id" | "account_scope" | "livemode" | "refund_id" | "provider_status" | "first_event_id" | "latest_event_id" | "provider_event_created">
        Update: Partial<NatoriRefundLedgerRow>
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
          stripe_account_scope: string | null
          stripe_livemode: boolean | null
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          stripe_currency: string | null
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
          stripe_account_scope?: string | null
          stripe_livemode?: boolean | null
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_currency?: string | null
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
          stripe_account_scope?: string | null
          stripe_livemode?: boolean | null
          stripe_payment_intent_id?: string | null
          stripe_charge_id?: string | null
          stripe_currency?: string | null
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
      natori_consultation_access: {
        Row: { id: string; project_id: string; token_hash: string; expires_at: string; created_at: string; renewed_at: string | null }
        Insert: { id?: string; project_id: string; token_hash: string; expires_at: string; created_at?: string; renewed_at?: string | null }
        Update: { id?: string; project_id?: string; token_hash?: string; expires_at?: string; created_at?: string; renewed_at?: string | null }
        Relationships: [{ foreignKeyName: "natori_consultation_access_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "natori_projects"; referencedColumns: ["id"] }]
      }
      natori_consultation_files: {
        Row: { id: string; project_id: string; message_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at: string }
        Insert: { id?: string; project_id: string; message_id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at?: string }
        Update: { id?: string; project_id?: string; message_id?: string; storage_path?: string; file_name?: string; mime_type?: string; size_bytes?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: "natori_consultation_files_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "natori_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "natori_consultation_files_message_id_fkey"; columns: ["message_id"]; isOneToOne: false; referencedRelation: "natori_consultation_messages"; referencedColumns: ["id"] }
        ]
      }
      natori_consultation_messages: {
        Row: { id: string; project_id: string; sender: string; body: string; notification_status: string; created_at: string; operation_id: string | null; request_hash: string | null; attachment_count: number | null; notification_id: string | null }
        Insert: { id?: string; project_id: string; sender: string; body: string; notification_status?: string; created_at?: string; operation_id?: string | null; request_hash?: string | null; attachment_count?: number | null; notification_id?: string | null }
        Update: { id?: string; project_id?: string; sender?: string; body?: string; notification_status?: string; created_at?: string; operation_id?: string | null; request_hash?: string | null; attachment_count?: number | null; notification_id?: string | null }
        Relationships: [{ foreignKeyName: "natori_consultation_messages_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "natori_projects"; referencedColumns: ["id"] }]
      }
      natori_consultation_uploads: {
        Row: { id: string; project_id: string; sender: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; finalized_at: string | null; operation_id: string | null; file_id: string | null; content_sha256: string | null; message_id: string | null; credential_issuer: string | null; credential_started_at: string | null; credential_expires_at: string | null }
        Insert: { id?: string; project_id: string; sender: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; created_at?: string; finalized_at?: string | null; operation_id?: string | null; file_id?: string | null; content_sha256?: string | null; message_id?: string | null; credential_issuer?: string | null; credential_started_at?: string | null; credential_expires_at?: string | null }
        Update: { id?: string; project_id?: string; sender?: string; storage_path?: string; file_name?: string; mime_type?: string; size_bytes?: number; created_at?: string; finalized_at?: string | null; operation_id?: string | null; file_id?: string | null; content_sha256?: string | null; message_id?: string | null; credential_issuer?: string | null; credential_started_at?: string | null; credential_expires_at?: string | null }
        Relationships: [{ foreignKeyName: "natori_consultation_uploads_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "natori_projects"; referencedColumns: ["id"] }]
      }
      natori_quote_access: {
        Row: { token_hash: string; quote_id: string; expires_at: string; created_at: string }
        Insert: { token_hash: string; quote_id: string; expires_at: string; created_at?: string }
        Update: never
        Relationships: []
      }
      natori_estimate_drafts: {
        Row: { project_id: string; user_id: string; agreed_terms: Json; items: Json; mail_draft: Json | null; revision: number; updated_at: string }
        Insert: { project_id: string; user_id: string; agreed_terms: Json; items: Json; mail_draft?: Json | null; revision?: number; updated_at?: string }
        Update: { project_id?: string; user_id?: string; agreed_terms?: Json; items?: Json; mail_draft?: Json | null; revision?: number; updated_at?: string }
        Relationships: [{ foreignKeyName: "natori_estimate_drafts_project_id_fkey"; columns: ["project_id"]; isOneToOne: true; referencedRelation: "natori_projects"; referencedColumns: ["id"] }]
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
          mutation_revision: number
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
          mutation_revision?: number
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
          mutation_revision?: number
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
          quote_terms: Json | null
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
          quote_terms?: Json | null
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
          quote_terms?: Json | null
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
      natori_consultation_operation_v1: {Args:{p_project_id:string;p_sender:string;p_operation_id:string;p_request_hash:string;p_command:string;p_owner_id?:string|null;p_access_hash?:string|null;p_input?:Json;p_claim_token?:string|null};Returns:Json}
      natori_consultation_legacy_notice_v1: {Args:{p_owner_id:string;p_project_id:string;p_message_id:string;p_payload:Json;p_access_hash:string|null;p_expires_at:string|null};Returns:string|null}
      natori_intake_lookup_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string }; Returns: NatoriIntakeOperationRpcRow[] }
      natori_intake_settle_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string }; Returns: NatoriIntakeOperationRpcRow[] }
      natori_intake_begin_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string; p_manifest: Json; p_file_ids: Json; p_claim_token: string; p_mass_production: boolean }; Returns: NatoriIntakeOperationRpcRow[] }
      natori_intake_touch_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string; p_claim_token: string }; Returns: boolean }
      natori_intake_finish_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string; p_claim_token: string; p_client_name: string; p_client_email: string; p_request_data: Json; p_reference_links: Json; p_mass_production: boolean }; Returns: NatoriIntakeOperationRpcRow[] }
      natori_intake_fail_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string; p_claim_token: string }; Returns: boolean }
      natori_intake_review_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string; p_claim_token: string }; Returns: boolean }
      natori_intake_cleanup_scope_v1: { Args: { p_owner_id: string; p_operation_id: string; p_request_hash: string }; Returns: Json }
      natori_intake_admitted_v1: { Args: { p_mass_production: boolean }; Returns: boolean }
      natori_quote_payment_state_v1: { Args: { p_owner_id: string; p_project_id: string }; Returns: Json }
      natori_payment_attention_v1: { Args: { p_owner_id: string }; Returns: Json }
      natori_payment_attention_v2: { Args: { p_owner_id: string }; Returns: Json }
      natori_payment_links_v1: {
        Args: { p_owner_id: string; p_project_id: string | null; p_command: string; p_input?: Json }
        Returns: Json
      }
      natori_stripe_event_claim_v1: {
        Args: { p_owner_id: string; p_account: string; p_live: boolean; p_event_id: string; p_type: string; p_request: Json; p_claim_token: string }
        Returns: { result: string; generation: number; notification_ids: string[] }[]
      }
      natori_stripe_event_complete_v1: {
        Args: { p_owner_id: string; p_account: string; p_live: boolean; p_event_id: string; p_claim_token: string; p_generation: number }
        Returns: { result: string; notification_ids: string[] }[]
      }
      natori_stripe_event_complete_v2: {
        Args: { p_owner_id: string; p_account: string; p_live: boolean; p_event_id: string; p_claim_token: string; p_generation: number }
        Returns: { result: string; notification_ids: string[] }[]
      }
      natori_refund_reconcile_v1: {
        Args: { p_owner_id: string; p_account: string; p_live: boolean; p_refund_id: string }
        Returns: string[]
      }
      natori_refund_summaries_v1: {
        Args: { p_owner_id: string; p_project_ids: string[] }
        Returns: { project_id: string; summary: Json }[]
      }
      natori_delivery_purge_payloads_v1: { Args: { p_owner_id: string }; Returns: number }
      natori_delivery_reserve_v1: {
        Args: { p_owner_id: string; p_project_id: string; p_file_id: string; p_folder: string; p_path: string; p_file_name: string; p_size_bytes: number; p_content_type: string }
        Returns: { result: string; file_id: string | null; storage_path: string | null }[]
      }
      natori_delivery_finalize_v1: {
        Args: { p_owner_id: string; p_file_id: string; p_size_bytes: number; p_content_type: string; p_storage_version: string; p_verified_at: string }
        Returns: string
      }
      natori_delivery_delete_v1: {
        Args: { p_owner_id: string; p_file_id: string; p_finish?: boolean }
        Returns: string
      }
      natori_delivery_issue_v1: {
        Args: { p_owner_id: string; p_project_id: string; p_operation_id: string; p_to_email: string; p_request_hash: string; p_manifest: Json; p_verified_at: string; p_token_hash: string; p_expires_at: string; p_payload: Json }
        Returns: { result: string; release_id: string | null; notification_id: string | null }[]
      }
      natori_accept_delivery_ready_v1: {
        Args: { p_token_hash: string; p_release_id: string; p_manifest: Json; p_verified_at: string }
        Returns: { result: string; project_id: string; project_title: string; client_name: string; accepted_at: string | null; notification_ids: string[] }[]
      }
      natori_consultation_overview_v1: {
        Args: { p_owner_id: string; p_project_ids: string[] }
        Returns: { project_id: string; latest_message_id: string | null; latest_sender: string | null; latest_message_at: string | null; notification_failed: number; notification_pending: number }[]
      }
      natori_notification_list_v1: {
        Args: { p_owner_id: string; p_offset?: number }
        Returns: { id: string; project_id: string; project_title: string; purpose: string; status: string; attempt_no: number; claim_count: number; lease_expires_at: string | null; send_started_at: string | null; retry_after: string | null; last_sent_at: string | null }[]
      }
      natori_accept_quote_with_notifications_v1: {
        Args: { p_token_hash: string }
        Returns: { result: string; quote_id: string; project_id: string; accepted_at: string | null; notification_ids: string[] }[]
      }
      natori_accept_delivery_with_notifications_v1: {
        Args: { p_token_hash: string }
        Returns: { result: string; project_id: string; project_title: string; client_name: string; accepted_at: string | null; notification_ids: string[] }[]
      }
      natori_notification_claim_v1: {
        Args: { p_id: string; p_claim_token: string; p_manual?: boolean }
        Returns: NatoriNotificationRow[]
      }
      natori_notification_start_v1: {
        Args: { p_id: string; p_claim_token: string; p_payload: Json }
        Returns: NatoriNotificationRow[]
      }
      natori_notification_finish_v1: {
        Args: { p_id: string; p_claim_token: string; p_status: string; p_provider_id?: string; p_error_code?: string }
        Returns: boolean
      }
      natori_notification_retry_v1: {
        Args: { p_id: string; p_owner_id: string }
        Returns: string
      }
      natori_finalize_consultation_file: {
        Args: { p_project_id: string; p_sender: string; p_storage_path: string; p_file_name: string; p_mime_type: string; p_size_bytes: number }
        Returns: string
      }
      admin_mark_sales_paid: {
        Args: { p_batch_id?: string; p_user_id: string }
        Returns: {
          total_amount: number
          updated_count: number
        }[]
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
      natori_issue_quote_with_terms: {
        Args: {
          p_amount: number
          p_body_snapshot: string
          p_client_name: string
          p_expected_due_date: string
          p_expires_at: string
          p_project_id: string
          p_quote_terms: Json
          p_subject: string
          p_title: string
          p_to_email: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: string
      }
      natori_save_estimate_draft_v1: {
        Args: { p_owner_id: string; p_project_id: string; p_revision: number; p_draft: Json }
        Returns: { result: string; revision: number }[]
      }
      natori_renotify_quote_v1: {
        Args: { p_owner_id: string; p_quote_id: string; p_operation_id: string; p_request: Json; p_token_hash: string; p_expires_at: string; p_payload: Json }
        Returns: { notification_id: string }[]
      }
      natori_issue_quote_with_notification_v1: {
        Args: { p_owner_id: string; p_input: Json; p_payload: Json }
        Returns: { quote_id: string; version: number; reused: boolean; notification_id: string }[]
      }
      natori_quote_issue_recovery_v1: {
        Args: { p_owner_id: string; p_project_id: string; p_operation_id?: string }
        Returns: { quote_id: string; version: number; notification_id: string | null; notification_status: string }[]
      }
      natori_issue_quote_from_draft_v1: {
        Args: {
          p_user_id: string; p_project_id: string; p_title: string; p_client_name: string
          p_to_email: string; p_amount: number; p_subject: string; p_body_snapshot: string
          p_token_hash: string; p_expires_at: string; p_request_snapshot: Json
          p_pricing_snapshot: Json; p_idempotency_key: string; p_expected_revision: number
        }
        Returns: { quote_id: string; version: number; reused: boolean }[]
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
      natori_update_task_v1: {
        Args: {p_owner:string;p_project:string;p_task_key:string;p_done:boolean}
        Returns: Json
      }
      natori_project_task_snapshot_v1: {
        Args: {p_owner:string;p_project_ids?:string[]}
        Returns: Json
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

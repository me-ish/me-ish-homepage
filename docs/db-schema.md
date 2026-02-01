# Supabase Schema (public)

Source: Supabase SQL metadata export provided in this thread (tables/columns/constraints/indexes/RLS).

## Tables
- admin_emails
- announcements
- artists_bank_accounts
- aura_first20_redemptions
- aura_meish_free_claims
- aura_promo_counters
- aura_requests
- cert_links
- entries
- entry_processing_jobs
- entry_view_events
- inquiries
- likes
- payout_items
- payouts
- portfolio_settings
- profiles
- sales
- special_thanks

## Views (seen in column list)
- announcements_public
- aura_first20_stats
- entry_view_stats
- v_cert_links_active
- v_my_sales_summary
- v_pending_payouts
- v_public_portfolio_entries

---

# Full Columns By Table

## admin_emails
- email | USER-DEFINED | nullable: NO | default: null

## announcements
- id | uuid | nullable: NO | default: gen_random_uuid()
- title | text | nullable: NO | default: null
- body_md | text | nullable: NO | default: null
- category | text | nullable: NO | default: 'info'::text
- link_url | text | nullable: YES | default: null
- pinned | boolean | nullable: NO | default: false
- published_at | timestamp with time zone | nullable: NO | default: now()
- expires_at | timestamp with time zone | nullable: YES | default: null
- created_by | uuid | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- updated_at | timestamp with time zone | nullable: NO | default: now()

## announcements_public (view)
- id | uuid | nullable: YES | default: null
- title | text | nullable: YES | default: null
- body_md | text | nullable: YES | default: null
- category | text | nullable: YES | default: null
- link_url | text | nullable: YES | default: null
- pinned | boolean | nullable: YES | default: null
- published_at | timestamp with time zone | nullable: YES | default: null

## artists_bank_accounts
- id | bigint | nullable: NO | default: nextval('artists_bank_accounts_id_seq'::regclass)
- external_user_id | text | nullable: NO | default: null
- bank_code | text | nullable: NO | default: null
- branch_code | text | nullable: NO | default: null
- account_type | text | nullable: NO | default: null
- account_number | text | nullable: NO | default: null
- account_name_kana | text | nullable: NO | default: null
- updated_at | timestamp with time zone | nullable: NO | default: now()

## aura_first20_redemptions
- email | text | nullable: NO | default: null
- used_at | timestamp with time zone | nullable: NO | default: now()
- request_id | uuid | nullable: YES | default: null
- converted_to_meish_at | timestamp with time zone | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()

## aura_first20_stats (view)
- key | text | nullable: YES | default: null
- limit_count | integer | nullable: YES | default: null
- used_count | integer | nullable: YES | default: null
- remaining | integer | nullable: YES | default: null

## aura_meish_free_claims
- email | text | nullable: NO | default: null
- used_at | timestamp with time zone | nullable: NO | default: now()
- request_id | uuid | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- entry_id | bigint | nullable: YES | default: null

## aura_promo_counters
- key | text | nullable: NO | default: null
- limit_count | integer | nullable: NO | default: null

## aura_requests
- id | uuid | nullable: NO | default: gen_random_uuid()
- created_at | timestamp with time zone | nullable: NO | default: now()
- updated_at | timestamp with time zone | nullable: NO | default: now()
- status | text | nullable: NO | default: 'draft'::text
- error | text | nullable: YES | default: null
- payload | jsonb | nullable: YES | default: null
- design | jsonb | nullable: YES | default: null
- content | jsonb | nullable: YES | default: null
- email | text | nullable: YES | default: null
- slug | text | nullable: YES | default: null
- public_id | text | nullable: YES | default: null
- visibility | text | nullable: NO | default: 'private'::text
- published_at | timestamp with time zone | nullable: YES | default: null
- public_slug | text | nullable: YES | default: null
- payment_status | text | nullable: NO | default: 'unpaid'::text
- paid_at | timestamp with time zone | nullable: YES | default: null
- renderer_version | text | nullable: NO | default: '1.0.0'::text
- session_token | uuid | nullable: YES | default: null

## cert_links
- id | uuid | nullable: NO | default: gen_random_uuid()
- entry_id | integer | nullable: NO | default: null
- token_hash | text | nullable: NO | default: null
- expires_at | timestamp with time zone | nullable: YES | default: null
- revoked | boolean | nullable: NO | default: false
- used_at | timestamp with time zone | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- updated_at | timestamp with time zone | nullable: NO | default: now()

## entries
- id | bigint | nullable: NO | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- artist_name | text | nullable: YES | default: null
- email | text | nullable: YES | default: null
- sns_links | text | nullable: NO | default: null
- title | text | nullable: YES | default: null
- description | text | nullable: NO | default: null
- is_for_sale | boolean | nullable: NO | default: false
- sale_type | text | nullable: NO | default: null
- price | numeric | nullable: YES | default: null
- image_url | text | nullable: NO | default: null
- gallery_type | text | nullable: YES | default: null
- confirmed | boolean | nullable: YES | default: null
- file_name | text | nullable: YES | default: null
- user_id | uuid | nullable: YES | default: null
- display_plan | text | nullable: YES | default: null
- type | text | nullable: YES | default: null
- is_sold | boolean | nullable: YES | default: false
- meish_fee_yen | numeric | nullable: YES | default: null
- artist_reward_yen | numeric | nullable: YES | default: null
- is_paid_to_artist | boolean | nullable: YES | default: null
- paid_at | timestamp with time zone | nullable: YES | default: null
- likes | integer | nullable: NO | default: 0
- external_user_id | uuid | nullable: YES | default: null
- edition_total | integer | nullable: YES | default: null
- edition_sold | integer | nullable: NO | default: 0
- display_ready | boolean | nullable: YES | default: false
- confirmed_at | timestamp with time zone | nullable: YES | default: null
- display_start_at | timestamp with time zone | nullable: YES | default: null
- display_end_at | timestamp with time zone | nullable: YES | default: null
- edition_remaining | integer | nullable: YES | default: null
- sold_out_calc | boolean | nullable: YES | default: null
- rejected_at | timestamp with time zone | nullable: YES | default: null
- reject_reason | text | nullable: YES | default: null
- reject_email_sent_at | timestamp with time zone | nullable: YES | default: null
- token_id | numeric | nullable: YES | default: null
- has_signature | boolean | nullable: YES | default: null
- force_wm | boolean | nullable: NO | default: false
- edition_mode | text | nullable: YES | default: null
- ai_usage | text | nullable: YES | default: null
- ai_usage_scope | ARRAY | nullable: YES | default: null
- ai_usage_note | text | nullable: YES | default: null
- agree_promotion | boolean | nullable: NO | default: false
- agree_storage | boolean | nullable: NO | default: false
- portfolio_hidden | boolean | nullable: NO | default: false
- ending_soon_notified_at | timestamp with time zone | nullable: YES | default: null

## entry_processing_jobs
- id | uuid | nullable: NO | default: gen_random_uuid()
- entry_id | bigint | nullable: NO | default: null
- status | text | nullable: NO | default: 'queued'::text
- attempts | integer | nullable: NO | default: 0
- locked_at | timestamp with time zone | nullable: YES | default: null
- locked_by | text | nullable: YES | default: null
- last_error | text | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- updated_at | timestamp with time zone | nullable: NO | default: now()

## entry_view_events
- id | uuid | nullable: NO | default: gen_random_uuid()
- entry_id | bigint | nullable: NO | default: null
- viewer_user_id | uuid | nullable: YES | default: null
- session_id | text | nullable: YES | default: null
- occurred_at | timestamp with time zone | nullable: NO | default: now()

## entry_view_stats (view)
- entry_id | bigint | nullable: YES | default: null
- view_count | bigint | nullable: YES | default: null
- unique_views | bigint | nullable: YES | default: null
- last_viewed_at | timestamp with time zone | nullable: YES | default: null

## inquiries
- id | uuid | nullable: NO | default: uuid_generate_v4()
- name | text | nullable: NO | default: null
- email | text | nullable: NO | default: null
- message | text | nullable: NO | default: null
- created_at | timestamp with time zone | nullable: YES | default: timezone('utc'::text, now())
- is_read | boolean | nullable: YES | default: false

## likes
- id | uuid | nullable: NO | default: gen_random_uuid()
- user_id | uuid | nullable: NO | default: null
- entry_id | bigint | nullable: NO | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()

## payout_items
- id | uuid | nullable: NO | default: gen_random_uuid()
- payout_id | uuid | nullable: NO | default: null
- sale_id | uuid | nullable: NO | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()

## payouts
- id | uuid | nullable: NO | default: gen_random_uuid()
- user_id | uuid | nullable: NO | default: null
- period_ym | text | nullable: NO | default: null
- amount_yen | numeric | nullable: NO | default: 0
- status | USER-DEFINED | nullable: NO | default: 'pending'::payout_status
- scheduled_at | timestamp with time zone | nullable: YES | default: null
- paid_at | timestamp with time zone | nullable: YES | default: null
- note | text | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: NO | default: now()
- updated_at | timestamp with time zone | nullable: NO | default: now()

## portfolio_settings
- user_id | uuid | nullable: NO | default: null
- is_public | boolean | nullable: NO | default: true
- public_display_name | text | nullable: YES | default: null
- headline | text | nullable: YES | default: null
- bio_short | text | nullable: YES | default: null
- contact_email | text | nullable: YES | default: null
- contact_url | text | nullable: YES | default: null
- works_filter | text | nullable: NO | default: 'displaying'::text
- sort_key | text | nullable: NO | default: 'new'::text
- updated_at | timestamp with time zone | nullable: NO | default: now()
- created_at | timestamp with time zone | nullable: NO | default: now()

## profiles
- id | uuid | nullable: NO | default: gen_random_uuid()
- display_name | text | nullable: NO | default: ''''''::text
- sns_links | jsonb | nullable: YES | default: '{}'::jsonb
- created_at | timestamp without time zone | nullable: YES | default: now()
- updated_at | timestamp without time zone | nullable: YES | default: null
- bio | text | nullable: YES | default: null
- avatar_url | text | nullable: YES | default: null
- banner_url | text | nullable: YES | default: null
- banner_focus_x | real | nullable: NO | default: 50
- banner_focus_y | real | nullable: NO | default: 50
- banner_zoom | real | nullable: NO | default: 1.0

## sales
- id | uuid | nullable: NO | default: gen_random_uuid()
- entry_id | bigint | nullable: NO | default: null
- price | integer | nullable: YES | default: null
- buyer_email | text | nullable: YES | default: null
- stripe_session_id | text | nullable: NO | default: null
- purchased_at | timestamp with time zone | nullable: YES | default: now()
- metadata | jsonb | nullable: YES | default: null
- meish_fee_yen | numeric | nullable: YES | default: null
- artist_reward_yen | numeric | nullable: YES | default: null
- payout_status | USER-DEFINED | nullable: NO | default: 'pending'::payout_status
- payout_batch_id | uuid | nullable: YES | default: null
- paid_at | timestamp with time zone | nullable: YES | default: null

## special_thanks
- id | uuid | nullable: NO | default: gen_random_uuid()
- display_name | text | nullable: NO | default: null
- avatar_url | text | nullable: YES | default: null
- tagline | text | nullable: YES | default: null
- homepage_url | text | nullable: YES | default: null
- twitter_url | text | nullable: YES | default: null
- instagram_url | text | nullable: YES | default: null
- is_public | boolean | nullable: NO | default: true
- sort_order | integer | nullable: YES | default: null

## v_cert_links_active (view)
- id | uuid | nullable: YES | default: null
- entry_id | integer | nullable: YES | default: null
- token_hash | text | nullable: YES | default: null
- expires_at | timestamp with time zone | nullable: YES | default: null
- revoked | boolean | nullable: YES | default: null
- used_at | timestamp with time zone | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: YES | default: null
- updated_at | timestamp with time zone | nullable: YES | default: null

## v_my_sales_summary (view)
- user_id | uuid | nullable: YES | default: null
- gross_sales_yen | bigint | nullable: YES | default: null
- pending_payout_yen | bigint | nullable: YES | default: null
- paid_out_yen | bigint | nullable: YES | default: null

## v_pending_payouts (view)
- user_id | uuid | nullable: YES | default: null
- display_name | text | nullable: YES | default: null
- avatar_url | text | nullable: YES | default: null
- pending_count | integer | nullable: YES | default: null
- pending_amount | bigint | nullable: YES | default: null
- oldest_purchase_at | timestamp with time zone | nullable: YES | default: null
- latest_purchase_at | timestamp with time zone | nullable: YES | default: null

## v_public_portfolio_entries (view)
- id | bigint | nullable: YES | default: null
- user_id | uuid | nullable: YES | default: null
- created_at | timestamp with time zone | nullable: YES | default: null
- title | text | nullable: YES | default: null
- description | text | nullable: YES | default: null
- image_url | text | nullable: YES | default: null
- gallery_type | text | nullable: YES | default: null
- likes | integer | nullable: YES | default: null
- is_for_sale | boolean | nullable: YES | default: null
- sale_type | text | nullable: YES | default: null
- price | numeric | nullable: YES | default: null
- is_sold | boolean | nullable: YES | default: null
- edition_total | integer | nullable: YES | default: null
- edition_sold | integer | nullable: YES | default: null
- edition_remaining | integer | nullable: YES | default: null
- sold_out_calc | boolean | nullable: YES | default: null
- display_ready | boolean | nullable: YES | default: null
- display_start_at | timestamp with time zone | nullable: YES | default: null
- display_end_at | timestamp with time zone | nullable: YES | default: null

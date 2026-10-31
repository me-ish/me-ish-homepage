# Supabaseテーブル説明（public, 自動生成）

- 生成元: `src/types/supabase.ts`
- 生成日時: `2026-10-31T00:15:09.161Z`
- 型定義に載っているテーブルだけを並べています。DBにある全テーブルと最新の定義は `supabase/migrations/` を参照してください。
- 作り直し: `npm run docs:supabase`

## 一覧

| テーブル | 役割 | カラム数 |
|---|---|---:|
| `natori_case_acceptance_runs` | ナトリ: 受け入れ確認の実行設定（送信先・期間・メール上限） | 17 |
| `natori_intake_operations` | ナトリ: 依頼受付の処理記録（二重送信の防止・再実行） | 13 |
| `natori_delivery_releases` | ナトリ: 納品ページに出す内容（公開版） | 9 |
| `natori_delivery_access` | ナトリ: 納品ページのアクセス鍵 | 4 |
| `natori_delivery_operations` | ナトリ: 納品の送信操作（二重送信の防止） | 6 |
| `natori_delivery_extensions` | ナトリ: 納品ページの公開期限の延長記録 | 9 |
| `natori_notification_jobs` | ナトリ: 通知メールの送信待ち・送信結果 | 19 |
| `admin_audit_log` | 管理操作の記録 | 7 |
| `admin_emails` | 管理者メールの許可リスト | 1 |
| `announcements` | サイトのお知らせ管理 | 11 |
| `artists_bank_accounts` | 作家の振込先口座情報 | 8 |
| `cert_links` | 証明書ダウンロードリンク管理 | 8 |
| `entries` | 作品エントリー本体（審査・展示・販売・精算） | 57 |
| `entry_processing_jobs` | 作品処理の非同期ジョブ管理 | 9 |
| `inquiries` | 問い合わせ管理 | 6 |
| `natori_delivery_files` | ナトリ: 納品ファイル | 12 |
| `natori_events` | ナトリ: 予定 | 7 |
| `natori_inquiry_reference_files` | ナトリ: 依頼時の参考ファイル | 4 |
| `natori_links_content` | ナトリ: リンク集ページの内容 | 3 |
| `natori_order_mail_logs` | ナトリ: 見積・支払いなどの送信メール記録 | 15 |
| `natori_page_events` | ナトリ: 公開ページの閲覧・クリック記録 | 5 |
| `natori_stripe_event_inbox` | ナトリ: Stripeからの通知の受け箱（処理待ち・処理済み） | 17 |
| `natori_refund_ledger` | ナトリ: 返金の記録 | 22 |
| `natori_payment_transactions` | ナトリ: 支払いの記録 | 13 |
| `natori_portfolio_content` | ナトリ: ポートフォリオページの内容 | 4 |
| `natori_portfolio_assets` | ナトリ: ポートフォリオのアップロード素材 | 7 |
| `natori_pricing_configs` | ナトリ: 料金表の設定 | 9 |
| `natori_consultation_access` | ナトリ: 相談ページ（トーク）のアクセス鍵 | 6 |
| `natori_consultation_files` | ナトリ: トークの添付ファイル | 8 |
| `natori_consultation_messages` | ナトリ: トークのメッセージ | 10 |
| `natori_consultation_uploads` | ナトリ: トークへのアップロード（確定前を含む） | 16 |
| `natori_quote_access` | ナトリ: 見積ページのアクセス鍵 | 4 |
| `natori_estimate_drafts` | ナトリ: 見積の下書き | 7 |
| `natori_project_activity` | ナトリ: 案件の出来事の記録 | 10 |
| `natori_project_reference_links` | ナトリ: 案件の参考リンク | 9 |
| `natori_project_tasks` | ナトリ: 案件の制作工程 | 8 |
| `natori_projects` | ナトリ: 案件本体（依頼〜納品） | 38 |
| `natori_quotes` | ナトリ: 見積 | 20 |
| `natori_user_profiles` | ナトリ: 作家プロフィール（1日の作業時間など） | 8 |
| `payout_batches` | 支払バッチ（月次締め） | 9 |
| `payout_items` | 支払バッチ内の明細紐付け | 4 |
| `payouts` | 作家ごとの支払管理 | 10 |
| `processed_stripe_events` | Stripe Webhookの処理済みイベント（二重処理の防止） | 2 |
| `profiles` | ユーザープロフィール | 11 |
| `sales` | 購入・売上トランザクション | 13 |

## natori_case_acceptance_runs

- 役割: ナトリ: 受け入れ確認の実行設定（送信先・期間・メール上限）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `owner_id` | `string` | NO | owner_id（natori_case_acceptance_runs） |
| `project_ref` | `string` | NO | project_ref（natori_case_acceptance_runs） |
| `origin` | `string` | NO | origin（natori_case_acceptance_runs） |
| `provider_scope` | `string` | NO | provider_scope（natori_case_acceptance_runs） |
| `stripe_account` | `string` | NO | stripe_account（natori_case_acceptance_runs） |
| `starts_at` | `string` | NO | starts_at（natori_case_acceptance_runs） |
| `ends_at` | `string` | NO | ends_at（natori_case_acceptance_runs） |
| `enabled` | `boolean` | NO | enabled（natori_case_acceptance_runs） |
| `allowed_to` | `string[]` | NO | allowed_to（natori_case_acceptance_runs） |
| `human_to` | `string[]` | NO | human_to（natori_case_acceptance_runs） |
| `sender` | `string` | NO | sender（natori_case_acceptance_runs） |
| `reply_to` | `string` | NO | reply_to（natori_case_acceptance_runs） |
| `mail_limit` | `number` | NO | mail_limit（natori_case_acceptance_runs） |
| `human_limit` | `number` | NO | human_limit（natori_case_acceptance_runs） |
| `used` | `number` | NO | used（natori_case_acceptance_runs） |
| `human_used` | `number` | NO | human_used（natori_case_acceptance_runs） |

## natori_intake_operations

- 役割: ナトリ: 依頼受付の処理記録（二重送信の防止・再実行）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `owner_id` | `string` | NO | owner_id（natori_intake_operations） |
| `operation_id` | `string` | NO | operation_id（natori_intake_operations） |
| `request_hash` | `string` | NO | request_hash（natori_intake_operations） |
| `project_id` | `string` | NO | project_id（natori_intake_operations） |
| `manifest` | `Json` | NO | manifest（natori_intake_operations） |
| `reference_paths` | `Json` | NO | reference_paths（natori_intake_operations） |
| `status` | `string` | NO | ステータス |
| `claim_token` | `string | null` | YES | claim_token（natori_intake_operations） |
| `lease_expires_at` | `string | null` | YES | lease_expires_at（natori_intake_operations） |
| `replay_result` | `Json | null` | YES | replay_result（natori_intake_operations） |
| `notification_ids` | `string[]` | NO | notification_ids（natori_intake_operations） |
| `created_at` | `string` | NO | 作成日時 |
| `updated_at` | `string` | NO | 更新日時 |

## natori_delivery_releases

- 役割: ナトリ: 納品ページに出す内容（公開版）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_delivery_releases） |
| `revision` | `number` | NO | revision（natori_delivery_releases） |
| `manifest` | `Json` | NO | manifest（natori_delivery_releases） |
| `snapshot` | `Json` | NO | snapshot（natori_delivery_releases） |
| `published_at` | `string` | NO | 公開日時 |
| `expires_at` | `string` | NO | 有効期限 |
| `accepted_at` | `string | null` | YES | accepted_at（natori_delivery_releases） |
| `legacy` | `boolean` | NO | legacy（natori_delivery_releases） |

## natori_delivery_access

- 役割: ナトリ: 納品ページのアクセス鍵

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `token_hash` | `string` | NO | トークンハッシュ |
| `release_id` | `string` | NO | release_id（natori_delivery_access） |
| `expires_at` | `string` | NO | 有効期限 |
| `created_at` | `string` | NO | 作成日時 |

## natori_delivery_operations

- 役割: ナトリ: 納品の送信操作（二重送信の防止）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `project_id` | `string` | NO | project_id（natori_delivery_operations） |
| `operation_id` | `string` | NO | operation_id（natori_delivery_operations） |
| `request_hash` | `string` | NO | request_hash（natori_delivery_operations） |
| `release_id` | `string` | NO | release_id（natori_delivery_operations） |
| `notification_id` | `string` | NO | notification_id（natori_delivery_operations） |
| `created_at` | `string` | NO | 作成日時 |

## natori_delivery_extensions

- 役割: ナトリ: 納品ページの公開期限の延長記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `release_id` | `string` | NO | release_id（natori_delivery_extensions） |
| `project_id` | `string` | NO | project_id（natori_delivery_extensions） |
| `operation_id` | `string` | NO | operation_id（natori_delivery_extensions） |
| `request_hash` | `string` | NO | request_hash（natori_delivery_extensions） |
| `previous_expires_at` | `string` | NO | previous_expires_at（natori_delivery_extensions） |
| `new_expires_at` | `string` | NO | new_expires_at（natori_delivery_extensions） |
| `reason` | `string` | NO | reason（natori_delivery_extensions） |
| `created_at` | `string` | NO | 作成日時 |

## natori_notification_jobs

- 役割: ナトリ: 通知メールの送信待ち・送信結果

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `notification_key` | `string` | NO | notification_key（natori_notification_jobs） |
| `attempt_no` | `number` | NO | attempt_no（natori_notification_jobs） |
| `project_id` | `string` | NO | project_id（natori_notification_jobs） |
| `quote_id` | `string | null` | YES | quote_id（natori_notification_jobs） |
| `purpose` | `string` | NO | purpose（natori_notification_jobs） |
| `snapshot` | `Json` | NO | snapshot（natori_notification_jobs） |
| `payload` | `Json | null` | YES | 入力データ（JSON） |
| `status` | `string` | NO | ステータス |
| `claim_token` | `string | null` | YES | claim_token（natori_notification_jobs） |
| `lease_expires_at` | `string | null` | YES | lease_expires_at（natori_notification_jobs） |
| `claim_count` | `number` | NO | claim_count（natori_notification_jobs） |
| `send_started_at` | `string | null` | YES | send_started_at（natori_notification_jobs） |
| `retry_after` | `string | null` | YES | retry_after（natori_notification_jobs） |
| `provider_id` | `string | null` | YES | provider_id（natori_notification_jobs） |
| `sent_at` | `string | null` | YES | sent_at（natori_notification_jobs） |
| `error_code` | `string | null` | YES | error_code（natori_notification_jobs） |
| `created_at` | `string` | NO | 作成日時 |
| `updated_at` | `string` | NO | 更新日時 |

## admin_audit_log

- 役割: 管理操作の記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `action` | `string` | NO | action（admin_audit_log） |
| `admin_email` | `string` | NO | admin_email（admin_audit_log） |
| `created_at` | `string` | NO | 作成日時 |
| `detail` | `Json | null` | YES | detail（admin_audit_log） |
| `id` | `string` | NO | 主キーID |
| `resource_id` | `string | null` | YES | resource_id（admin_audit_log） |
| `resource_type` | `string` | NO | resource_type（admin_audit_log） |

## admin_emails

- 役割: 管理者メールの許可リスト

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `email` | `string` | NO | メールアドレス |

## announcements

- 役割: サイトのお知らせ管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `body_md` | `string` | NO | 本文（Markdown） |
| `category` | `string` | NO | カテゴリ |
| `created_at` | `string` | NO | 作成日時 |
| `created_by` | `string | null` | YES | created_by（announcements） |
| `expires_at` | `string | null` | YES | 有効期限 |
| `id` | `string` | NO | 主キーID |
| `link_url` | `string | null` | YES | リンクURL |
| `pinned` | `boolean` | NO | 固定表示フラグ |
| `published_at` | `string` | NO | 公開日時 |
| `title` | `string` | NO | タイトル |
| `updated_at` | `string` | NO | 更新日時 |

## artists_bank_accounts

- 役割: 作家の振込先口座情報

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `account_name_kana` | `string` | NO | 口座名義（カナ） |
| `account_number` | `string` | NO | 口座番号 |
| `account_type` | `string` | NO | 口座種別 |
| `bank_code` | `string` | NO | 銀行コード |
| `branch_code` | `string` | NO | 支店コード |
| `external_user_id` | `string` | NO | 外部ユーザーID |
| `id` | `number` | NO | 主キーID |
| `updated_at` | `string` | NO | 更新日時 |

## cert_links

- 役割: 証明書ダウンロードリンク管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `entry_id` | `number` | NO | 作品エントリーID |
| `expires_at` | `string | null` | YES | 有効期限 |
| `id` | `string` | NO | 主キーID |
| `revoked` | `boolean` | NO | 無効化フラグ |
| `token_hash` | `string` | NO | トークンハッシュ |
| `updated_at` | `string` | NO | 更新日時 |
| `used_at` | `string | null` | YES | 使用日時 |

## entries

- 役割: 作品エントリー本体（審査・展示・販売・精算）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `agree_promotion` | `boolean` | NO | agree_promotion（entries） |
| `agree_storage` | `boolean` | NO | agree_storage（entries） |
| `ai_usage` | `string | null` | YES | AI利用状況 |
| `ai_usage_note` | `string | null` | YES | AI利用状況の補足 |
| `ai_usage_scope` | `string[] | null` | YES | AI利用範囲 |
| `artist_name` | `string | null` | YES | artist_name（entries） |
| `artist_reward_yen` | `number | null` | YES | 作家取り分（円） |
| `confirmed` | `boolean | null` | YES | 審査承認フラグ |
| `confirmed_at` | `string | null` | YES | 承認日時 |
| `created_at` | `string` | NO | 作成日時 |
| `description` | `string` | NO | 説明 |
| `display_end_at` | `string | null` | YES | 展示終了日時 |
| `display_plan` | `string | null` | YES | 展示プラン |
| `display_ready` | `boolean | null` | YES | 展示可能フラグ |
| `display_start_at` | `string | null` | YES | 展示開始日時 |
| `edition_mode` | `string | null` | YES | エディション販売モード |
| `edition_remaining` | `number | null` | YES | 残エディション数 |
| `edition_sold` | `number` | NO | 販売済みエディション数 |
| `edition_total` | `number | null` | YES | 総エディション数 |
| `email` | `string | null` | YES | メールアドレス |
| `end_notified_at` | `string | null` | YES | end_notified_at（entries） |
| `ending_soon_notified_at` | `string | null` | YES | 終了間近通知送信日時 |
| `external_user_id` | `string | null` | YES | 外部ユーザーID |
| `file_name` | `string | null` | YES | ファイル名 |
| `force_wm` | `boolean` | NO | 強制ウォーターマーク適用フラグ |
| `gallery_type` | `string | null` | YES | gallery_type（entries） |
| `guarantee_extended_count` | `number | null` | YES | guarantee_extended_count（entries） |
| `guarantee_period_end` | `string | null` | YES | guarantee_period_end（entries） |
| `guarantee_period_start` | `string | null` | YES | guarantee_period_start（entries） |
| `guarantee_remaining` | `number | null` | YES | guarantee_remaining（entries） |
| `guarantee_total` | `number | null` | YES | guarantee_total（entries） |
| `has_signature` | `boolean | null` | YES | 署名有無フラグ |
| `id` | `number` | NO | 主キーID |
| `image_url` | `string` | NO | 画像URL |
| `is_for_sale` | `boolean` | NO | 販売対象フラグ |
| `is_paid_to_artist` | `boolean | null` | YES | 作家支払済みフラグ |
| `is_sold` | `boolean | null` | YES | 売約済みフラグ |
| `likes` | `number` | NO | いいね数 |
| `meish_fee_yen` | `number | null` | YES | プラットフォーム手数料（円） |
| `paid_at` | `string | null` | YES | 支払完了日時 |
| `plan_payment_amount_yen` | `number | null` | YES | 展示プラン決済額（円） |
| `plan_payment_checkout_created_at` | `string | null` | YES | 展示プランCheckout作成日時 |
| `plan_payment_paid_at` | `string | null` | YES | 展示プラン決済完了日時 |
| `plan_payment_session_id` | `string | null` | YES | 展示プラン決済セッションID |
| `plan_payment_status` | `string` | NO | 展示プラン決済状態 |
| `portfolio_hidden` | `boolean` | NO | ポートフォリオ非表示フラグ |
| `price` | `number | null` | YES | 価格 |
| `reject_email_sent_at` | `string | null` | YES | 却下通知送信日時 |
| `reject_reason` | `string | null` | YES | 審査却下理由 |
| `rejected_at` | `string | null` | YES | 却下日時 |
| `sale_type` | `string` | NO | 販売方式 |
| `sns_links` | `string` | NO | SNSリンク（JSON文字列） |
| `sold_out_calc` | `boolean | null` | YES | 売切れ判定の計算結果 |
| `title` | `string | null` | YES | タイトル |
| `token_id` | `number | null` | YES | トークンID |
| `type` | `string | null` | YES | 種別 |
| `user_id` | `string | null` | YES | ユーザーID |

## entry_processing_jobs

- 役割: 作品処理の非同期ジョブ管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `attempts` | `number` | NO | attempts（entry_processing_jobs） |
| `created_at` | `string` | NO | 作成日時 |
| `entry_id` | `number` | NO | 作品エントリーID |
| `id` | `string` | NO | 主キーID |
| `last_error` | `string | null` | YES | last_error（entry_processing_jobs） |
| `locked_at` | `string | null` | YES | locked_at（entry_processing_jobs） |
| `locked_by` | `string | null` | YES | locked_by（entry_processing_jobs） |
| `status` | `string` | NO | ステータス |
| `updated_at` | `string` | NO | 更新日時 |

## inquiries

- 役割: 問い合わせ管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string | null` | YES | 作成日時 |
| `email` | `string` | NO | メールアドレス |
| `id` | `string` | NO | 主キーID |
| `is_read` | `boolean | null` | YES | 既読フラグ |
| `message` | `string` | NO | 本文メッセージ |
| `name` | `string` | NO | 氏名 |

## natori_delivery_files

- 役割: ナトリ: 納品ファイル

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `state` | `string` | NO | state（natori_delivery_files） |
| `content_type` | `string | null` | YES | content_type（natori_delivery_files） |
| `storage_version` | `string | null` | YES | storage_version（natori_delivery_files） |
| `verified_at` | `string | null` | YES | verified_at（natori_delivery_files） |
| `deleted_at` | `string | null` | YES | deleted_at（natori_delivery_files） |
| `created_at` | `string` | NO | 作成日時 |
| `file_name` | `string` | NO | ファイル名 |
| `folder` | `string` | NO | folder（natori_delivery_files） |
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_delivery_files） |
| `size_bytes` | `number` | NO | size_bytes（natori_delivery_files） |
| `storage_path` | `string` | NO | storage_path（natori_delivery_files） |

## natori_events

- 役割: ナトリ: 予定

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `date` | `string` | NO | date（natori_events） |
| `id` | `string` | NO | 主キーID |
| `note` | `string | null` | YES | 備考 |
| `title` | `string` | NO | タイトル |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |

## natori_inquiry_reference_files

- 役割: ナトリ: 依頼時の参考ファイル

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_inquiry_reference_files） |
| `storage_path` | `string` | NO | storage_path（natori_inquiry_reference_files） |

## natori_links_content

- 役割: ナトリ: リンク集ページの内容

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `content` | `Json` | NO | 内容（JSON） |
| `id` | `string` | NO | 主キーID |
| `updated_at` | `string` | NO | 更新日時 |

## natori_order_mail_logs

- 役割: ナトリ: 見積・支払いなどの送信メール記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `amount` | `number` | NO | amount（natori_order_mail_logs） |
| `body_snapshot` | `string` | NO | body_snapshot（natori_order_mail_logs） |
| `created_at` | `string` | NO | 作成日時 |
| `error_message` | `string | null` | YES | error_message（natori_order_mail_logs） |
| `id` | `number` | NO | 主キーID |
| `kind` | `string` | NO | kind（natori_order_mail_logs） |
| `link_url` | `string | null` | YES | リンクURL |
| `project_id` | `string` | NO | project_id（natori_order_mail_logs） |
| `quote_id` | `string | null` | YES | quote_id（natori_order_mail_logs） |
| `request_id` | `string` | NO | リクエストID |
| `sent_at` | `string | null` | YES | sent_at（natori_order_mail_logs） |
| `status` | `string` | NO | ステータス |
| `subject` | `string` | NO | subject（natori_order_mail_logs） |
| `to_email` | `string` | NO | to_email（natori_order_mail_logs） |
| `updated_at` | `string` | NO | 更新日時 |

## natori_page_events

- 役割: ナトリ: 公開ページの閲覧・クリック記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `event` | `string` | NO | event（natori_page_events） |
| `id` | `number` | NO | 主キーID |
| `label` | `string` | NO | label（natori_page_events） |
| `path` | `string` | NO | path（natori_page_events） |

## natori_stripe_event_inbox

- 役割: ナトリ: Stripeからの通知の受け箱（処理待ち・処理済み）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `event_id` | `string` | NO | event_id（natori_stripe_event_inbox） |
| `account_scope` | `string` | NO | account_scope（natori_stripe_event_inbox） |
| `livemode` | `boolean` | NO | livemode（natori_stripe_event_inbox） |
| `event_type` | `string` | NO | event_type（natori_stripe_event_inbox） |
| `request` | `Json` | NO | request（natori_stripe_event_inbox） |
| `owner_id` | `string` | NO | owner_id（natori_stripe_event_inbox） |
| `project_id` | `string | null` | YES | project_id（natori_stripe_event_inbox） |
| `status` | `string` | NO | ステータス |
| `claim_token` | `string | null` | YES | claim_token（natori_stripe_event_inbox） |
| `claim_generation` | `number` | NO | claim_generation（natori_stripe_event_inbox） |
| `lease_until` | `string | null` | YES | lease_until（natori_stripe_event_inbox） |
| `processed_at` | `string | null` | YES | processed_at（natori_stripe_event_inbox） |
| `result` | `string | null` | YES | result（natori_stripe_event_inbox） |
| `error_code` | `string | null` | YES | error_code（natori_stripe_event_inbox） |
| `notification_ids` | `string[]` | NO | notification_ids（natori_stripe_event_inbox） |
| `created_at` | `string` | NO | 作成日時 |
| `updated_at` | `string` | NO | 更新日時 |

## natori_refund_ledger

- 役割: ナトリ: 返金の記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `owner_id` | `string` | NO | owner_id（natori_refund_ledger） |
| `account_scope` | `string` | NO | account_scope（natori_refund_ledger） |
| `livemode` | `boolean` | NO | livemode（natori_refund_ledger） |
| `refund_id` | `string` | NO | refund_id（natori_refund_ledger） |
| `transaction_id` | `string | null` | YES | transaction_id（natori_refund_ledger） |
| `project_id` | `string | null` | YES | project_id（natori_refund_ledger） |
| `claimed_project_id` | `string | null` | YES | claimed_project_id（natori_refund_ledger） |
| `payment_intent_id` | `string | null` | YES | payment_intent_id（natori_refund_ledger） |
| `charge_id` | `string | null` | YES | charge_id（natori_refund_ledger） |
| `amount` | `number | null` | YES | amount（natori_refund_ledger） |
| `currency` | `string | null` | YES | currency（natori_refund_ledger） |
| `provider_status` | `string` | NO | provider_status（natori_refund_ledger） |
| `confirmed_at` | `string | null` | YES | confirmed_at（natori_refund_ledger） |
| `source` | `string` | NO | source（natori_refund_ledger） |
| `resolution` | `string` | NO | resolution（natori_refund_ledger） |
| `review_reason` | `string | null` | YES | review_reason（natori_refund_ledger） |
| `first_event_id` | `string` | NO | first_event_id（natori_refund_ledger） |
| `latest_event_id` | `string` | NO | latest_event_id（natori_refund_ledger） |
| `provider_event_created` | `number` | NO | provider_event_created（natori_refund_ledger） |
| `created_at` | `string` | NO | 作成日時 |
| `updated_at` | `string` | NO | 更新日時 |

## natori_payment_transactions

- 役割: ナトリ: 支払いの記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `amount` | `number` | NO | amount（natori_payment_transactions） |
| `id` | `string` | NO | 主キーID |
| `note` | `string | null` | YES | 備考 |
| `project_id` | `string` | NO | project_id（natori_payment_transactions） |
| `quote_id` | `string | null` | YES | quote_id（natori_payment_transactions） |
| `received_at` | `string` | NO | received_at（natori_payment_transactions） |
| `status` | `string` | NO | ステータス |
| `stripe_account_scope` | `string | null` | YES | stripe_account_scope（natori_payment_transactions） |
| `stripe_livemode` | `boolean | null` | YES | stripe_livemode（natori_payment_transactions） |
| `stripe_payment_intent_id` | `string | null` | YES | stripe_payment_intent_id（natori_payment_transactions） |
| `stripe_charge_id` | `string | null` | YES | stripe_charge_id（natori_payment_transactions） |
| `stripe_currency` | `string | null` | YES | stripe_currency（natori_payment_transactions） |
| `stripe_session_id` | `string | null` | YES | stripe_session_id（natori_payment_transactions） |

## natori_portfolio_content

- 役割: ナトリ: ポートフォリオページの内容

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `revision` | `number` | NO | revision（natori_portfolio_content） |
| `content` | `Json` | NO | 内容（JSON） |
| `id` | `string` | NO | 主キーID |
| `updated_at` | `string` | NO | 更新日時 |

## natori_portfolio_assets

- 役割: ナトリ: ポートフォリオのアップロード素材

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `owner_id` | `string` | NO | owner_id（natori_portfolio_assets） |
| `kind` | `string` | NO | kind（natori_portfolio_assets） |
| `path` | `string` | NO | path（natori_portfolio_assets） |
| `byte_size` | `number` | NO | byte_size（natori_portfolio_assets） |
| `ready` | `boolean` | NO | ready（natori_portfolio_assets） |
| `created_at` | `string` | NO | 作成日時 |

## natori_pricing_configs

- 役割: ナトリ: 料金表の設定

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `config` | `Json` | NO | config（natori_pricing_configs） |
| `created_at` | `string` | NO | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `is_default` | `boolean` | NO | is_default（natori_pricing_configs） |
| `name` | `string` | NO | 氏名 |
| `preset_key` | `string` | NO | preset_key（natori_pricing_configs） |
| `sort_order` | `number` | NO | 表示順 |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |

## natori_consultation_access

- 役割: ナトリ: 相談ページ（トーク）のアクセス鍵

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_consultation_access） |
| `token_hash` | `string` | NO | トークンハッシュ |
| `expires_at` | `string` | NO | 有効期限 |
| `created_at` | `string` | NO | 作成日時 |
| `renewed_at` | `string | null` | YES | renewed_at（natori_consultation_access） |

## natori_consultation_files

- 役割: ナトリ: トークの添付ファイル

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_consultation_files） |
| `message_id` | `string` | NO | message_id（natori_consultation_files） |
| `storage_path` | `string` | NO | storage_path（natori_consultation_files） |
| `file_name` | `string` | NO | ファイル名 |
| `mime_type` | `string` | NO | mime_type（natori_consultation_files） |
| `size_bytes` | `number` | NO | size_bytes（natori_consultation_files） |
| `created_at` | `string` | NO | 作成日時 |

## natori_consultation_messages

- 役割: ナトリ: トークのメッセージ

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_consultation_messages） |
| `sender` | `string` | NO | sender（natori_consultation_messages） |
| `body` | `string` | NO | body（natori_consultation_messages） |
| `notification_status` | `string` | NO | notification_status（natori_consultation_messages） |
| `created_at` | `string` | NO | 作成日時 |
| `operation_id` | `string | null` | YES | operation_id（natori_consultation_messages） |
| `request_hash` | `string | null` | YES | request_hash（natori_consultation_messages） |
| `attachment_count` | `number | null` | YES | attachment_count（natori_consultation_messages） |
| `notification_id` | `string | null` | YES | notification_id（natori_consultation_messages） |

## natori_consultation_uploads

- 役割: ナトリ: トークへのアップロード（確定前を含む）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `id` | `string` | NO | 主キーID |
| `project_id` | `string` | NO | project_id（natori_consultation_uploads） |
| `sender` | `string` | NO | sender（natori_consultation_uploads） |
| `storage_path` | `string` | NO | storage_path（natori_consultation_uploads） |
| `file_name` | `string` | NO | ファイル名 |
| `mime_type` | `string` | NO | mime_type（natori_consultation_uploads） |
| `size_bytes` | `number` | NO | size_bytes（natori_consultation_uploads） |
| `created_at` | `string` | NO | 作成日時 |
| `finalized_at` | `string | null` | YES | finalized_at（natori_consultation_uploads） |
| `operation_id` | `string | null` | YES | operation_id（natori_consultation_uploads） |
| `file_id` | `string | null` | YES | file_id（natori_consultation_uploads） |
| `content_sha256` | `string | null` | YES | content_sha256（natori_consultation_uploads） |
| `message_id` | `string | null` | YES | message_id（natori_consultation_uploads） |
| `credential_issuer` | `string | null` | YES | credential_issuer（natori_consultation_uploads） |
| `credential_started_at` | `string | null` | YES | credential_started_at（natori_consultation_uploads） |
| `credential_expires_at` | `string | null` | YES | credential_expires_at（natori_consultation_uploads） |

## natori_quote_access

- 役割: ナトリ: 見積ページのアクセス鍵

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `token_hash` | `string` | NO | トークンハッシュ |
| `quote_id` | `string` | NO | quote_id（natori_quote_access） |
| `expires_at` | `string` | NO | 有効期限 |
| `created_at` | `string` | NO | 作成日時 |

## natori_estimate_drafts

- 役割: ナトリ: 見積の下書き

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `project_id` | `string` | NO | project_id（natori_estimate_drafts） |
| `user_id` | `string` | NO | ユーザーID |
| `agreed_terms` | `Json` | NO | agreed_terms（natori_estimate_drafts） |
| `items` | `Json` | NO | items（natori_estimate_drafts） |
| `mail_draft` | `Json | null` | YES | mail_draft（natori_estimate_drafts） |
| `revision` | `number` | NO | revision（natori_estimate_drafts） |
| `updated_at` | `string` | NO | 更新日時 |

## natori_project_activity

- 役割: ナトリ: 案件の出来事の記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `dedupe_key` | `string | null` | YES | dedupe_key（natori_project_activity） |
| `event_type` | `string` | NO | event_type（natori_project_activity） |
| `id` | `string` | NO | 主キーID |
| `occurred_at` | `string` | NO | occurred_at（natori_project_activity） |
| `payload` | `Json` | NO | 入力データ（JSON） |
| `project_id` | `string` | NO | project_id（natori_project_activity） |
| `source_id` | `string` | NO | source_id（natori_project_activity） |
| `source_type` | `string` | NO | source_type（natori_project_activity） |
| `user_id` | `string` | NO | ユーザーID |

## natori_project_reference_links

- 役割: ナトリ: 案件の参考リンク

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `label` | `string | null` | YES | label（natori_project_reference_links） |
| `normalized_url` | `string` | NO | normalized_url（natori_project_reference_links） |
| `project_id` | `string` | NO | project_id（natori_project_reference_links） |
| `provider` | `string | null` | YES | provider（natori_project_reference_links） |
| `sort_order` | `number` | NO | 表示順 |
| `updated_at` | `string` | NO | 更新日時 |
| `url` | `string` | NO | url（natori_project_reference_links） |

## natori_project_tasks

- 役割: ナトリ: 案件の制作工程

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `done` | `boolean` | NO | done（natori_project_tasks） |
| `estimated_hours` | `number | null` | YES | estimated_hours（natori_project_tasks） |
| `id` | `string` | NO | 主キーID |
| `label` | `string` | NO | label（natori_project_tasks） |
| `project_id` | `string` | NO | project_id（natori_project_tasks） |
| `sort_order` | `number` | NO | 表示順 |
| `stage` | `string` | NO | stage（natori_project_tasks） |
| `task_key` | `string` | NO | task_key（natori_project_tasks） |

## natori_projects

- 役割: ナトリ: 案件本体（依頼〜納品）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `active_quote_id` | `string | null` | YES | active_quote_id（natori_projects） |
| `amount` | `number | null` | YES | amount（natori_projects） |
| `client_email` | `string | null` | YES | client_email（natori_projects） |
| `client_name` | `string` | NO | client_name（natori_projects） |
| `completed_at` | `string | null` | YES | completed_at（natori_projects） |
| `created_at` | `string` | NO | 作成日時 |
| `deleted_at` | `string | null` | YES | deleted_at（natori_projects） |
| `delivered_mail_at` | `string | null` | YES | delivered_mail_at（natori_projects） |
| `delivery_accepted_at` | `string | null` | YES | delivery_accepted_at（natori_projects） |
| `delivery_plan` | `string` | NO | delivery_plan（natori_projects） |
| `delivery_token_expires_at` | `string | null` | YES | delivery_token_expires_at（natori_projects） |
| `delivery_token_hash` | `string | null` | YES | delivery_token_hash（natori_projects） |
| `due_date` | `string | null` | YES | due_date（natori_projects） |
| `id` | `string` | NO | 主キーID |
| `next_action` | `string` | NO | next_action（natori_projects） |
| `mutation_revision` | `number` | NO | mutation_revision（natori_projects） |
| `note` | `string | null` | YES | 備考 |
| `paid_amount` | `number | null` | YES | paid_amount（natori_projects） |
| `paid_at` | `string | null` | YES | 支払完了日時 |
| `payment_confirmed_at` | `string | null` | YES | payment_confirmed_at（natori_projects） |
| `payment_link_id` | `string | null` | YES | payment_link_id（natori_projects） |
| `payment_link_status` | `string | null` | YES | payment_link_status（natori_projects） |
| `payment_link_url` | `string | null` | YES | payment_link_url（natori_projects） |
| `payment_quote_id` | `string | null` | YES | payment_quote_id（natori_projects） |
| `priority` | `string | null` | YES | priority（natori_projects） |
| `quote_accept_token_hash` | `string | null` | YES | quote_accept_token_hash（natori_projects） |
| `quote_accepted_amount` | `number | null` | YES | quote_accepted_amount（natori_projects） |
| `quote_accepted_at` | `string | null` | YES | quote_accepted_at（natori_projects） |
| `quote_token_expires_at` | `string | null` | YES | quote_token_expires_at（natori_projects） |
| `quoted_amount` | `number | null` | YES | quoted_amount（natori_projects） |
| `request_data` | `Json | null` | YES | request_data（natori_projects） |
| `start_date` | `string | null` | YES | start_date（natori_projects） |
| `status` | `string` | NO | ステータス |
| `stripe_payment_session_id` | `string | null` | YES | stripe_payment_session_id（natori_projects） |
| `title` | `string` | NO | タイトル |
| `type` | `string` | NO | 種別 |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |

## natori_quotes

- 役割: ナトリ: 見積

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `accepted_at` | `string | null` | YES | accepted_at（natori_quotes） |
| `amount` | `number` | NO | amount（natori_quotes） |
| `body_snapshot` | `string` | NO | body_snapshot（natori_quotes） |
| `client_name` | `string` | NO | client_name（natori_quotes） |
| `created_at` | `string` | NO | 作成日時 |
| `expires_at` | `string` | NO | 有効期限 |
| `id` | `string` | NO | 主キーID |
| `idempotency_key` | `string | null` | YES | idempotency_key（natori_quotes） |
| `issued_at` | `string | null` | YES | issued_at（natori_quotes） |
| `pricing_snapshot` | `Json | null` | YES | pricing_snapshot（natori_quotes） |
| `project_id` | `string` | NO | project_id（natori_quotes） |
| `quote_terms` | `Json | null` | YES | quote_terms（natori_quotes） |
| `request_snapshot` | `Json | null` | YES | request_snapshot（natori_quotes） |
| `subject` | `string` | NO | subject（natori_quotes） |
| `superseded_at` | `string | null` | YES | superseded_at（natori_quotes） |
| `title` | `string` | NO | タイトル |
| `to_email` | `string` | NO | to_email（natori_quotes） |
| `token_hash` | `string` | NO | トークンハッシュ |
| `user_id` | `string` | NO | ユーザーID |
| `version` | `number` | NO | version（natori_quotes） |

## natori_user_profiles

- 役割: ナトリ: 作家プロフィール（1日の作業時間など）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `daily_capacity_hours` | `number | null` | YES | daily_capacity_hours（natori_user_profiles） |
| `display_name` | `string | null` | YES | 表示名 |
| `handle` | `string | null` | YES | handle（natori_user_profiles） |
| `links_url` | `string | null` | YES | links_url（natori_user_profiles） |
| `portfolio_url` | `string | null` | YES | portfolio_url（natori_user_profiles） |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |

## payout_batches

- 役割: 支払バッチ（月次締め）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `artist_count` | `number | null` | YES | 作家数 |
| `closed_at` | `string | null` | YES | 締め日時 |
| `created_at` | `string | null` | YES | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `paid_at` | `string | null` | YES | 支払完了日時 |
| `period_ym` | `string` | NO | 対象年月（YYYY-MM） |
| `sale_count` | `number | null` | YES | 売上件数 |
| `status` | `string` | NO | ステータス |
| `total_amount_yen` | `number | null` | YES | 合計金額（円） |

## payout_items

- 役割: 支払バッチ内の明細紐付け

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `payout_id` | `string` | NO | payout_id（payout_items） |
| `sale_id` | `string` | NO | sale_id（payout_items） |

## payouts

- 役割: 作家ごとの支払管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `amount_yen` | `number` | NO | 金額（円） |
| `created_at` | `string` | NO | 作成日時 |
| `id` | `string` | NO | 主キーID |
| `note` | `string | null` | YES | 備考 |
| `paid_at` | `string | null` | YES | 支払完了日時 |
| `period_ym` | `string` | NO | 対象年月（YYYY-MM） |
| `scheduled_at` | `string | null` | YES | 予定日時 |
| `status` | `Database["public"]["Enums"]["payout_status"]` | NO | ステータス |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |

## processed_stripe_events

- 役割: Stripe Webhookの処理済みイベント（二重処理の防止）

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `event_id` | `string` | NO | event_id（processed_stripe_events） |
| `received_at` | `string` | NO | received_at（processed_stripe_events） |

## profiles

- 役割: ユーザープロフィール

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `avatar_url` | `string | null` | YES | アバター画像URL |
| `banner_focus_x` | `number` | NO | バナー焦点X |
| `banner_focus_y` | `number` | NO | バナー焦点Y |
| `banner_url` | `string | null` | YES | バナー画像URL |
| `banner_zoom` | `number` | NO | バナー拡大率 |
| `bio` | `string | null` | YES | 自己紹介 |
| `created_at` | `string | null` | YES | 作成日時 |
| `display_name` | `string` | NO | 表示名 |
| `id` | `string` | NO | 主キーID |
| `sns_links` | `Json | null` | YES | sns_links（profiles） |
| `updated_at` | `string | null` | YES | 更新日時 |

## sales

- 役割: 購入・売上トランザクション

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `artist_reward_yen` | `number | null` | YES | 作家取り分（円） |
| `buyer_email` | `string | null` | YES | 購入者メール |
| `close_batch_id` | `string | null` | YES | 締めバッチID |
| `entry_id` | `number` | NO | 作品エントリーID |
| `id` | `string` | NO | 主キーID |
| `meish_fee_yen` | `number | null` | YES | 手数料（円） |
| `metadata` | `Json | null` | YES | メタデータ（JSON） |
| `paid_at` | `string | null` | YES | 決済完了日時 |
| `payout_batch_id` | `string | null` | YES | 支払バッチID |
| `payout_status` | `Database["public"]["Enums"]["payout_status"]` | NO | 支払処理ステータス |
| `price` | `number | null` | YES | 価格 |
| `purchased_at` | `string | null` | YES | 購入日時 |
| `stripe_session_id` | `string` | NO | Stripe CheckoutセッションID |

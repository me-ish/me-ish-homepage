# Supabaseテーブル説明（public, 自動生成）

- 生成元: `src/types/supabase.ts`
- 生成日時: `2026-02-04T13:09:21.040Z`

## 一覧

| テーブル | 役割 | カラム数 |
|---|---|---:|
| `admin_emails` | 管理者メールの許可リスト | 1 |
| `announcements` | サイトのお知らせ管理 | 11 |
| `artists_bank_accounts` | 作家の振込先口座情報 | 8 |
| `aura_first20_redemptions` | AURAの初期特典利用履歴 | 5 |
| `aura_meish_free_claims` | AURA→ME-ISH無料付与の利用記録 | 5 |
| `aura_promo_counters` | プロモーション上限のカウンタ管理 | 2 |
| `aura_requests` | AURA生成リクエスト本体 | 18 |
| `cert_links` | 証明書ダウンロードリンク管理 | 8 |
| `entries` | 作品エントリー本体（審査・展示・販売・精算） | 51 |
| `entry_processing_jobs` | 作品処理の非同期ジョブ管理 | 9 |
| `entry_view_events` | 作品閲覧イベントログ | 5 |
| `inquiries` | 問い合わせ管理 | 6 |
| `likes` | いいね履歴 | 4 |
| `payout_batches` | 支払バッチ（月次締め） | 9 |
| `payout_items` | 支払バッチ内の明細紐付け | 4 |
| `payouts` | 作家ごとの支払管理 | 10 |
| `portfolio_settings` | ポートフォリオ公開設定 | 11 |
| `profiles` | ユーザープロフィール | 11 |
| `sales` | 購入・売上トランザクション | 13 |
| `special_thanks` | Special Thanks表示管理 | 9 |

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

## aura_first20_redemptions

- 役割: AURAの初期特典利用履歴

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `converted_to_meish_at` | `string | null` | YES | converted_to_meish_at（aura_first20_redemptions） |
| `created_at` | `string` | NO | 作成日時 |
| `email` | `string` | NO | メールアドレス |
| `request_id` | `string | null` | YES | リクエストID |
| `used_at` | `string` | NO | 使用日時 |

## aura_meish_free_claims

- 役割: AURA→ME-ISH無料付与の利用記録

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `email` | `string` | NO | メールアドレス |
| `entry_id` | `number | null` | YES | 作品エントリーID |
| `request_id` | `string | null` | YES | リクエストID |
| `used_at` | `string` | NO | 使用日時 |

## aura_promo_counters

- 役割: プロモーション上限のカウンタ管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `key` | `string` | NO | 管理キー |
| `limit_count` | `number` | NO | 上限数 |

## aura_requests

- 役割: AURA生成リクエスト本体

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `content` | `Json | null` | YES | 内容（JSON） |
| `created_at` | `string` | NO | 作成日時 |
| `design` | `Json | null` | YES | デザイン設定（JSON） |
| `email` | `string | null` | YES | メールアドレス |
| `error` | `string | null` | YES | エラー内容 |
| `id` | `string` | NO | 主キーID |
| `paid_at` | `string | null` | YES | 支払完了日時 |
| `payload` | `Json | null` | YES | 入力データ（JSON） |
| `payment_status` | `string` | NO | 決済ステータス |
| `public_id` | `string | null` | YES | 公開用ID |
| `public_slug` | `string | null` | YES | 公開用スラッグ |
| `published_at` | `string | null` | YES | 公開日時 |
| `renderer_version` | `string` | NO | レンダラー版本 |
| `session_token` | `string | null` | YES | セッショントークン |
| `slug` | `string | null` | YES | スラッグ |
| `status` | `string` | NO | ステータス |
| `updated_at` | `string` | NO | 更新日時 |
| `visibility` | `string` | NO | 公開範囲 |

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
| `ending_soon_notified_at` | `string | null` | YES | 終了間近通知送信日時 |
| `external_user_id` | `string | null` | YES | 外部ユーザーID |
| `file_name` | `string | null` | YES | ファイル名 |
| `force_wm` | `boolean` | NO | 強制ウォーターマーク適用フラグ |
| `gallery_type` | `string | null` | YES | gallery_type（entries） |
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

## entry_view_events

- 役割: 作品閲覧イベントログ

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `entry_id` | `number` | NO | 作品エントリーID |
| `id` | `string` | NO | 主キーID |
| `occurred_at` | `string` | NO | occurred_at（entry_view_events） |
| `session_id` | `string | null` | YES | セッションID |
| `viewer_user_id` | `string | null` | YES | viewer_user_id（entry_view_events） |

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

## likes

- 役割: いいね履歴

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `created_at` | `string` | NO | 作成日時 |
| `entry_id` | `number` | NO | 作品エントリーID |
| `id` | `string` | NO | 主キーID |
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

## portfolio_settings

- 役割: ポートフォリオ公開設定

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `bio_short` | `string | null` | YES | 短い自己紹介 |
| `contact_email` | `string | null` | YES | contact_email（portfolio_settings） |
| `contact_url` | `string | null` | YES | contact_url（portfolio_settings） |
| `created_at` | `string` | NO | 作成日時 |
| `headline` | `string | null` | YES | 見出し |
| `is_public` | `boolean` | NO | 公開フラグ |
| `public_display_name` | `string | null` | YES | 公開表示名 |
| `sort_key` | `string` | NO | 並び順キー |
| `updated_at` | `string` | NO | 更新日時 |
| `user_id` | `string` | NO | ユーザーID |
| `works_filter` | `string` | NO | 作品フィルタ条件 |

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

## special_thanks

- 役割: Special Thanks表示管理

| カラム | TypeScript型 | NULL可 | 作用 |
|---|---|---|---|
| `avatar_url` | `string | null` | YES | アバター画像URL |
| `display_name` | `string` | NO | 表示名 |
| `homepage_url` | `string | null` | YES | ホームページURL |
| `id` | `string` | NO | 主キーID |
| `instagram_url` | `string | null` | YES | Instagram URL |
| `is_public` | `boolean` | NO | 公開フラグ |
| `sort_order` | `number | null` | YES | 表示順 |
| `tagline` | `string | null` | YES | キャッチコピー |
| `twitter_url` | `string | null` | YES | X(Twitter) URL |

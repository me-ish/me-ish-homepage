# DB・Storage 保持台帳と復元条件（2026-10-10）

## 実施範囲

本番 `lvnfspyainrxtztjytbo` にREAD ONLYのカタログ・件数・Storage登録情報照会だけを実施。
DB行、RLS、権限、所有者、画像、プロジェクト設定は変更していない。
停止中の別2プロジェクトは対象外。追加有料環境は作成していない。

publicは63テーブル・713行、うちナトリ34テーブル・18案件（deleted_atがNULLの案件16件）。
案件件数は削除済みを含む総数と分ける。過去の「有効17件」を今回の値とは扱わない。
最新データの古いバックアップへの巻戻しは行わない。
テーブル行数はSELECT count(*)の実測で、pg_classの推定値ではない。migration履歴35件。

## DBの保持・候補

| テーブル | 行数 | 判定 |
| --- | ---: | --- |
| `admin_audit_log` | 22 | 共通・監査のため保持 |
| `admin_emails` | 1 | 共通・監査のため保持 |
| `announcements` | 3 | 既存購入・問合せ・記録のため当面保持 |
| `artists_bank_accounts` | 4 | 既存購入・問合せ・記録のため当面保持 |
| `aura_first20_redemptions` | 2 | 既存購入・問合せ・記録のため当面保持 |
| `aura_meish_free_claims` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `aura_projects` | 9 | 既存購入・問合せ・記録のため当面保持 |
| `aura_promo_counters` | 1 | 既存購入・問合せ・記録のため当面保持 |
| `aura_requests` | 58 | 既存購入・問合せ・記録のため当面保持 |
| `card_requests` | 1 | 既存購入・問合せ・記録のため当面保持 |
| `cert_links` | 10 | 既存購入・問合せ・記録のため当面保持 |
| `entries` | 4 | 既存購入・問合せ・記録のため当面保持 |
| `entry_comments` | 0 | 削除候補（未承認・未削除） |
| `entry_daily_slots` | 0 | 削除候補（未承認・未削除） |
| `entry_processing_jobs` | 4 | 既存購入・問合せ・記録のため当面保持 |
| `entry_view_events` | 9 | 削除候補（未承認・未削除） |
| `inquiries` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `kpi_jobs` | 0 | 削除候補（未承認・未削除） |
| `kpi_posts` | 0 | 削除候補（未承認・未削除） |
| `likes` | 4 | 削除候補（未承認・未削除） |
| `natori_consultation_access` | 3 | 保持 |
| `natori_consultation_files` | 2 | 保持 |
| `natori_consultation_messages` | 5 | 保持 |
| `natori_consultation_operations` | 0 | 保持 |
| `natori_consultation_uploads` | 9 | 保持 |
| `natori_delivery_access` | 0 | 保持 |
| `natori_delivery_files` | 0 | 保持 |
| `natori_delivery_operations` | 0 | 保持 |
| `natori_delivery_releases` | 0 | 保持 |
| `natori_estimate_drafts` | 0 | 保持 |
| `natori_events` | 2 | 保持 |
| `natori_inquiry_reference_files` | 1 | 保持 |
| `natori_intake_operations` | 0 | 保持 |
| `natori_links_content` | 0 | 保持 |
| `natori_notification_jobs` | 0 | 保持 |
| `natori_order_mail_logs` | 3 | 保持 |
| `natori_page_events` | 411 | 保持 |
| `natori_payment_link_attempts` | 0 | 保持 |
| `natori_payment_link_operations` | 0 | 保持 |
| `natori_payment_link_rejections` | 0 | 保持 |
| `natori_payment_link_stops` | 0 | 保持 |
| `natori_payment_transactions` | 7 | 保持 |
| `natori_portfolio_content` | 1 | 保持 |
| `natori_pricing_configs` | 6 | 保持 |
| `natori_project_activity` | 10 | 保持 |
| `natori_project_reference_links` | 1 | 保持 |
| `natori_project_tasks` | 96 | 保持 |
| `natori_projects` | 18 | 保持 |
| `natori_quote_access` | 0 | 保持 |
| `natori_quote_issue_operations` | 0 | 保持 |
| `natori_quotes` | 2 | 保持 |
| `natori_refund_ledger` | 0 | 保持 |
| `natori_stripe_event_inbox` | 0 | 保持 |
| `natori_user_profiles` | 0 | 保持 |
| `payout_batches` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `payout_items` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `payouts` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `portfolio_settings` | 0 | 削除候補（未承認・未削除） |
| `processed_stripe_events` | 2 | 共通・監査のため保持 |
| `profiles` | 2 | 既存購入・問合せ・記録のため当面保持 |
| `sales` | 0 | 既存購入・問合せ・記録のため当面保持 |
| `special_thanks` | 0 | 削除候補（未承認・未削除） |
| `youtube_videos` | 0 | 削除候補（未承認・未削除） |

- Auth全体と管理者認可は保持。ナトリの所有者/外部キーがAuthを参照する。
- ナトリテーブルのFKに旧gallery/AURA/CARDテーブルへの参照は確認されなかった。
  FK以外の関数・アプリ参照まで消失を証明した意味ではない。
- sales/payouts/payout_batchesはいずれも0件、展示プランpendingも0件。
  ただしcert_linksは10件、AURA paidは2件あり、Stripe側の未完了Checkoutや返金・履行完了までは未確認。
  決済/証明書/画像/精算のコードや記録は保持する。
- AURA requestsは58件（paid2、unpaid56）、Studio9件unpaid、CARD1件unpaid。
  公開終了だけを、これらの保存データを消してよいという判断に使わない。
- 9表の「削除候補」は退役機能のデータ。今回DROP/DELETEは用意・実行していない。
  例: likes/entry_view_eventsを消せば過去の反応・閲覧履歴、portfolio_settingsを消せば旧公開設定を失う。
  entry_daily_slotsを消せば旧展示選出履歴を失う。空表にも定義・関数の依存確認が必要。
- entries、entry_processing_jobsは現在も管理の記録確認や証明書処理から参照する。
  共通のお知らせ・問い合わせはサポート用として維持する。

## Storage

| バケット | 公開 | 登録数 | metadata bytes | 判定 |
| --- | --- | ---: | ---: | --- |
| natori-portfolio | yes | 40 | 5,250,174 | 全件保持 |
| natori-consultations | no | 4 | 19,452,639 | 全件保持 |
| natori-inquiry-refs | no | 1 | 122,714 | 全件保持 |
| natori-deliveries | no | 0 | 0 | 現行納品用。空でも保持 |
| artworks | yes | 12 | 22,258,191 | 既存証明書・作品受取に関係。削除保留 |
| aura-assets | no | 28 | 2,773,192 | 旧公開終了後の候補。ただしpaidデータとの対応と履行確認が先 |
| card-assets | no | 7 | 19,174 | 旧公開終了後の候補。復元・外部参照確認後に個別承認 |
| banners | yes | 1 | 240,588 | 旧プロフィール用候補。外部参照確認後に個別承認 |
| avatars | yes | 0 | 0 | 空の旧バケット候補。設定・利用元確認後に個別承認 |
| gallery-entry-intake | no | 0 | 0 | 旧バケット候補。Phase 0Aの復元試験との関係を維持 |
| processing-meta | no | 1 | 0 | placeholderのみ。旧処理の完全退役確認後に個別承認 |

ナトリは4バケット45登録・24,825,527 bytesを全件保持。
残る7バケット49登録・25,291,145 bytesは精査範囲であり、一括削除可能数ではない。
画像の共有・外部URL・証明書参照を行ごとに確定してから、削除対象を示す。
「画面に出ていない画像」は未使用の証明にはならない。

## 今回再実施した保全・復元照合

Libraryの `me-ish_Storage_Backup_2026-10-09.zip` 第2版を取得。
50,221,370 bytes、SHA256 `b78353aa26b08b3007f999406c4607852816fb7a1c889ec75146878344b7d6bb`。
同梱SHA256SUMSを全件検査し、同梱スクリプトを読んだうえで新規隔離ディレクトリへ復元した。

| 検査 | 結果 |
| --- | --- |
| ZIPのハッシュ | 保存記録と一致 |
| 通常画像 | 87件・50,116,672 bytes、size/SHA256/ETag一致 |
| multipart | 3件、保存した分割境界でETagを再計算し一致 |
| 空フォルダ | 元metadataの空MD5/sizeに基づく7件を隔離先のみで再構成 |
| 復元後 | 11バケット、94path・size/hash照合成功 |
| 所有者情報 | 元情報2登録を保持。APIによる所有者復元は未検証 |
| 現在の本番登録 | 11バケット・94object。元manifestに記録した全フィールド一致、追加/欠落なし |
| Storageポリシー | 元13件は全件一致。既存の停止ポリシー2件だけ追加され計15件 |

追加ポリシーは `legacy_stop_storage_insert` と `legacy_stop_storage_update`。
10月9日の旧サービス停止で追加された既知のもの。旧バックアップの13ポリシーだけを
再投入すると停止境界を失うため、復元時は現在の停止migration/operationsも適用して照合する。

## 未完了の復元条件

今回成功したのはファイル本体のオフライン復元と本番metadataとの照合。
以下は**未検証**であり、永久削除の前提を満たしたとは扱わない。

1. 隔離SupabaseへのStorage APIでの再投入と、owner/owner_idの保存確認。
2. 全現行ポリシー・ACL・設定の再現、匿名・無関係ユーザーの非公開読取/書込拒否。
3. 管理者の正規アップロード/署名URL、相談添付、納品、実アプリの参照先確認。
4. 最新DBバックアップからの復元・現在の713行/定義/関数/制約/参照整合性照合。
5. Stripe側の未完了処理や既存購入対応の保存要件確認。

以前の一時DB復元（63表711行一致）は整理計画の実施記録を参照したもので、今回再実行していない。
当時の検証projectはユーザー承認で削除済み。本番や停止中の他projectを試験先に使わない。
この環境にはDocker/Postgres/Storageの隔離サービスがなく、連携にもStorage再投入操作はない。
追加費用の発生するprojectや権限変更は今回行わず、既存の正規認証を持つ隔離先の確定を次の条件とする。
接続パスワードやservice roleをチャットへ貼る必要はない。

## 次の承認単位

- **コード本番反映**: PR #152最終headの検証結果と差分を確認してから。
- **機能復元の実施環境**: 別Supabaseの利用・必要なら提示された短時間費用。作成前に確認。
- **永久削除**: 上記機能復元完了後、表/行/bucket/path・保持先・失う機能を一覧化し、別途事前確認。
  本資料の候補一覧そのものは削除承認ではない。


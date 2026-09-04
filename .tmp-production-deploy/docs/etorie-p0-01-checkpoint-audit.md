# エトリエ P0-01 checkpoint監査台帳

監査日: 2026-07-23（JST）
対象branch: `chore/etorie-p0-baseline-artifacts`
対象: checkpoint commit前のtracked / untracked全差分

## 1. 初期監査と除外

初期worktreeは153 path変更だった。分類はpath単位であり、旧55 migrationの削除元と追加先をそれぞれ1 pathとして数える。

| classification | count | disposition |
| --- | ---: | --- |
| `expected_baseline_artifact` | 3 | commit対象 |
| `expected_security_hardening` | 1 | commit対象 |
| `expected_portfolio_profiles_removal` | 4 | commit対象 |
| `expected_legacy_archive` | 115 | 55 source + 55 archive + manifest/README/artifact 5。commit対象 |
| `expected_test_or_script` | 9 | commit対象 |
| `expected_documentation` | 19 | commit対象 |
| `generated_temp_file` | 1 | `supabase/.temp/cli-latest`。空になったCLI一時metadataをHEADへ復元 |
| `unrelated_change` | 1 | `src/features/etorie/lib/demoWorkspace.ts`。demo実績日時の機能変更をHEADへ復元 |
| `unexplained_change` | 0 | なし |
| `secret_or_sensitive` | 0 | なし |
| **total** | **153** | 2 pathを除外 |

`supabase/.temp/cli-latest`は既にtrackedで、baseline artifactに不要なため`.gitignore`は変更せず復元した。
`demoWorkspace.ts`の差分はcompleted demo rowへ入金・完了日時を加えるもので、DB baseline、fixture、`portfolio_profiles`廃止のいずれにも必要ではなく、アプリ挙動を変えるため除外した。

文書監査で見つけたarchive前pathの古い記述は、ADRやhybrid方針を変えず、現在の`supabase/legacy-migrations/`へ整合させた。

## 2. 最終commit対象の分類

Git rename検出後のlogical file数は97件を期待する。

| classification | logical files |
| --- | ---: |
| `expected_baseline_artifact` | 3 |
| `expected_security_hardening` | 1 |
| `expected_portfolio_profiles_removal` | 4 |
| `expected_legacy_archive` | 60 |
| `expected_test_or_script` | 9 |
| `expected_documentation` | 20 |
| `generated_temp_file` | 0 |
| `unexplained_change` | 0 |
| `secret_or_sensitive` | 0 |
| `unrelated_change` | 0 |
| **total** | **97** |

## 3. non-legacy file台帳

| path | classification | 理由・必要性 |
| --- | --- | --- |
| `supabase/migrations/20260723111730_etorie_baseline.sql` | `expected_baseline_artifact` | current catalogをfresh環境へ再現するactive baseline。 |
| `supabase/baseline/manifest.json` | `expected_baseline_artifact` | active/legacy lane、順序、件数、checksumの正本。 |
| `supabase/fixtures/etorie-baseline.sql` | `expected_baseline_artifact` | 非本番guard付きの再現可能な検証fixture。 |
| `supabase/migrations/20260723111741_baseline_security_hardening.sql` | `expected_security_hardening` | Storage、grant、soft-delete RPC、Card/AURA RLSを独立適用するhardening。 |
| `src/app/[locale]/mypage/portfolio/PortfolioSettingsClient.tsx` | `expected_portfolio_profiles_removal` | 不在tableではなくportfolio_settingsをsource of truthとして使用。 |
| `src/app/api/account/delete/route.ts` | `expected_portfolio_profiles_removal` | 不在tableをCASCADE対象と説明する古いcommentを除去。 |
| `src/lib/portfolio/queries.ts` | `expected_portfolio_profiles_removal` | portfolio_profiles向け未使用query/write helperを除去。 |
| `src/lib/portfolio/types.ts` | `expected_portfolio_profiles_removal` | 廃止schemaだけを表す型を除去。 |
| `artifacts/legacy-migration-archive/before.json` | `expected_legacy_archive` | 移動前のrelative path、size、raw-byte SHA-256証跡。 |
| `artifacts/legacy-migration-archive/after.json` | `expected_legacy_archive` | 移動後のrelative path、size、raw-byte SHA-256証跡。 |
| `artifacts/legacy-migration-archive/verification.json` | `expected_legacy_archive` | 55/55一致、欠落・余分・content change 0の検証結果。 |
| `supabase/baseline/legacy-migrations.json` | `expected_legacy_archive` | 旧55件とremote-only 3件のauthoritative ledger。 |
| `supabase/legacy-migrations/README.md` | `expected_legacy_archive` | evidence-onlyでありreplay laneではないことを固定。 |
| `package.json` | `expected_test_or_script` | static check、typecheck、checksum/diffの再現可能なscript entry。 |
| `scripts/etorie-baseline-pattern-b.mjs` | `expected_test_or_script` | active laneだけを対象にする非本番Pattern B helper。 |
| `scripts/etorie-baseline-pattern-c.mjs` | `expected_test_or_script` | review済みhistory/rollback SQLがなければ停止するPattern C helper。 |
| `scripts/etorie-baseline-static-check.mjs` | `expected_test_or_script` | active/legacy/checksum/security contractの静的gate。 |
| `scripts/etorie-schema-checksum.mjs` | `expected_test_or_script` | 検証環境catalogの正規化checksum helper。 |
| `scripts/etorie-schema-diff.mjs` | `expected_test_or_script` | 正規化snapshotの差分分類helper。 |
| `scripts/lib/etorie-pattern-runner.mjs` | `expected_test_or_script` | target guardとactive migration sourceの共通runner。 |
| `scripts/lib/etorie-schema-artifacts.mjs` | `expected_test_or_script` | checksum、正規化、target guardの共通utility。 |
| `src/lib/__tests__/etorie-schema-artifacts.test.ts` | `expected_test_or_script` | archive、active順序、production guardのunit test。 |
| `docs/etorie-p0-01-20250124-investigation.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-backup-rollback-checklist.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-baseline-spec.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-baseline.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-checkpoint-audit.md` | `expected_documentation` | 全差分の分類、除外判断、検証結果を保存するcheckpoint監査台帳。 |
| `docs/etorie-p0-01-dry-run-runbook.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-history-strategy.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-migration-baseline-ledger.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-portfolio-profiles-removal.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-release-gate.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-security-followups.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-01-version-normalization-plan.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-p0-02-domain-decisions.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-phase0-gap-analysis.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-phase0-migration-plan.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-phase0-target-design.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/etorie-phase1-work-items.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/migration-recovery/20260214050324.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/migration-recovery/20260223113216.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |
| `docs/migration-recovery/20260225122344.md` | `expected_documentation` | Phase 0の調査、決定、baseline設計、release/rollbackまたはremote-only回収証跡。 |

## 4. 旧55 migration rename台帳

同名archiveのraw-byte SHA-256はbefore artifact、after artifact、legacy manifest、Git HEAD blobの4方向で55/55一致した。

| rename | classification | 理由・必要性 |
| --- | --- | --- |
| `supabase/migrations/20250120_entry_processing_jobs.sql` → `supabase/legacy-migrations/20250120_entry_processing_jobs.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20250124_mypage_extension.sql` → `supabase/legacy-migrations/20250124_mypage_extension.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20250125_sales_payout_management.sql` → `supabase/legacy-migrations/20250125_sales_payout_management.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20250201_ending_soon_notification.sql` → `supabase/legacy-migrations/20250201_ending_soon_notification.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260131_profile_banner_focus.sql` → `supabase/legacy-migrations/20260131_profile_banner_focus.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260201_entries_email_rls.sql` → `supabase/legacy-migrations/20260201_entries_email_rls.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260202_admin_entry_workflow_view.sql` → `supabase/legacy-migrations/20260202_admin_entry_workflow_view.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260203_entry_plan_payment.sql` → `supabase/legacy-migrations/20260203_entry_plan_payment.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260205_view_stats.sql` → `supabase/legacy-migrations/20260205_view_stats.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260206_entry_comments.sql` → `supabase/legacy-migrations/20260206_entry_comments.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260207_add_guarantee_and_daily_slots.sql` → `supabase/legacy-migrations/20260207_add_guarantee_and_daily_slots.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260208_fix_fee_rounding.sql` → `supabase/legacy-migrations/20260208_fix_fee_rounding.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260208_payout_tables.sql` → `supabase/legacy-migrations/20260208_payout_tables.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260208_performance_indexes.sql` → `supabase/legacy-migrations/20260208_performance_indexes.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260208_rls_unprotected_tables.sql` → `supabase/legacy-migrations/20260208_rls_unprotected_tables.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260209_admin_audit_log.sql` → `supabase/legacy-migrations/20260209_admin_audit_log.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260209_gallery_stats_rpc.sql` → `supabase/legacy-migrations/20260209_gallery_stats_rpc.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260210_end_notified_at.sql` → `supabase/legacy-migrations/20260210_end_notified_at.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_add_rls_deny_policies_server_only.sql` → `supabase/legacy-migrations/20260211_add_rls_deny_policies_server_only.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_artists_bank_accounts_rls.sql` → `supabase/legacy-migrations/20260211_artists_bank_accounts_rls.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_enable_rls_server_only_tables.sql` → `supabase/legacy-migrations/20260211_enable_rls_server_only_tables.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_entries_update_own_policy.sql` → `supabase/legacy-migrations/20260211_entries_update_own_policy.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_aura_select_own_email_policy.sql` → `supabase/legacy-migrations/20260211_fix_aura_select_own_email_policy.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_function_search_path.sql` → `supabase/legacy-migrations/20260211_fix_function_search_path.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_rls_inquiries_insert.sql` → `supabase/legacy-migrations/20260211_fix_rls_inquiries_insert.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_rls_policies_entries_inquiries.sql` → `supabase/legacy-migrations/20260211_fix_rls_policies_entries_inquiries.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_sales_select_buyer_policy.sql` → `supabase/legacy-migrations/20260211_fix_sales_select_buyer_policy.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_security_advisor_remaining_views.sql` → `supabase/legacy-migrations/20260211_fix_security_advisor_remaining_views.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_security_advisor_views.sql` → `supabase/legacy-migrations/20260211_fix_security_advisor_views.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_v_pending_payouts_security_invoker.sql` → `supabase/legacy-migrations/20260211_fix_v_pending_payouts_security_invoker.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_fix_view_grants_minimal.sql` → `supabase/legacy-migrations/20260211_fix_view_grants_minimal.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_move_citext_to_extensions_schema.sql` → `supabase/legacy-migrations/20260211_move_citext_to_extensions_schema.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260211_mypage_rls_sales_and_jobs.sql` → `supabase/legacy-migrations/20260211_mypage_rls_sales_and_jobs.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260308_get_auth_user_id_by_email.sql` → `supabase/legacy-migrations/20260308_get_auth_user_id_by_email.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260523_natori_projects.sql` → `supabase/legacy-migrations/20260523_natori_projects.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260524_natori_events.sql` → `supabase/legacy-migrations/20260524_natori_events.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260524_natori_project_flow.sql` → `supabase/legacy-migrations/20260524_natori_project_flow.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260525_natori_user_profiles.sql` → `supabase/legacy-migrations/20260525_natori_user_profiles.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260526_natori_pricing_configs.sql` → `supabase/legacy-migrations/20260526_natori_pricing_configs.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260527_natori_unified_character_tasks.sql` → `supabase/legacy-migrations/20260527_natori_unified_character_tasks.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260528_natori_illustration_rough_submit.sql` → `supabase/legacy-migrations/20260528_natori_illustration_rough_submit.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260710_natori_portfolio_content.sql` → `supabase/legacy-migrations/20260710_natori_portfolio_content.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260711_natori_closed_status.sql` → `supabase/legacy-migrations/20260711_natori_closed_status.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260713_natori_page_events.sql` → `supabase/legacy-migrations/20260713_natori_page_events.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260714_natori_links_content.sql` → `supabase/legacy-migrations/20260714_natori_links_content.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260716_natori_payment_link_columns.sql` → `supabase/legacy-migrations/20260716_natori_payment_link_columns.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260716_processed_stripe_events.sql` → `supabase/legacy-migrations/20260716_processed_stripe_events.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260717_natori_client_email_and_mail_logs.sql` → `supabase/legacy-migrations/20260717_natori_client_email_and_mail_logs.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260717_natori_quote_acceptance.sql` → `supabase/legacy-migrations/20260717_natori_quote_acceptance.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260720_natori_delivery.sql` → `supabase/legacy-migrations/20260720_natori_delivery.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/202607200001_natori_beta_safety.sql` → `supabase/legacy-migrations/202607200001_natori_beta_safety.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/202607200002_natori_backfill_legacy_completed_results.sql` → `supabase/legacy-migrations/202607200002_natori_backfill_legacy_completed_results.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260720102549_harden_natori_rpc_privileges.sql` → `supabase/legacy-migrations/20260720102549_harden_natori_rpc_privileges.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260720103406_add_natori_project_soft_delete.sql` → `supabase/legacy-migrations/20260720103406_add_natori_project_soft_delete.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |
| `supabase/migrations/20260720104033_harden_natori_data_api_and_indexes.sql` → `supabase/legacy-migrations/20260720104033_harden_natori_data_api_and_indexes.sql` | `expected_legacy_archive` | filename・version・raw bytesを変えないevidence rename。 |

## 5. secret / sensitive監査

- `.env` / `.env.local`は開いておらず、変更・stage対象でもない。
- candidate fileを値非表示で走査し、`sb_secret_`、`sb_publishable_`、JWT、credential付きPostgres URI、private key、`DATABASE_URL=`実値、`SUPABASE_SERVICE_ROLE_KEY=`実値は0件。
- `service_role`はPostgres role名または環境変数名としての参照だけで、key実値はない。
- archive artifactはrelative repository path、filename、version、size、SHA-256、分類だけを保持し、絶対path、接続文字列、個人emailを含まない。
- production project ref/API URLの記録は接続先識別用の非secret metadataで、password・API keyを伴わない。

## 6. baseline整合性

- strategy: `hybrid`
- active migration: baseline、直後のsecurity hardeningの2件
- active duplicate version: 0
- legacy local migration: 55件、evidence-only / unsupported
- remote-only: 3件、active migration化なし
- `portfolio_profiles`: 廃止、active runtime参照なし、baseline対象外
- Pattern B: manifest-listed active laneだけを連続適用
- Pattern C: review済みhistory transition SQLとrollback SQLがなければ`blocked_missing_reviewed_history_transition_sql`
- production変更: 不可

## 7. checkpoint前検証

| check | result |
| --- | --- |
| `npm run check:etorie-migrations` | PASS。active 2、legacy 55、checksum/security contract一致 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS、error 0。既存warningのみ |
| `npm test` | PASS、38 files / 435 tests |
| `npm run build` | PASS、169 static pages |
| old/archive raw-byte SHA-256 | PASS、55/55 |
| Git HEAD/archive blob | PASS、55/55 |
| secret scan | PASS、実値0 |
| Supabase/project connection | 未実施 |
| DDL / DML / history / Storage変更 | 未実施 |
| `.env.local`変更 | なし |
| push / PR / remote branch変更 | 未実施 |

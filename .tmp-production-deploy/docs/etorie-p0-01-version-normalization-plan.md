# エトリエ P0-01 version正規化計画

調査日: 2026-07-23（JST）
対象: `supabase/legacy-migrations/`へarchiveした旧migrationの重複version 6グループ

## 1. 結論

- Git commitの祖先関係により、6グループ中`20260209`、`20260524`、`20260716`、`20260717`はファイル間の順序を確定できた。
- `20260208`は4件中2件、`20260211`は15件中4件だけを一意な順序へ配置できる。同一commitで追加され、相互SQL依存がないファイルの順序は確定できない。
- 確定できた行には、Git author時刻をUTCへ変換した非衝突14桁versionを記録した。これは将来比較用のproposalであり、migration fileのrenameを承認しない。
- 推奨履歴戦略はbaseline中心の`hybrid`であるため、順序が確定した重複migrationも個別replayせず`include_in_baseline_only`とする。順序不明行は`cannot_determine`のままlegacy evidenceとして保持する。

## 2. 判定ルール

1. filenameの辞書順は証拠にしない。
2. 同一commit内のfile追加順はGitが保証しないため、SQL依存で一意にならない限り順序不明とする。
3. 異なるcommitは`git merge-base --is-ancestor`で直列関係を確認した。
4. checksumのauthoritative sourceは、archive pathにある現在のGit blobの正準byte列に対するSHA-256である。文字列としての読込、改行正規化、encoding変換は行わない。
5. `proposed version`の時刻はGit author時刻のUTC。14桁versionが現在の全ローカルversionおよびremote 5 versionと衝突しないことを確認対象とする。
6. `cannot_determine`行へ便宜的な秒を割り振らない。

`.gitattributes`の`supabase/** -text`により、現在のcheckoutではworking treeのarchive byte列をGit blobと同一に保つ。ここでいう「raw-byte」は正準Git blobをbyte列としてhashする意味であり、属性適用前のCRLF working treeや、OS依存のtext読込結果はauthoritativeではない。

## 3. 正規化台帳

| old version | old filename | proposed version | proposed filename | SQL checksum | dependency predecessor | evidence for order | treatment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20260208` | `20260208_fix_fee_rounding.sql` | `cannot_determine` | `cannot_determine` | `fe759d017c04b70051ec3b637040fc5fe12e5581678a3eb3bce69b5cbf8a5580` | `20250125_sales_payout_management.sql` | `payout_tables`と同じcommit `29e325aa`、相互依存なし | `cannot_determine` |
| `20260208` | `20260208_payout_tables.sql` | `cannot_determine` | `cannot_determine` | `834399d559dfc27f6e893930542acd2cc42c800717885d1945d10134b56e17f0` | `20250125_sales_payout_management.sql` | `fix_fee_rounding`と同じcommit `29e325aa`、相互依存なし | `cannot_determine` |
| `20260208` | `20260208_rls_unprotected_tables.sql` | `20260208032002` | `20260208032002_rls_unprotected_tables.sql` | `c3fb484185700e6c573c6fdd358ad1b475c32f65b2b3ff7986ddbab22b5408aa` | `29e325aa`の2ファイル | commit `f33a27e`。`29e325aa`の子孫、author `2026-02-08T03:20:02Z` | `include_in_baseline_only` |
| `20260208` | `20260208_performance_indexes.sql` | `20260208081553` | `20260208081553_performance_indexes.sql` | `369fe7bf17aaa0c12a4e0be8271520d1534e97621ebf3460dcf5e2189cba646c` | `20250124_mypage_extension.sql`ほか対象table作成migration | commit `983a2144`。`f33a27e`の子孫、author `2026-02-08T08:15:53Z` | `include_in_baseline_only` |
| `20260209` | `20260209_admin_audit_log.sql` | `20260208124947` | `20260208124947_admin_audit_log.sql` | `d418083469403e28712aaab5664b56b98457513af6916de6bc7d714f943b198f` | なし | commit `935ae5f`、author `2026-02-08T12:49:47Z` | `include_in_baseline_only` |
| `20260209` | `20260209_gallery_stats_rpc.sql` | `20260209110629` | `20260209110629_gallery_stats_rpc.sql` | `42a5d232391b94c7f80e6dd2de841c7a58e014962448b87b1a4a2d4f1680ba3f` | `entries` | commit `42a05ca`は`935ae5f`の子孫、author `2026-02-09T11:06:29Z` | `include_in_baseline_only` |
| `20260211` | `20260211_move_citext_to_extensions_schema.sql` | `cannot_determine` | `cannot_determine` | `facd07ef3cc20f90f5e12030e5cc9f3c39aadaab0ed375c900d5fcb4a17d37b1` | `citext` extension | `mypage_rls_sales_and_jobs`と同じcommit `a98b5f9`、相互依存なし | `cannot_determine` |
| `20260211` | `20260211_mypage_rls_sales_and_jobs.sql` | `cannot_determine` | `cannot_determine` | `4ae859a7d4b3398c501d5164d53b235c8fe1f5ead1711e014883d853908209ef` | `20250120_entry_processing_jobs.sql`、`20250125_sales_payout_management.sql` | `move_citext`と同じcommit `a98b5f9`、相互依存なし | `cannot_determine` |
| `20260211` | `20260211_enable_rls_server_only_tables.sql` | `cannot_determine` | `cannot_determine` | `e44e7188c733451920365a165584f41e9a2c5c43e56c07c9625081c61c0e2f3f` | 対象4 tableの作成migration | 5ファイルが同じcommit `56c154f`、相互順序を一意化する依存なし | `cannot_determine` |
| `20260211` | `20260211_fix_security_advisor_remaining_views.sql` | `cannot_determine` | `cannot_determine` | `2f67a6688640fbcbfaf9dbd26094aa0211438f296079c8b7e6c9b5b174af2069` | 対象viewの作成migration | 5ファイルが同じcommit `56c154f`、grant変更が同group内で重なる | `cannot_determine` |
| `20260211` | `20260211_fix_security_advisor_views.sql` | `cannot_determine` | `cannot_determine` | `d1ebe4c14b524262c4c9cef9b8e14fc4cba5810d6db1e6826e50e35846721473` | `20250125_sales_payout_management.sql`、`20260205_view_stats.sql` | 5ファイルが同じcommit `56c154f`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_v_pending_payouts_security_invoker.sql` | `cannot_determine` | `cannot_determine` | `ab43afa70b4cbf9f220926a9d45d2e0a5e95e3940385c9e5c33cb6b33123d2c6` | `20250125_sales_payout_management.sql` | 5ファイルが同じcommit `56c154f`、同じviewを扱う別fileとの順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_view_grants_minimal.sql` | `cannot_determine` | `cannot_determine` | `a028823cf8a987ec9438855fc7d2c8fc7f85fbecc7a394bb493eb6b214550808` | 対象viewの作成migration | 5ファイルが同じcommit `56c154f`、`remaining_views`とgrant変更が重なる | `cannot_determine` |
| `20260211` | `20260211_add_rls_deny_policies_server_only.sql` | `cannot_determine` | `cannot_determine` | `dd5e94320f7469a1dbf3c071821f18e8d486d62adc4bfa0eeb8e5104c471eb2e` | `20260208_payout_tables.sql`ほか対象table作成migration | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_function_search_path.sql` | `cannot_determine` | `cannot_determine` | `501297f4e458b0635efa8aa7f291395b6dc8bbc9f6f36e29a40a87ded2d84b03e` | `20260209_gallery_stats_rpc.sql`ほか対象function作成migration | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_rls_inquiries_insert.sql` | `cannot_determine` | `cannot_determine` | `6f7a6058314c44c4233f35682807f9f9da5f15b0c0b2d112ca32afe09afa6de2` | `20260208_rls_unprotected_tables.sql` | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_rls_policies_entries_inquiries.sql` | `cannot_determine` | `cannot_determine` | `dbce3907eb693f56164c59438614c1986406dfaa8ef731f43fce23cfdb21a952` | entries/inquiriesのRLS有効化 | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_artists_bank_accounts_rls.sql` | `20260211040740` | `20260211040740_artists_bank_accounts_rls.sql` | `34c18e8844f3ae316015da2b05f6ceb23655a7d32b5ac6ea202ff41617c2a147` | `20260211_add_rls_deny_policies_server_only.sql` | commit `9a5d25a`は`62b8e7a`の子孫、author `2026-02-11T04:07:40Z` | `include_in_baseline_only` |
| `20260211` | `20260211_fix_sales_select_buyer_policy.sql` | `20260211045226` | `20260211045226_fix_sales_select_buyer_policy.sql` | `d5ebfd04e9c88b259b4c45765ab2af6deba42b2a45fce196ef4c637b1fe9aa3e` | `20260211_mypage_rls_sales_and_jobs.sql` | commit `9ed180e`は`9a5d25a`の子孫、author `2026-02-11T04:52:26Z` | `include_in_baseline_only` |
| `20260211` | `20260211_fix_aura_select_own_email_policy.sql` | `20260211050925` | `20260211050925_fix_aura_select_own_email_policy.sql` | `b4f0eea4103ca5c1b53b9708fc184757e5aca24a974aee15777d388acac8db41` | `20260208_rls_unprotected_tables.sql` | commit `a43189e`は`9ed180e`の子孫、author `2026-02-11T05:09:25Z` | `include_in_baseline_only` |
| `20260211` | `20260211_entries_update_own_policy.sql` | `20260211053832` | `20260211053832_entries_update_own_policy.sql` | `eb46e5964885b088ef87de215c8f8d9407058744680f6a1747b9f3536e2e2490` | `20260211_fix_rls_policies_entries_inquiries.sql` | commit `c88258f`は`a43189e`の子孫、author `2026-02-11T05:38:32Z` | `include_in_baseline_only` |
| `20260524` | `20260524_natori_events.sql` | `20260523062917` | `20260523062917_natori_events.sql` | `101eaf46fad043c2dc6967641a84016513961361c1718cebee87989c753ec3cd` | `auth.users` | commit `9c6f1d1`、author `2026-05-23T06:29:17Z` | `include_in_baseline_only` |
| `20260524` | `20260524_natori_project_flow.sql` | `20260524084336` | `20260524084336_natori_project_flow.sql` | `e3f9cb4a5008e89c92d50650f2306d8f4ed45af4b67372316dcc34f556f308b1` | `20260523_natori_projects.sql` | commit `8fa480e`は`9c6f1d1`の子孫、author `2026-05-24T08:43:36Z` | `include_in_baseline_only` |
| `20260716` | `20260716_processed_stripe_events.sql` | `20260716130400` | `20260716130400_processed_stripe_events.sql` | `289bcf02c5cf069e16717341781dba2f3275fac49b37c5b0ec44d3091ed2b4b5` | なし | commit `3816b42`、author `2026-07-16T13:04:00Z` | `include_in_baseline_only` |
| `20260716` | `20260716_natori_payment_link_columns.sql` | `20260716132047` | `20260716132047_natori_payment_link_columns.sql` | `633b3d0a3771b625852843616e332f6992795b0942647bdad056c5118543dcb8` | `20260523_natori_projects.sql` | commit `a59ed94`は`3816b42`の子孫、author `2026-07-16T13:20:47Z` | `include_in_baseline_only` |
| `20260717` | `20260717_natori_client_email_and_mail_logs.sql` | `20260716202346` | `20260716202346_natori_client_email_and_mail_logs.sql` | `5c50284f0ab559e77709321a68926fd967217e87fcaef4180beafaf2574730eb` | `20260523_natori_projects.sql` | commit `f2ce961`、author `2026-07-16T20:23:46Z` | `include_in_baseline_only` |
| `20260717` | `20260717_natori_quote_acceptance.sql` | `20260716215944` | `20260716215944_natori_quote_acceptance.sql` | `6fe7a1dced8488ecbbc1c23c223da42346757bebf571829b2c6d2058d3beda3f` | `20260523_natori_projects.sql` | commit `72939a0`は`f2ce961`の子孫、author `2026-07-16T21:59:44Z` | `include_in_baseline_only` |

## 4. 運用上の扱い

- 上表はrename指示ではない。今回はmigration fileを作成、変更、rename、削除していない。
- `cannot_determine`を解消するには、当時のPR artifact、CI log、作業者記録など、同一commit内の実行順を示す追加証拠が必要である。
- baseline方式では現在の最終schemaを依存順に再定義するため、legacy file間の曖昧な順序を捏造する必要がない。
- 将来legacy replay方式へ変更する場合は、各`include_in_baseline_only`を`rename_for_future_replay`へ変更する前に、全55 migrationのfresh database replayとdata migrationレビューを別途完了させる。

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
4. checksumは現在のローカルファイルbyte列に対するSHA-256である。
5. `proposed version`の時刻はGit author時刻のUTC。14桁versionが現在の全ローカルversionおよびremote 5 versionと衝突しないことを確認対象とする。
6. `cannot_determine`行へ便宜的な秒を割り振らない。

## 3. 正規化台帳

| old version | old filename | proposed version | proposed filename | SQL checksum | dependency predecessor | evidence for order | treatment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20260208` | `20260208_fix_fee_rounding.sql` | `cannot_determine` | `cannot_determine` | `b43af227fa72805c667fc36efef020200f4e344a90d126ce1ddfd669ef1f031c` | `20250125_sales_payout_management.sql` | `payout_tables`と同じcommit `29e325aa`、相互依存なし | `cannot_determine` |
| `20260208` | `20260208_payout_tables.sql` | `cannot_determine` | `cannot_determine` | `eb950b532a42e6dbc8fcd42a387b705e75d164b1d5dc755407e2f849c6eb3070` | `20250125_sales_payout_management.sql` | `fix_fee_rounding`と同じcommit `29e325aa`、相互依存なし | `cannot_determine` |
| `20260208` | `20260208_rls_unprotected_tables.sql` | `20260208032002` | `20260208032002_rls_unprotected_tables.sql` | `6a6b4df4bbb18b49db04c91154f9e7d150fa9bdf69f35f587a70f978c527010b` | `29e325aa`の2ファイル | commit `f33a27e`。`29e325aa`の子孫、author `2026-02-08T03:20:02Z` | `include_in_baseline_only` |
| `20260208` | `20260208_performance_indexes.sql` | `20260208081553` | `20260208081553_performance_indexes.sql` | `9a135bfb75493d314f25c1b8eaf1c37946fa92e3aa1f7982e45c8da069c75122` | `20250124_mypage_extension.sql`ほか対象table作成migration | commit `983a2144`。`f33a27e`の子孫、author `2026-02-08T08:15:53Z` | `include_in_baseline_only` |
| `20260209` | `20260209_admin_audit_log.sql` | `20260208124947` | `20260208124947_admin_audit_log.sql` | `305da6271ee0e7e446baf9a6bf47a1e9ad88fe2265581a752ddba6cd20ddb07f` | なし | commit `935ae5f`、author `2026-02-08T12:49:47Z` | `include_in_baseline_only` |
| `20260209` | `20260209_gallery_stats_rpc.sql` | `20260209110629` | `20260209110629_gallery_stats_rpc.sql` | `abcbdb5570d7420a0c146efbfab0aab945fb2fdda4e1d3d343cc1078feb316bf` | `entries` | commit `42a05ca`は`935ae5f`の子孫、author `2026-02-09T11:06:29Z` | `include_in_baseline_only` |
| `20260211` | `20260211_move_citext_to_extensions_schema.sql` | `cannot_determine` | `cannot_determine` | `743eb942aa709c899d7bbfe47286698c7902a85fad310f87b4cae0cbe703948c` | `citext` extension | `mypage_rls_sales_and_jobs`と同じcommit `a98b5f9`、相互依存なし | `cannot_determine` |
| `20260211` | `20260211_mypage_rls_sales_and_jobs.sql` | `cannot_determine` | `cannot_determine` | `d04430feeba6dec1857fcca922dd31f0ec2fe79a203df6ae1e0ba0655a1081d7` | `20250120_entry_processing_jobs.sql`、`20250125_sales_payout_management.sql` | `move_citext`と同じcommit `a98b5f9`、相互依存なし | `cannot_determine` |
| `20260211` | `20260211_enable_rls_server_only_tables.sql` | `cannot_determine` | `cannot_determine` | `b4d8a0fea527ee715e2c0f594d9aacab2202581e946cdaa1608260423efa84a5` | 対象4 tableの作成migration | 5ファイルが同じcommit `56c154f`、相互順序を一意化する依存なし | `cannot_determine` |
| `20260211` | `20260211_fix_security_advisor_remaining_views.sql` | `cannot_determine` | `cannot_determine` | `ebe64b7acef4a5d2fdad498e0498c0b08cd12b08a3f3baf0726dac2f17bd917b` | 対象viewの作成migration | 5ファイルが同じcommit `56c154f`、grant変更が同group内で重なる | `cannot_determine` |
| `20260211` | `20260211_fix_security_advisor_views.sql` | `cannot_determine` | `cannot_determine` | `7bf2f2f5040849e1486d11b021d10ccf526f713fd3f27002a2be909ff3350795` | `20250125_sales_payout_management.sql`、`20260205_view_stats.sql` | 5ファイルが同じcommit `56c154f`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_v_pending_payouts_security_invoker.sql` | `cannot_determine` | `cannot_determine` | `1290d8239f904e362caee9b3157759712c0a792a77a723ba439925e76ee8dc20` | `20250125_sales_payout_management.sql` | 5ファイルが同じcommit `56c154f`、同じviewを扱う別fileとの順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_view_grants_minimal.sql` | `cannot_determine` | `cannot_determine` | `61e3100f6003abb5bd92122cd65dbd6f952f06db771a6b827b7a2334c3b31265` | 対象viewの作成migration | 5ファイルが同じcommit `56c154f`、`remaining_views`とgrant変更が重なる | `cannot_determine` |
| `20260211` | `20260211_add_rls_deny_policies_server_only.sql` | `cannot_determine` | `cannot_determine` | `1e36a83377b8ef278dd252a23df0d4eb5c1845d9fab2728447e3e088a52e5345` | `20260208_payout_tables.sql`ほか対象table作成migration | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_function_search_path.sql` | `cannot_determine` | `cannot_determine` | `15a4c1eee3bbff6c841e9ba41ed1bf11d15f6037f5c9b78ce2a3c2e548e0364e` | `20260209_gallery_stats_rpc.sql`ほか対象function作成migration | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_rls_inquiries_insert.sql` | `cannot_determine` | `cannot_determine` | `6bb512797c7e8c35185b16844b168bc5c67711369774985350ccdb2dc4dfccff` | `20260208_rls_unprotected_tables.sql` | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_fix_rls_policies_entries_inquiries.sql` | `cannot_determine` | `cannot_determine` | `78aea32cbfc4e04124c5fe729b1b812c236d2dc2f2b26824be8cecd8deb5edea` | entries/inquiriesのRLS有効化 | 4ファイルが同じcommit `62b8e7a`、相互順序不明 | `cannot_determine` |
| `20260211` | `20260211_artists_bank_accounts_rls.sql` | `20260211040740` | `20260211040740_artists_bank_accounts_rls.sql` | `fde4124f26e309f164c13a29ea517c722db3dcd2d9eb89a3a2a2f8cb4cf2f82b` | `20260211_add_rls_deny_policies_server_only.sql` | commit `9a5d25a`は`62b8e7a`の子孫、author `2026-02-11T04:07:40Z` | `include_in_baseline_only` |
| `20260211` | `20260211_fix_sales_select_buyer_policy.sql` | `20260211045226` | `20260211045226_fix_sales_select_buyer_policy.sql` | `dad1db56f51d7074f21d6b0a8983151db1975ba6f878cc129d1e0236db7352fa` | `20260211_mypage_rls_sales_and_jobs.sql` | commit `9ed180e`は`9a5d25a`の子孫、author `2026-02-11T04:52:26Z` | `include_in_baseline_only` |
| `20260211` | `20260211_fix_aura_select_own_email_policy.sql` | `20260211050925` | `20260211050925_fix_aura_select_own_email_policy.sql` | `3c2566bb7bf4b547307c613cf558a815e71a2007f9eba4fd3d9695ee63466b45` | `20260208_rls_unprotected_tables.sql` | commit `a43189e`は`9ed180e`の子孫、author `2026-02-11T05:09:25Z` | `include_in_baseline_only` |
| `20260211` | `20260211_entries_update_own_policy.sql` | `20260211053832` | `20260211053832_entries_update_own_policy.sql` | `e611f73608c07d1c75944bd6102ddd3c73d6c58e38178c5e232507d6dc6be32e` | `20260211_fix_rls_policies_entries_inquiries.sql` | commit `c88258f`は`a43189e`の子孫、author `2026-02-11T05:38:32Z` | `include_in_baseline_only` |
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

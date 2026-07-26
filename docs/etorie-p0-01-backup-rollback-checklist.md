# エトリエ P0-01 backup / rollback checklist

作成日: 2026-07-23（JST）
status: `operator_confirmation_required`

## 1. 固定情報

| item | value |
| --- | --- |
| production Supabase project ref | `lvnfspyainrxtztjytbo` |
| production Vercel project | `me-ishs-projects/me-ish-homepage-vsiv` |
| proposed history strategy | `hybrid` |
| production operation authorized | no |
| local baseline artifact | `20260723111730_etorie_baseline.sql` |
| local hardening artifact | `20260723111741_baseline_security_hardening.sql` |
| checksum manifest | `supabase/baseline/manifest.json` |

## 2. ownership

| role | assignee | required authority |
| --- | --- | --- |
| executor | `operator_confirmation_required` | Supabase history操作権限 |
| approver | `operator_confirmation_required` | executorと別担当、release承認権限 |
| rollback owner | `operator_confirmation_required` | restore/traffic switch判断権限 |
| application owner | `operator_confirmation_required` | Vercel rollback/feature flag権限 |
| security reviewer | `operator_confirmation_required` | RLS/ACL/Storage policy承認 |
| incident contact | `operator_confirmation_required` | maintenance window中の即時連絡 |

executor、approver、rollback ownerを同一人物にしない。

## 3. plan / backup / PITR

| check | current value | pass condition |
| --- | --- | --- |
| Supabase plan | `operator_confirmation_required` | plan名とbackup機能をscreen/exportで保存 |
| scheduled database backup | `operator_confirmation_required` | latest successful backup ID/timeを確認 |
| PITR enabled | `operator_confirmation_required` | enabled表示とrestore可能windowを確認 |
| retention | `operator_confirmation_required` | 最古/最新restore可能時刻をUTCで保存 |
| backup encryption/access | `operator_confirmation_required` | restore担当が必要権限を持つ |
| pre-change restore point | `operator_confirmation_required` | maintenance開始直前のpoint/backup ID |
| restore destination | `operator_confirmation_required` | new projectかin-placeかを承認 |
| restore rehearsal | `operator_confirmation_required` | verification環境で成功artifactあり |
| schema history export | `operator_confirmation_required` | remote 5 rowのstatement/checksumを保存 |
| catalog snapshot | `operator_confirmation_required` | baseline specの全query出力を保存 |

database backup/PITRだけではStorage object本体、Storage settings、Auth settings、Edge Functions、API key等を完全に復元できない。これらは別checkを必須とする。

## 4. Storage backup

| check | current value | pass condition |
| --- | --- | --- |
| bucket manifest | known: 9 buckets | id/public/limit/MIMEのchecksumを保存 |
| bucket policy snapshot | `operator_confirmation_required` | `pg_policies`のdefinition checksumを保存 |
| bucket object inventory | `operator_confirmation_required` | bucket別count/bytes/最新更新時刻 |
| object backup location | `operator_confirmation_required` | DBと障害domainが異なる保管先 |
| object checksum method | `operator_confirmation_required` | path、size、ETag/hashのmanifest |
| private object restore test | `operator_confirmation_required` | signed URLを含むpositive/negative test |
| public object restore test | `operator_confirmation_required` | public URLとcache behavior確認 |
| orphan/missing comparison | `operator_confirmation_required` | pre/post manifest diff 0 |

対象bucket:

`artworks`、`aura-assets`、`avatars`、`banners`、`card-assets`、`natori-deliveries`、`natori-inquiry-refs`、`natori-portfolio`、`processing-meta`。

## 5. Vercel rollback

| check | current value | pass condition |
| --- | --- | --- |
| current production deployment ID | `operator_confirmation_required` | rollback可能なdeploymentを固定 |
| previous compatible deployment ID | `operator_confirmation_required` | baseline前後両schemaとの互換範囲を確認 |
| rollback command/UI procedure | `operator_confirmation_required` | rehearsal済み |
| environment variable snapshot | `operator_confirmation_required` | secret値をdocumentへ出さず、name/target/versionだけ保存 |
| Supabase URL switch procedure | `operator_confirmation_required` | restore project切替時の手順と承認者 |
| DNS/custom domain impact | `operator_confirmation_required` | TTLと切替責任者 |
| cache invalidation | `operator_confirmation_required` | stale schema/API response除去手順 |

Production environment variableを今回変更しない。

## 6. feature flag / maintenance

| check | current value | pass condition |
| --- | --- | --- |
| write freeze method | `operator_confirmation_required` | Natori/Stripe/Card/AURAのwrite抑止方法 |
| feature flag name | `operator_confirmation_required` | owner、default、rollback behaviorを記録 |
| Stripe webhook handling | `operator_confirmation_required` | pauseしない場合のqueue/retry/dedup方針 |
| mail sending handling | `operator_confirmation_required` | duplicate送信防止 |
| maintenance window | `operator_confirmation_required` | JST/UTCの開始終了 |
| user communication | `operator_confirmation_required` | 必要性と担当 |

## 7. RTO / RPO / contact

| item | value |
| --- | --- |
| database RTO | `operator_confirmation_required` |
| application RTO | `operator_confirmation_required` |
| database RPO | `operator_confirmation_required` |
| Storage RPO | `operator_confirmation_required` |
| history-only rollback target time | `operator_confirmation_required` |
| incident channel | `operator_confirmation_required` |
| primary contact | `operator_confirmation_required` |
| escalation contact | `operator_confirmation_required` |
| Supabase support route | `operator_confirmation_required` |
| Vercel support route | `operator_confirmation_required` |

## 8. pre-change snapshot

- [ ] exact Git commit SHA
- [ ] `supabase/baseline/manifest.json`記載のbaseline/hardening/fixture SHA-256を再計算して一致
- [ ] `supabase/baseline/legacy-migrations.json`のlocal 55 migration checksumを再計算して一致
- [ ] duplicate normalization ledger checksum
- [ ] remote 5 history row export and statement checksum
- [ ] public/storage relation/column/default
- [ ] constraint/index/trigger/view definition
- [ ] RLS/policy/table and function ACL
- [ ] function identity/body/SECURITY DEFINER/search_path
- [ ] extension name/schema/version
- [ ] table row count
- [ ] bucket setting/object count/object manifest
- [ ] Advisor results
- [ ] Vercel deployment/environment target metadata
- [ ] latest backup ID/PITR restore point

snapshot bundle location: `operator_confirmation_required`

snapshot bundle checksum: `operator_confirmation_required`

baselineとhardeningは必ず同一bundleとして扱う。baselineだけをrestore/replay成功と判定せず、2本のfile checksumと適用順を`manifest.json`で照合する。

## 9. post-change snapshot

pre-changeと同じquery/order/serializationで取得する。

- [ ] schema manifest checksum
- [ ] history manifest checksum
- [ ] row count diff
- [ ] Storage manifest diff
- [ ] RLS/ACL negative test
- [ ] application smoke/E2E
- [ ] Stripe webhook dedup
- [ ] Advisor results
- [ ] Vercel deployment metadata

post bundle location: `operator_confirmation_required`

post bundle checksum: `operator_confirmation_required`

## 10. rollback decision matrix

| condition | action owner | default action |
| --- | --- | --- |
| historyだけが期待外、schema/data diff 0 | rollback owner | history snapshotから復元を検討 |
| schema差分あり、data diff 0 | rollback owner + DB executor | approved forward fixかDB restoreを選択 |
| data差分/損失あり | rollback owner | write freeze、PITR/backup restoreを優先評価 |
| Storage object差分あり | Storage owner | object backupからrestore |
| app incompatibilityのみ | application owner | Vercel deployment rollback/flag off |
| security negative test失敗 | security reviewer | release中止、外部traffic/writeを抑止 |

選択基準、具体command、実行者: `operator_confirmation_required`

## 11. abort criteria

以下の1つでも該当したら開始しない、または即時中止する。

- target project refのguardが不一致。
- backup/PITR/Storage backupのいずれかが`operator_confirmation_required`のまま。
- executor、approver、rollback ownerが未割当。
- restore rehearsalが未成功。
- pre-snapshot checksumが未確定。
- baseline checksumがreview値と不一致。
- legacy migrationがpendingへ現れる。
- schema/data/Storageに想定外差分。
- RLS/ACL negative test失敗。
- Stripe payment/quote/deliveryの整合性エラー。
- Vercel rollback targetまたはfeature flag procedureが未確定。
- RTO/RPOを満たせない。

## 12. production gate

全項目が値と証跡で埋まり、Pattern B検証、review済みPattern C history transition/rollback rehearsalが成功するまで、production history変更は`まだ変更不可`である。

## 13. archive evidence

- 旧55 migrationの移動前・移動後・比較結果は`artifacts/legacy-migration-archive/`に保存する。
- authoritative ledgerは`supabase/baseline/legacy-migrations.json`であり、archive後SQLのraw-byte SHA-256とsizeを保持する。
- active rollback/rebuild sourceは`supabase/migrations/`であり、legacy directoryをreplay sourceにしない。
- remote-only 3件の回収証跡は`docs/migration-recovery/`に保持し、synthetic migrationを作らない。
- archive削除にはmigration owner、security reviewer、rollback ownerの明示承認とchecksum/recovery evidenceの別保管が必要である。
- archive作業では本番DB、migration history、Storage、Vercel設定を変更していない。

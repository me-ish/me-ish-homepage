# Etorie P1-04 Storage・RLS・危険RPC hardening監査

監査日: 2026-07-29（検証用実DB監査の反映: 2026-07-31）
対象: `main` commit `5dceaa5452e0ca5573923988a3505366ab3a0a36` から作成した
`chore/etorie-p1-04-security-audit`
実施範囲: リポジトリ内のコード、active migration、テスト、文書の読み取りと
ローカル検証のみ

## 1. 結論

P1-04が要求するDB上の最終状態の大部分は、既存のactive baselineと直後の
security hardening migrationで表現されている。ただし、検証用実DBの監査で
`processed_stripe_events`の`service_role`にSupabaseの既定権限由来の
`REFERENCES`, `TRIGGER`, `TRUNCATE`が残ることが判明した。この差分を閉じるため、
ACL是正migrationを1本追加する。

- `Allow Insert 1exduyn_0`はhardeningで削除され、active migration内で再作成されない。
- Natoriの非公開bucketにanon/authenticated向けINSERT policyは作られない。
- `20260731111025_harden_natori_remaining_privileges.sql`は
  `processed_stripe_events`の4 roleから一度全権限をrevokeし、`service_role`へ
  `SELECT, INSERT, DELETE`だけを再grantする。table data、RLS、policyは変更しない。
- `natori_delete_project(uuid, uuid)`の最終定義はowner確認付きの冪等soft archiveで、
  明示的なEXECUTE grantは`service_role`だけ、正当な実効granteeはfunction ownerと
  `service_role`である。
- アプリの案件削除経路は`deleted_at`更新だけで、案件行やStorage objectを
  物理削除しない。復元は`deleted_at = null`である。

active migrationはbaseline、hardening、P1-03の2本、今回のACL是正の計5本である。
ACL是正以外のschema変更は追加しない。caller inventory、コメントに左右されない
直接検査、mock回帰テスト、SELECT-only検証artifactも維持する。

## 2. 要件分類

| 要件 | 作業開始時 | 根拠 | 今回の処置 |
| --- | --- | --- | --- |
| bucket条件なしStorage INSERT policyを廃止 | A: 充足 | `20260723111741_baseline_security_hardening.sql` | static/contract testを強化 |
| Natori private bucketを非公開にする | A: 充足 | baselineの`storage.buckets`定義 | 設定値を直接検査 |
| inquiry/deliveryのserverまたは署名uploadを維持 | A: 充足 | `portfolioSiteService.ts`、`deliveryService.ts`、`supabaseDeliveryFiles.ts` | mock回帰testを追加 |
| `natori-portfolio`は公開read、server write | A: 充足 | baselineとserver service | mock回帰testを追加 |
| `processed_stripe_events`をclient roleから閉じ、service ACLを限定する | B: 部分充足（検証用実DBで余分な既定権限を確認） | baseline/hardeningのRLS・ACLと実DB監査結果 | ACL是正migrationを1本追加し、7 privilegeの完全一致testを追加 |
| dangerous RPCをowner付きsoft archiveへ置換 | A: 充足 | hardening内の最終function body・ACL | body/ACL/search_path testを追加 |
| UI削除をarchive/restoreだけにする | A: 充足 | `projectsService.ts`とdashboard UI | 再実行・owner mismatch・Storage非削除testを追加 |
| upload caller inventory | B: 部分充足 | コード内に経路はあるが集約文書なし | 本書に集約 |
| Storage/RPCの自動security contract | B: 部分充足 | 従来static checkは一部のみ | コメント除外後の直接検査へ拡張 |
| SELECT-only実DB検証artifact | C: 未充足 | P1-03用のみ存在 | `etorie-p1-04-security-selects.sql`を追加 |

ここでA/B/Cは作業開始時点の分類である。機能・schema要件にCはなく、Cだったのは
検証artifactだけである。

## 3. Storage caller inventory

privacyの「設定根拠」はbaseline/spec上の契約であり、今回remote databaseには
接続していない。したがって実DBとの一致は、隔離された検証環境で本書末尾の
SELECT-only artifactを実行して確認する。

| bucket | privacy契約 | upload caller / role | path境界 | size・MIME | read | delete / cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| `natori-inquiry-refs` | private | contact APIから`portfolioSiteService`、server `supabaseAdmin()` | `{submissionId}/{uuid}.webp`。作成後にDB file rowへ関連付け | bucket 10MiB、JPEG/PNG/WebP/GIF。appも10MiB・同MIMEを検査後WebP化 | serverが短時間signed URLを発行 | upload/RPC失敗時だけsubmission単位のpathをbest effort cleanup。案件archiveとは連動しない |
| `natori-deliveries` | private | serverがowner確認後signed upload tokenを発行。browserはanon clientで`uploadToSignedUrl`だけを実行 | `{projectId}/{rough\|final}/{uuid}.{ext}` | appは1 folder 10 files・1 file 200MB。bucketのsize/MIMEは未決のため`null`を維持 | serverがfinal/rough objectのsigned URLを発行 | owner確認済みの個別file削除だけ。案件archiveとは連動しない |
| `natori-portfolio` | public | `portfolioSiteService`と`projectThumbsService`、server `supabaseAdmin()` | `images/{uuid}.webp`、`project-thumbs/{projectId}.webp` | appは10MiB、JPEG/PNG/WebP/GIF、WebP化。bucket制限は`null`を維持 | public URL | server管理の個別thumb cleanup。案件archive経路からは呼ばない |
| `artworks` | public | entry formからbrowser upload。認証userがあればuser idを記録するが、応募flowはbrowser client | sanitized timestamp filename、処理後は`pending-processing/`・`final/` | form側の応募validation契約。P1-04では変更しない | public URL。server download/certificate経路も存在 | 認証済みcron routeが展示削除時に関連objectをremove |
| `avatars` | public | `ProfileEditModal`、authenticated browser client | `{uid}/avatars-{timestamp}.{ext}` | 8MB、PNG/JPEG/WebP | public URL | 専用cleanupは今回の検索では検出せず |
| `banners` | public | `ProfileEditModal`、authenticated browser client | `{uid}/banners-{timestamp}.{ext}` | 8MB、PNG/JPEG/WebP | public URL | 専用cleanupは今回の検索では検出せず |
| `card-assets` | private | card server route/service、`supabaseAdmin()` | `avatars/{requestId}/...`、`works/{requestId}/...` | avatar 2MB、works 8MB、JPEG/PNG/WebP/GIFを検査してWebP化するrouteあり | server routeがsigned URLを発行 | 同一scoped pathのupsertを使用。P1-04では変更しない |
| `aura-assets` | private | Aura server route/service、`supabaseAdmin()` | `avatars/{requestId}/...`、`works/{requestId}/...`、`studio/.../{projectId}/...` | avatar 2MB、works 8MB、JPEG/PNG/WebP/GIFを検査してWebP化 | server routeがsigned URLを発行 | scoped pathのupsert。P1-04では変更しない |
| `processing-meta` | private | admin approve route、`supabaseAdmin()` | `pending/{entryId}.json` | JSON metadata | processing worker向け | upsert。P1-04では変更しない |

`artworks`、`avatars`、`banners`の正規browser uploadは、bucket/path/auth条件を持つ
既存policyを必要とする。hardeningはそれらを削除せず、bucket条件のない
`Allow Insert 1exduyn_0`だけを削除する。Natori private bucketの正規flowは
service roleまたはpath-scoped signed tokenであり、client INSERT policyを
追加する理由にならない。

## 4. Active migrationのsecurity contract

### 4.1 Storage

`20260723111730_etorie_baseline.sql`はNatori bucketを作成するが、
`storage.objects` policyを作成しない。直後の
`20260723111741_baseline_security_hardening.sql`は
`Allow Insert 1exduyn_0`だけを`DROP POLICY IF EXISTS`する。

static checkとcontract testはSQLコメントを除去してから`CREATE POLICY`文を調べる。
文書・コメント中の`WITH CHECK (true)`を誤検出せず、実行文中の以下を拒否する。

- `Allow Insert 1exduyn_0`の再作成
- `storage.objects`に対する`USING (true)`または`WITH CHECK (true)`
- private bucketの`public = true`
- inquiry bucketの承認済みsize/MIME契約の変更
- deliveries bucketへ未決のsize/MIME制限を推測で追加する変更

### 4.2 `processed_stripe_events`

このtableはStripe webhookのserver-only idempotency ledgerである。
アプリは`processedEvents.ts`から`supabaseAdmin()`でclaim/releaseする。最終ACLは:

- `PUBLIC`, `anon`, `authenticated`: privilegeなし
- `service_role`: `SELECT`, `INSERT`, `DELETE`だけ
- RLS: enabled
- policy: なしでよい

`20260731111025_harden_natori_remaining_privileges.sql`は、`PUBLIC`, `anon`,
`authenticated`, `service_role`から`ALL PRIVILEGES`をrevokeした後、
`service_role`へ必要な3 privilegeだけをgrantする。既存migrationは変更せず、
table data、RLS、policyにも触れない。SELECT-only verificationは
`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`の
7種類を実効権限で比較し、PUBLICの直接grantもcatalog ACLから別途検出する。

service roleはRLSをbypassする正規server経路なので、Advisor警告を消す目的で
permissive policyを追加しない。

### 4.3 `natori_delete_project(uuid, uuid)`

baseline内の互換定義は、同一active laneの直後に必須となるhardening migrationで
置換される。判定対象は名前ではなく、適用順序後の最終定義である。

最終定義は:

- `SECURITY DEFINER`
- `search_path = pg_catalog, public`
- `id = p_project_id AND user_id = p_user_id`でownerを確認
- `deleted_at = coalesce(deleted_at, now())`で再実行しても元timestampを維持
- `DELETE FROM`なし
- `PUBLIC`, `anon`, `authenticated`からEXECUTEをrevoke
- 明示的なEXECUTE grantは`service_role`だけ
- ACL検証上の正当な実効granteeは`pg_proc.proowner`から動的に得るfunction ownerと
  `service_role`。`postgres`など特定のowner role名は固定しない

## 5. アプリのarchive / restore contract

`deleteNatoriAdminProject`という既存export名は互換のため維持するが、処理は
owner条件付きの`UPDATE deleted_at`だけである。コメントも「完全削除」ではなく
復元可能なarchiveであることに修正した。

- archive済みrowへの再実行は0 rowとなり`not-found`で安全に終了する。
- owner mismatchも0 rowとなり`not-found`で終了する。
- restoreはowner条件付きで`deleted_at = null`へ更新する。
- active listはDB queryとapplication filterの両方でarchive rowを除外する。
- project archive時にproject row、task、reference、delivery、thumbnail、その他の
  Storage objectを物理削除しない。
- 個別delivery file削除や失敗submission cleanupは、案件archiveとは異なる
  明示的なresource cleanupとして維持する。

## 6. ローカル自動検証

追加・強化した検証:

- active migration 5本の順序とchecksum、およびStorage policy、bucket設定、
  Stripe ledgerの最終ACL、最終RPC body・ACL・search_pathをコメント除外後のSQLから直接検査
- inquiry referenceのserver upload、error、signed read、failure cleanup
- portfolioのserver write
- deliveryのserver-side owner checkとsigned upload発行、署名発行失敗時のDB insert防止
- browserがserver発行path/tokenだけで`uploadToSignedUrl`し、失敗時にledgerをcleanup
- final deliveryのsigned download
- project archive/restore、二重archive、owner mismatch、通常listからの除外、
  archive時Storage非削除
- browser delivery moduleに`supabaseAdmin`やservice credential名がないこと
- P1-04 verification SQLの全実行文が`SELECT`で始まること

実行結果:

| command | 結果 |
| --- | --- |
| `npm run check:etorie-migrations` | PASS、0 failures |
| targeted security/artifact tests | PASS、2/2 files、20/20 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | error 0（既存warningのみ） |
| `npm test` | PASS、46/46 files、521/521 tests |
| `npm run build` | production build PASS |
| `git diff --check` | PASS |

## 7. 隔離検証環境で残る確認

`supabase/verification/etorie-p1-04-security-selects.sql`は、schema適用済みの
隔離された検証Supabaseでのみ実行する。今回その実行はしていない。

実行前条件:

1. 対象projectが本番でないことを運用担当者が確認する。
2. active migrationのrequired sequenceを最後まで適用済みである。
3. SQLを変更せずSELECT-onlyであることを再確認する。
4. Storage callerごとのbrowser/server smoke test担当を割り当てる。

確認結果のrelease blocker:

- Natori private bucketが`public = true`
- bucket条件なしのtrue write policyが1件以上
- private bucketにclient writeを許すpolicy
- `processed_stripe_events`にclient grant、余分なservice privilege、または意図しないpolicy
- RPCがsoft archive以外、固定search_pathでない、またはfunction ownerと
  `service_role`以外にEXECUTEが付与されている
- artworks/avatar/bannerの正規browser upload回帰
- inquiry/deliveryのserver・signed upload回帰

`NATORI_OWNER_USER_ID`の実値とVercel設定は本監査では確認していない。現在のowner
解決順は、ログインuser、`NATORI_OWNER_USER_ID`、既存の
`natori_user_profiles`・`natori_projects`・`natori_events`に存在する
distinct ownerである。既存データから解決できるのは、3 tableを横断してownerが
ちょうど1人の場合だけである。0人または複数人では`null`となり、公開問い合わせの
案件作成はowner未解決として500、管理mutationは`not-found`相当になる。

Pattern Bのapp smoke testおよび本番反映前には、値を表示せず設定有無とowner解決を
運用担当者が確認する。これはschema hardeningの不足ではないが、app smoke testの
未確認blockerである。

## 8. 操作記録

- Supabase接続・DB query・DDL/DML・`db push`・migration repair: 実施なし
- Vercel接続・環境変数閲覧/変更: 実施なし
- 既存active/legacy migrationの変更: なし
- 新規migration: `20260731111025_harden_natori_remaining_privileges.sql` 1本
  （ACLのみ。table data、RLS、policy変更なし）

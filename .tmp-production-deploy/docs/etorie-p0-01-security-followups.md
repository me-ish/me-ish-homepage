# エトリエ P0-01 security follow-ups

調査日: 2026-07-23（JST）
scope: history normalizationとは独立
status: local hardening migration作成済み / production未適用

## 1. bucket条件なしのStorage INSERT policy

### Current

- `storage.objects` policy `Allow Insert 1exduyn_0`
- command: `INSERT`
- roles: `public`
- `WITH CHECK true`
- bucket、owner、path、MIME、size条件なし。
- これとは別に`artworks`、avatars/banners用の限定policyが存在する。

### Impact

Storage APIに到達できるroleが、policy上は任意bucket/pathへのINSERTを試行できる。private bucketでreadが拒否されても、容量消費、予期しないobject作成、workflowへの混入が起こり得る。

### Current usage

- browser直接uploadは`artworks`、avatars/banners、およびNatori deliveryのsigned upload URLで使われる。
- Natori portfolio/reference/deliveryの管理処理はserver-side adminまたはsigned URL発行経路を持つ。
- broad policyがどの現行flowに必須かを示す明示的なコード依存は検出できない。ただしStorage側のsigned upload挙動を含む回帰試験なしに削除しない。

### Fix options

1. broad policyを削除し、既存のbucket限定policyだけを残す。
2. 必要なbrowser uploadごとに`bucket_id`、`auth.uid()`由来path、roleを限定する。
3. server-only bucketはanon/authenticated INSERTを許可せず、admin APIまたはsigned upload tokenだけを使う。
4. bucketのMIME/size limitもpolicyと合わせて明示する。

### Regression risk

- `artworks`応募upload。
- avatar/banner upload。
- Natori delivery signed upload。
- AURA/Card asset upload。
- legacy clientが暗黙にbroad policyへ依存している可能性。

### Validation

- 各正規bucket/pathのpositive upload。
- 別user path、別bucket、path traversal相当、anonのnegative upload。
- signed upload URLの期限、single-path scope、MIME/size。
- bucket別object countとorphan確認。
- Security Advisor再実行。

### Phase 1 required?

Phase 1 migrationの作成そのものには不要だが、同じproduction projectへのPhase 1 release前に必須。history baselineへ現状policyを固定する前にtargetを承認する。

### Ticket proposal

`SEC-P1-STORAGE-001 Restrict global storage.objects INSERT policy by bucket, role, and owner path`

Owner: `operator_confirmation_required`
Acceptance: broad `public WITH CHECK true`が不在、全positive/negative test pass。

## 2. `processed_stripe_events` grant

### Current

- RLS enabled。
- policyなし。
- anon、authenticated、service_roleにSELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGERがgrantされている。
- applicationは`src/lib/stripe/processedEvents.ts`からserver-only `supabaseAdmin()`でINSERT/DELETEする。

### Impact

現在はpolicyなしRLSがanon/authenticated row accessを拒否するが、不要なtable privilegeが残る。将来の誤policy追加、RLS無効化、owner/security-definer経路との組合せでStripe dedup ledgerが閲覧・改変されるriskを高める。event rowの削除はwebhook再処理を誘発し得る。

### Current usage

- Stripe webhookのevent claim、duplicate判定、失敗時releaseだけ。
- browser/clientの直接利用は検出されない。
- service-role accessが必要。

### Fix options

1. anon/authenticatedの全table privilegeをREVOKEし、service_roleだけに必要最小限のSELECT/INSERT/DELETEを付与。
2. service-only tableとしてpolicyなしRLSを維持。
3. DELETEをsecurity-definer RPCへ限定する案は、error recoveryとEXECUTE ACLを追加reviewする場合のみ。

### Regression risk

- webhookのclaim/release。
- test mockが実grantを仮定していないか。
- manual recovery procedure。

### Validation

- anon/authenticatedのSELECT/INSERT/DELETEが失敗。
- service roleの初回claim、duplicate、release、retryが成功。
- 同一eventの並行requestで1件だけがclaim。
- Advisor再実行。

### Phase 1 required?

Natori Stripe/payment flowのproduction release前に必須。history fixとは別のsecurity migration/ticketにする。

### Ticket proposal

`SEC-P1-STRIPE-002 Make processed_stripe_events service-role only`

Owner: `operator_confirmation_required`
Acceptance: anon/authenticated table privilegeなし、webhook idempotency test pass。

## 3. `natori_delete_project`

### Current

- identity: `public.natori_delete_project(p_user_id uuid, p_project_id uuid)`
- SECURITY DEFINER。
- `search_path=public`。
- current ACLはservice-role only。
- function bodyはprojectを物理DELETEする。
- current Natori appは`deleted_at`によるarchive/restoreを使い、repo内のfunction呼び出しはgenerated type以外で検出されない。

### Impact

soft-delete方針と並行してhard-delete RPCが残り、誤操作や将来の再利用でproject配下のCASCADE dataを不可逆に削除できる。service-role限定でも、server routeの誤接続時のblast radiusが大きい。

### Current usage

- 現行application callは検出されない。
- type definitionには残る。
- cleanup、admin script、外部callerの存在は`operator_confirmation_required`。

### Fix options

1. functionとEXECUTE grantを削除する。
2. functionをarchive (`deleted_at`)へ置換し、名称もsoft-deleteを明示する。
3. 法令/運用上の物理削除が必要なら、別のrestricted admin procedureとして再設計し、confirmation、audit、retention、dry-run countを必須化する。

### Regression risk

- 未確認のadmin/ops caller。
- account deletionやretention job。
- type regeneration後のcompile差分。

### Validation

- repo、runtime log、ops runbookのcaller audit。
- archive/restore E2E。
- unauthorized EXECUTE negative test。
- child rowがarchive中に保持されること。
- 物理削除が必要な場合のbackup/restore rehearsal。

### Phase 1 required?

Phase 1 migration authoringには不要。Natori production release前に「削除/置換/運用限定」の意思決定が必須。

### Ticket proposal

`SEC-P1-NATORI-003 Retire or redesign natori_delete_project hard-delete RPC`

Owner: `operator_confirmation_required`
Acceptance: soft-deleteとの単一方針、caller audit、EXECUTE ACL、rollback/retention文書化。

## 4. `card_requests` RLS

### Current

- RLS disabled、policyなし。
- anon/authenticated/service_roleに全table privilege。
- `session_token text NOT NULL`を保持。
- 主要server accessは`supabaseAdmin()`で、HttpOnly cookieのsession tokenとDB tokenを照合する。
- public page/checkout/webhookにもtable参照がある。

### Impact

PostgREST/Data API経由でanon/authenticatedがtableを直接操作できる設定で、email、payload、design/content、session token、payment state等が露出・改変されるriskがある。server routeのcookie checkはDBの直接accessを防がない。

### Current usage

- Card作成/更新、checkout、Stripe webhook、public slug/id表示。
- owner accessはserver cookie check。
- public readに必要な列とserver-only列が同じtableに混在。

### Fix options

1. 推奨: anon/authenticatedの全table privilegeをrevokeし、全accessをserver route/service roleへ集約。public pageもserver DTOで必要列だけ返す。
2. RLSを有効化し、session tokenをJWT claimに安全に載せられる場合のみowner policyを設計。raw tokenをSQL policyへ直接露出しない。
3. public projection view/RPCをsecurity-invokerまたは厳格なsecurity-definerで作り、公開列だけを返す。
4. session tokenをhash化し、既存token migration/rotationを別途設計。

### Regression risk

- checkout/webhook更新。
- public slug/public id page。
- Card editor autosave/upload。
- legacy clientの直接Supabase query。

### Validation

- anon/authenticatedのbase table read/write negative test。
- owner cookie、wrong token、expired token、cross-request IDOR。
- public DTOにemail/session token/payment internalsがない。
- checkout/webhook/full editor E2E。

### Phase 1 required?

Natori domain migration作成には不要。ただしshared production projectのcritical release gateとして、Phase 1 production release前に修正または明示的risk acceptanceが必須。

### Ticket proposal

`SEC-P0-CARD-004 Remove direct Data API access to card_requests and protect session tokens`

Owner: `operator_confirmation_required`
Acceptance: base table direct access拒否、full Card E2E、token非露出。

## 5. `aura_projects` RLS

### Current

- RLS disabled、policyなし。
- anon/authenticated/service_roleに全table privilege。
- `session_token uuid NOT NULL`を保持。
- Studio owner accessはserver-side `supabaseAdmin()`とHttpOnly cookie token照合。
- tableはAURA studio DB、public page、upload flowから参照される。

### Impact

Cardと同様、server-side access checkを迂回するData API access riskがある。bio/social/works/services、email、session token、visibility/payment stateの閲覧・改変につながり得る。

### Current usage

- AURA Studioのload/save/access。
- avatar/works upload。
- public id/slug相当の公開表示。
- server route中心だが、全caller分類は`operator_confirmation_required`。

### Fix options

1. anon/authenticated grantをrevokeし、server-only service-role accessへ集約。
2. public表示用の限定projectionを作る。
3. authenticated owner modelへ移行するならuser_idを導入し、session token方式から移行した後にRLSを設計。
4. token hash/rotationを別ticketで検討。

### Regression risk

- Studio autosave/load。
- public portfolio表示。
- asset upload。
- payment webhook。
- 生成型未登録を回避しているuntyped callerの見落とし。

### Validation

- anon/authenticated base table negative test。
- correct/wrong session cookie。
- public projectionの列限定。
- Studio save/publish/payment/upload E2E。
- generated type更新とuntyped caller audit。

### Phase 1 required?

Natori domain migration作成には不要。ただしshared production projectのcritical release gateとして、Phase 1 production release前に修正または明示的risk acceptanceが必須。

### Ticket proposal

`SEC-P0-AURA-005 Remove direct Data API access to aura_projects and define public projection`

Owner: `operator_confirmation_required`
Acceptance: base table direct access拒否、Studio/public/payment/upload E2E pass。

## 6. Advisor関連

確認済みNatori/同project項目:

- bucket条件なしStorage INSERT policy。
- `processed_stripe_events`のRLS policyなし/不要grant。
- `card_requests`、`aura_projects`のRLS disabled。
- Natoriのunused index候補。

unused indexはsecurity defectではない。traffic/data量が小さい期間のAdvisor結果だけで削除せず、query planと観測期間を設定したperformance ticketへ分離する。

## 7. 実施順

1. caller inventoryとtarget access model承認。
2. verification環境でACL/RLS/Storage changeを個別dry-run。
3. positive/negative E2E。
4. baseline target stateへ反映。
5. Phase 1 domain migrationとは別commit/別migrationでreview可能にする。

ローカルartifact `20260723111741_baseline_security_hardening.sql`へ次を実装した。

- bucket条件なしの`Allow Insert 1exduyn_0`だけを削除し、artworks/avatar/bannerのbucket/path限定policyは温存する。
- `processed_stripe_events`はanon/authenticated/PUBLICをrevokeし、service roleへSELECT/INSERT/DELETEだけをgrantする。
- `natori_delete_project(uuid,uuid)`は名前を維持し、owner一致・再実行可能な`deleted_at` soft deleteへ置換する。
- `card_requests`と`aura_projects`は全callerがserver-side `supabaseAdmin()`であることを確認し、存在する環境ではRLS enabled、client grantなし、service-role専用にする。

このmigrationは本番へ適用していない。Card/AURAはNatori-only Pattern Bではtable不在を許容するconditional guardであり、完全な動作確認はfull current-state cloneのPattern Cで行う。

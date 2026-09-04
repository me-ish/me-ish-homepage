# エトリエ Phase 1 実装チケット

本書は Phase 0 の推奨案を、独立してレビュー・検証できる作業単位へ分割する。チケット内の migration filename は将来作成する候補であり、Phase 0 では作成していない。

## 1. 推奨実施順

~~~text
P0-01 migration baseline ─┐
P0-02 business ADR ───────┴─> P1-01 request contracts
                                  │
                     ┌────────────┴────────────┐
                     v                         v
              P1-02 compatible readers   P1-03 schema expand
                     │                         │
                     └────────────┬────────────┘
                                  v
                         P1-05 intake RPC
                                  │
                     ┌────────────┴────────────┐
                     v                         v
                P1-06 form/API            P1-07 admin UI
                     │                         │
                     └────────────┬────────────┘
                                  v
                       P1-08 pricing suggestion
                                  v
                         P1-09 quote snapshot

P1-04 security hardening ───────────────────────> release gate
P1-10 activity/note ────────────────────────────> Phase 1b 可
P1-11 generated types ─ after schema, before writer enable
P1-12 delivery atomicity ─ independent hardening
P1-13 regression/rollout ─ all release-critical tickets
~~~

## 2. Release gate

新フォームを一般公開する前に必須:

- P0-01、P0-02
- P1-01〜P1-09
- P1-11
- P1-13
- P1-04 の Storage/RPC 権限是正

P1-10 の activity table と P1-12 の delivery atomicity は、日程上 Phase 1b に分けられる。ただし新規 form 回答や機械ログを note へ複製しないことは P1-06/P1-09 で先に守る。

## P0-01 実DB・migration history のベースライン確定

- **目的**: 正しい Supabase project と、ローカル migration・実 DB・migration history の対応を確定し、安全に Phase 1 migration を追加できる状態にする。
- **変更対象ファイル**:
  - docs/etorie-phase0-gap-analysis.md（必要な事実訂正のみ）
  - docs/etorie-phase0-migration-plan.md（確定 project/運用手順の追記）
  - supabase/migrations/ は照合対象。機能 migration はまだ作らない
- **DB変更**: 調査中はなし。承認後に別の運用 change として migration history の repair/baseline を行う可能性がある。
- **実装内容**:
  - 運用担当者が project ref と本番環境を確認。
  - 実 schema/function/policy/grant/bucket snapshot を保存。
  - 全ローカル migration version と remote history を突合。
  - object ごとの同値性を記録し、repair か baseline 方針をレビューで決定。
  - staging/branch DB で migration dry-run。
- **テスト内容**:
  - dry-run 後の schema diff が意図した Phase 1 差分だけであること。
  - 既存 Natori RPC の identity arguments、ACL、function body hash/定義が一致すること。
- **依存関係**: なし。全 DB ticket の blocker。
- **受け入れ条件**:
  - project ref、適用済み version、未適用 version、例外が文書化されている。
  - 通常 migration push が既存 Natori object を再作成しないことを staging で確認済み。
  - 適用担当、backup/PITR、rollback 担当が決まっている。
- **リスク**: 誤った history repair は未適用変更を隠す。構造名が同じだけで applied と判定しない。

## P0-02 Phase 1 の事業判断 ADR

- **目的**: DB/RPC/UI の条件分岐を実装前に固定する。
- **変更対象ファイル**:
  - 新規 docs/decisions/etorie-phase1-domain-decisions.md
  - docs/etorie-phase0-target-design.md（決定結果の反映）
- **DB変更**: なし。
- **実装内容**:
  - 無料案件の可否と表現。
  - 公開見積に確定 due_date を必須にするか。
  - 料金の基本軸が scope か product type か。
  - consultation/quote の最低入力。
  - unknown/other の管理者解決手順。
  - activity table の Phase 1 必須/Phase 1b。
  - ラフ承認 UI を Phase 2 とする確認。
- **テスト内容**: ADR の各決定が target design、DB constraint、Zod、受け入れテストへ一意に対応することをレビュー。
- **依存関係**: なし。P1-01、P1-03、P1-08、P1-09 の blocker。
- **受け入れ条件**: decision owner、日付、選択肢、採用案、理由、再検討条件が埋まっている。
- **リスク**: 未決のまま実装すると amount=0 や料金軸の旧曖昧さを別形式で再導入する。

## P1-01 RequestData V1・stable ID・共有 validation

- **目的**: form、API、DB service、admin、quote が同じ versioned contract を使えるようにする。
- **変更対象ファイル**:
  - 新規 src/features/natori/types/request.ts
  - 新規 src/features/natori/lib/requestSchema.ts
  - src/features/natori/types/portfolio.ts
  - src/features/natori/lib/portfolioContent.ts
  - src/features/natori/constants/portfolioContent.ts
  - src/features/natori/components/portfolio/edit/PortfolioEditor.tsx
  - 新規/既存の request・portfolio content test
- **DB変更**: なし。pricing/portfolio JSON への stable ID は application contract を先行。
- **実装内容**:
  - NatoriRequestDataV1 と Zod discriminated union を実装。
  - conditional required、max length、件数、金額/date を検証。
  - option/plan/content item に不変 ID を追加。
  - 旧 Portfolio content JSON を label/position から既知 ID へ安全に parse する fallback。
  - unknown label を既定 item に誤マッピングしない。
  - JSON 全体64KiB以下を検証。
- **テスト内容**:
  - target design の3 JSON example が成功。
  - consultation のほぼ未定入力が成功。
  - quote の undecided type/scope が成功。
  - other 補足欠落、重複 option、範囲逆転、invalid date、oversize が失敗。
  - 旧 Portfolio content が既存表示を維持。
- **依存関係**: P0-02。
- **受け入れ条件**:
  - UI と server が同一 schema を import。
  - any を使わず、schemaVersion で exhaustive に分岐。
  - label 変更後も ID が変わらない。
- **リスク**: editor が ID を落とすと料金 mapping が再び label 依存になる。旧 content fallback を削除しない。

## P1-02 nullable/undecided compatibility reader

- **目的**: DB が NULL amount/due_date と undecided type を返しても、現行画面・集計・schedule が壊れないよう先行対応する。
- **変更対象ファイル**:
  - src/features/natori/types/projects.ts
  - src/features/natori/data/supabaseProjects.ts
  - src/features/natori/lib/projects.ts
  - src/features/natori/lib/scheduling.ts
  - src/features/natori/lib/results.ts
  - src/features/natori/components/dashboard/InquiriesBoard.tsx
  - src/features/natori/components/dashboard/InquiryDetailPanel.tsx
  - src/features/natori/components/dashboard/ProjectCard.tsx
  - src/features/natori/components/dashboard/ProjectEditForm.tsx
  - src/features/natori/components/dashboard/ProjectRegisterForm.tsx
  - src/features/natori/components/dashboard/ProjectMonthCalendar.tsx
  - src/features/natori/components/dashboard/ResultsBoard.tsx
  - src/features/natori/server/projectsService.ts
  - 関連 lib/component/service tests
- **DB変更**: なし。
- **実装内容**:
  - amount: number | null、dueDate: string | null、type に undecided を追加。
  - NULL は「未定」、0 は事業決定に沿った「無料/0円」で表示。
  - due NULL は calendar、overdue、capacity、milestone から除外。
  - type undecided は task template、制作実績の type 内訳から除外。
  - inquiry の並びは created_at を受付日時として使う。
  - listNatoriAdminProjects の normalizeProjectTasks を read path から分離。
  - archived row を query/filter の両方で通常集計から除外。
- **テスト内容**:
  - NULL/undecided fixtures を projects、scheduling、results、CSV、各主要 component に追加。
  - GET/list が Supabase update/upsert/delete を呼ばないこと。
  - 既存 concrete project の schedule/result snapshot が不変。
- **依存関係**: P0-02。P1-03 より先に本番配備。
- **受け入れ条件**:
  - 現行 DB に対する test/typecheck/build が成功。
  - NULL due project は schedule pressure 0、ただし inquiry list には表示。
  - 「未定」と「0円」を混同しない。
- **リスク**: dueDate の必須前提が広い。formatter だけでなく sort、date parse、calendar lane、forecast を網羅する。

## P1-03 Phase 1 additive schema・constraint

- **目的**: structured request、未確定値、外部 link、quote snapshot を既存 row 非更新で受け入れる。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_etorie_phase1_expand.sql
  - 新規 supabase/migrations/<timestamp>_etorie_phase1_project_constraints.sql
  - migration verification docs/script（SELECT のみ）
- **DB変更**:
  - projects.request_data nullable、default なし。
  - projects.amount/due_date nullable、amount default 0 を廃止。
  - projects.type CHECK に undecided、default undecided。
  - quotes.request_snapshot/pricing_snapshot nullable。
  - project_reference_links table、constraint、index、RLS/grant。
  - P0-02 で採用なら project_activity table。
  - pricing config の default partial unique は既存重複確認後。
- **実装内容**:
  - additive migration と constraint migration を分ける。
  - request_data は object/schemaVersion/64KiB の envelope のみ DB CHECK。
  - link duplicate UNIQUE、sort order/length CHECK、project FK。
  - nullable due index を partial 化。
  - comment で各 column の真実源を明示。
- **テスト内容**:
  - clean DB への migration。
  - current schema 相当からの migration。
  - legacy row が無変更で読めること。
  - invalid envelope/link/negative amount が拒否されること。
  - anon/authenticated の table access が拒否されること。
- **依存関係**: P0-01、P0-02、P1-02 の配備。
- **受け入れ条件**:
  - migration plan の metadata/data SELECT が期待値。
  - 既存11件相当の row 値が変わらない。
  - request_data NULL と quote snapshot NULL が valid。
- **リスク**: migration history 不一致のまま実行すると衝突する。constraint 名をローカルだけから仮定しない。

## P1-04 Storage・RLS・危険 RPC の既存 hardening

- **目的**: 新しい受付データを公開する前に、project-wide の広い Storage INSERT と hard-delete 経路を閉じる。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_harden_storage_object_insert.sql
  - 新規 supabase/migrations/<timestamp>_harden_natori_remaining_privileges.sql
  - Storage を使う各 route/service の regression tests
- **DB変更**:
  - storage.objects の “Allow Insert 1exduyn_0” を利用実態に沿った bucket/role policy へ置換。
  - processed_stripe_events の anon/authenticated grant を revoke。
  - natori_delete_project の EXECUTE revoke、drop、または soft archive 定義への置換。
  - natori-deliveries bucket の size/MIME 設定は事業上限確定後。
- **実装内容**:
  - 全 bucket upload caller を検索し、正規経路を inventory。
  - portfolio contact/delivery は service role upload のまま。
  - browser 直接 upload が必要な他機能は、その bucket と auth 条件だけを許可。
  - archive/restore service のみを UI 削除経路にする。
- **テスト内容**:
  - anon で Natori private bucket への insert が失敗。
  - service role の正規 inquiry/delivery upload が成功。
  - 他機能の正規 upload regression。
  - hard delete RPC が anon/authenticated/service_role の意図しない caller から実行不可。
- **依存関係**: P0-01。Storage policy の他機能 owner 確認。
- **受け入れ条件**:
  - bucket 条件なし WITH CHECK true policy が0。
  - private bucket は public = false。
  - UI の削除が deleted_at 更新だけである。
- **リスク**: global policy を即時削除すると別機能の upload を壊す可能性がある。inventory と staging browser test を必須にする。

## P1-05 受付 create v2・type 確定 RPC

- **目的**: structured request、画像 metadata、外部 link を原子的に作成し、管理 type 確定時にだけ task を生成する。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_etorie_intake_rpcs.sql
  - src/features/natori/server/inquiryProjectService.ts
  - src/features/natori/server/projectsService.ts
  - src/features/natori/data/supabaseProjects.ts
  - server/RPC integration tests
- **DB変更**:
  - natori_create_project_with_tasks_v2
  - natori_confirm_project_type_v1
  - service-role only EXECUTE、空 search_path
- **実装内容**:
  - create v2 は owner、project envelope、request_data、reference paths、links を検証。
  - public form は type undecided、amount/due NULL、task 0件。
  - consultation/quote で status は inquiry、next_action だけ分岐。
  - type confirm は project row を lock し、concrete type と task template を同時保存。
  - 既存 task がある/制作開始済みの type 変更は拒否または明示 mode を要求。
  - 旧 create RPC を rollback 用に維持。
- **テスト内容**:
  - consultation/quote の初期 row。
  - request + file rows + link rows の全成功/全 rollback。
  - link 6件、重複、非HTTPS、別 owner を拒否。
  - type confirm の同時実行でも task が重複しない。
  - undecided のまま quote/task 制作開始を拒否。
- **依存関係**: P1-01、P1-03、P1-11。
- **受け入れ条件**:
  - 1 submission = 1 project。
  - 部分的な DB row が残らない。
  - SECURITY DEFINER ACL/search_path/owner check が検証済み。
- **リスク**: Storage upload は DB transaction 外。RPC 失敗時の object cleanup と定期 orphan cleanup を維持する。

## P1-06 新依頼フォーム・contact API

- **目的**: consultation/quote の入力を構造化して v2 RPC へ送り、現行の安全対策とメールを維持する。
- **変更対象ファイル**:
  - src/features/natori/components/portfolio/PortfolioCommissionForm.tsx
  - src/app/api/natori/portfolio/contact/route.ts
  - src/features/natori/server/portfolioContactService.ts
  - src/features/natori/server/inquiryProjectService.ts
  - src/features/natori/server/portfolioSiteService.ts
  - src/app/api/natori/portfolio/contact/__tests__/route.test.ts
  - form component tests
- **DB変更**: なし。P1-05 RPC を使用。
- **実装内容**:
  - mode、request type、scope、用途、商用、公開、budget、deadline、分割詳細を UI 化。
  - 外部 URL を最大5件の row UI にし、label 任意。
  - options は stable ID を submit し、表示 label snapshot も保存。
  - current form から段階移行する場合は legacySource を作る。
  - CSRF、honeypot、3回/10分、画像5件/10MB/MIME、cleanup を維持。
  - URL は parse/normalize だけで fetch しない。
  - success mail には必要最小限を表示し、signed URL/JSON を log に残さない。
- **テスト内容**:
  - target design の3ケースを UI/API で送信。
  - mode 別 conditional required。
  - URL duplicate/fragment/非HTTPS/oversize。
  - 画像と link 混在、RPC failure cleanup、mail failure。
  - honeypot/rate limit/CSRF の既存 test。
- **依存関係**: P1-01、P1-05。公開は P1-04/P1-13 後。
- **受け入れ条件**:
  - submitted project に valid request_data V1、NULL amount/due、undecided type、task 0件。
  - 原回答が note に複製されない。
  - external URL を server が取得しない。
- **リスク**: フォーム項目増加で離脱率が上がる。consultation は最低入力を軽くし、quote だけ段階的に詳細を求める。

## P1-07 問い合わせ詳細・管理補正・link CRUD

- **目的**: 新旧案件を同じ管理画面で確認し、quote 前の確定作業を明示する。
- **変更対象ファイル**:
  - src/features/natori/components/dashboard/InquiriesBoard.tsx
  - src/features/natori/components/dashboard/InquiryDetailPanel.tsx
  - src/features/natori/components/dashboard/ProjectEditForm.tsx
  - src/features/natori/lib/inquiryNoteView.ts
  - src/features/natori/server/projectsService.ts
  - src/app/api/natori/admin/projects/route.ts
  - 新規 link CRUD route/service/component
  - component/service tests
- **DB変更**: なし。P1-03 table と P1-05 type RPC を使用。
- **実装内容**:
  - valid V1 は field ごとの structured view、NULL は「旧形式」note parser。
  - mode badge、未確定 type/amount/due、review warning を表示。
  - 管理者が type を確定して task を生成。
  - amount/due/delivery plan を確定。
  - link の追加・編集・削除・並び替え。開けない場合の案内。
  - request_data 原回答は編集不可。
  - amount NULL と0の表記を全箇所で統一。
- **テスト内容**:
  - V1、legacy NULL、unknown version、invalid JSON の表示。
  - type confirm と task 重複防止。
  - link owner scope、件数、重複、sort。
  - archived project は通常 view から除外。
- **依存関係**: P1-01、P1-02、P1-03、P1-05。
- **受け入れ条件**:
  - 既存 note 案件が欠損なく閲覧可能。
  - quote 前の未確定項目が1画面で分かる。
  - admin 操作で request_data が更新されない。
- **リスク**: unknown schemaVersion で案件 page 全体を error にしない。PII を parse error log に含めない。

## P1-08 stable ID 見積候補エンジン

- **目的**: label keyword と silent bust_up fallback を廃止し、説明可能な候補/警告を作る。
- **変更対象ファイル**:
  - src/features/natori/types/pricing.ts
  - src/features/natori/lib/pricing.ts
  - src/features/natori/server/pricingService.ts
  - src/features/natori/components/dashboard/EstimateForm.tsx
  - src/features/natori/lib/__tests__/pricing.test.ts
  - src/features/natori/lib/__tests__/orderFlows.test.ts
- **DB変更**: pricing config JSON schemaVersion。必要なら既存 config は reader fallback で扱い、書き戻し時に version 化。
- **実装内容**:
  - EstimateSuggestionV1、QuoteItemV1、ReviewWarningV1。
  - commissionScope と stable option ID を preset item ID へ mapping。
  - unknown/commercial/publication/rush/deadline/copyright の warning。
  - 同一 item の重複排除と quantity 処理。
  - rule 不在時は warning。別 item を自動採用しない。
  - CATEGORY_TO_TYPE による scope→project type 上書きを削除。
  - mappingVersion を固定。
- **テスト内容**:
  - scope 3種、fixed/percentage option、commercial/publication/rush。
  - unknown/other/missing rule。
  - no base match で automatic base 0件 + warning。
  - label を変更しても ID mapping が維持。
  - edited preset price が候補へ反映。
- **依存関係**: P0-02、P1-01、P1-07。
- **受け入れ条件**:
  - 全 automatic item に sourceField/ruleId がある。
  - ignoredFields と reviewItems が UI に見える。
  - 管理者確認なしに quote は発行されない。
- **リスク**: 商品種別基本料金を scope 料金へ誤って重ねる二重課金。P0-02 の料金軸決定を先行する。

## P1-09 quote snapshot・発行 guard v2

- **目的**: 公開した見積の依頼内容と料金根拠を再現し、未確定案件の発行を DB 境界で防ぐ。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_etorie_quote_v2.sql
  - src/features/natori/server/orderMailService.ts
  - src/features/natori/lib/orderMail.ts
  - src/features/natori/components/dashboard/EstimateForm.tsx
  - src/features/natori/components/dashboard/OrderMailPanel.tsx
  - src/features/natori/server/quoteAcceptService.ts
  - src/features/natori/components/quote/QuoteAcceptCard.tsx
  - order mail/quote accept tests
- **DB変更**:
  - natori_issue_quote_v2。
  - concrete type、正額、due_date、snapshot、明細合計の guard。
  - activity 採用時は quote_issued を同 transaction で insert。
- **実装内容**:
  - request_snapshot に発行時 request_data。
  - pricing_snapshot に preset/version、mappingVersion、project terms、final items、warning resolution、合計。
  - quote.amount = pricing_snapshot.total を server/RPC の両方で検証。
  - 公開後の UPDATE を service から禁止し、新版発行のみ。
  - legacy quote の snapshot NULL fallback。
  - payment link は accepted quote.amount を基準に維持。
- **テスト内容**:
  - type undecided、amount NULL/0、due NULL、合計不一致、未解決 warning を拒否。
  - concurrent issue で version 重複なし。
  - pricing config/label を後で変更しても旧 quote 表示が不変。
  - accept/payment/webhook の既存 regression。
- **依存関係**: P0-02、P1-03、P1-08、P1-11。
- **受け入れ条件**:
  - 新規公開 quote は両 snapshot が非 NULL。
  - snapshot だけで当時の合計と明細を再表示できる。
  - 旧 quote は引き続き承諾/表示可能。
- **リスク**: quote body と structured items の表示差。発行 preview で両者を同時確認し、金額は structured total を唯一の計算値にする。

## P1-10 project activity・note 責務整理

- **目的**: 人の内部メモと機械的な lifecycle log を分離し、横断 timeline を提供する。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_natori_project_activity.sql
  - 新規 src/features/natori/server/projectActivityService.ts
  - projects/orderMail/quote/payment/delivery services
  - 新規 dashboard activity component
  - activity tests
- **DB変更**: natori_project_activity table、partial unique、index、RLS/grant。採用済みなら P1-03 と統合可能。
- **実装内容**:
  - 新規 event から append-only 記録。
  - dedicated ledger の ID を payload 参照し、金額/メール本文を重複しない。
  - idempotency key で webhook/RPC 再送を重複記録しない。
  - note への quote/payment/mail/delivery 自動追記を段階停止。
  - 過去 note はそのまま表示。
- **テスト内容**:
  - quote/payment/delivery の成功1回につき activity 1件。
  - retry/concurrency で重複なし。
  - failure は成功 event として残らない。
  - note の管理者編集と activity が独立。
- **依存関係**: P1-03。各 service ticket と調整。
- **受け入れ条件**:
  - timeline から専用 quote/payment/mail/file row へ追跡可能。
  - 過去 note backfill なし。
  - payload に token、signed URL、メール本文、不要な PII がない。
- **リスク**: RPC 成功後に application から activity を書くと欠落する。重要 event は同 transaction/RPC 内で記録する。

## P1-11 Supabase 生成型の一本化

- **目的**: schema によって異なる2つの Database 型を排除し、Phase 1 schema を strict に扱う。
- **変更対象ファイル**:
  - src/types/supabase.ts
  - src/lib/supabase/database.types.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/server.ts
  - Database 型を import する全ファイル
  - type generation script/package command
- **DB変更**: なし。P1-03 適用後の schema から生成。
- **実装内容**:
  - canonical generated file を決める。
  - 他方は削除ではなく一時 re-export で migration し、全 import 更新後に整理。
  - CI で schema generate/diff、または少なくとも stale check を追加。
  - JSON column は Json 型から共有 Zod parse を通す。
- **テスト内容**:
  - strict typecheck/build。
  - natori delivery/quote/payment/reference/RPC が canonical 型に存在。
  - stale file を直接 import する箇所が0。
- **依存関係**: P1-03、P0-01。
- **受け入れ条件**:
  - Database 型の定義元が1つ。
  - 生成手順と対象 project/schema が文書化。
  - 手編集しないルールが明記。
- **リスク**: global schema の生成差分が大きい可能性がある。Natori 以外の意図しない型変更を別レビューし、機能変更と混ぜない。

## P1-12 納品受取の atomicity hardening

- **目的**: delivery_accepted_at、completed_at、status、activity/note が部分更新になる余地をなくす。
- **変更対象ファイル**:
  - 新規 supabase/migrations/<timestamp>_natori_accept_delivery_rpc.sql
  - src/features/natori/server/deliveryService.ts
  - src/app/api/natori/delivery/accept/route.ts
  - delivery service/route tests
- **DB変更**: natori_accept_delivery_v1 RPC、service-role only、空 search_path。
- **実装内容**:
  - token/project を lock。
  - paid、active、delivery state、token expiry を再検証。
  - delivery_accepted_at と completed_at、status を1 transaction で更新。
  - retry は already-accepted として成功扱い。
  - activity 採用時は同時 insert。
- **テスト内容**:
  - 正常、再送、期限切れ、未払い、archived、invalid state、競合。
  - 途中失敗で一部 timestamp だけ残らない。
  - 現行 delivery page regression。
- **依存関係**: P0-01。P1-10 採用時は連携。
- **受け入れ条件**:
  - 1回の RPC で状態が確定。
  - delivery_accepted_at と completed_at の意味が UI/docs と一致。
- **リスク**: manual completed project と requester acceptance の関係。既存 completed row を変更せず、新規 token acceptance だけ対象にする。

## P1-13 E2E regression・段階 rollout・監視

- **目的**: form から completion まで既存の強みを壊さず、新形式を安全に有効化する。
- **変更対象ファイル**:
  - Natori の route/service/lib/component tests
  - feature flag 設定
  - 運用 runbook
  - 必要最小限の structured metrics/log
- **DB変更**: なし。migration plan の SELECT を release check に使用。
- **実装内容**:
  - feature flag OFF で compatibility deploy。
  - internal project/限定ユーザーで新 form を canary。
  - consultation と quote の両 E2E。
  - type confirm → estimate → quote → accept → payment → task → delivery → accept。
  - mail/Stripe の sandbox/test mode を利用。
  - PII を含まない error code/件数を監視。
  - flag OFF、旧 RPC、dual reader の rollback rehearsal。
- **テスト内容**:
  - legacy note project と legacy quote。
  - target design の3 request。
  - image/link upload failure と orphan cleanup。
  - quote concurrency、accept retry、webhook duplicate/mismatch、delivery retry。
  - archive/restore、RLS/ACL、anon Storage deny。
  - build/typecheck と関連 unit/integration test。
- **依存関係**: release gate の全 ticket。
- **受け入れ条件**:
  - migration plan の post-deploy SELECT に説明不能な異常が0。
  - canary で1件以上の consultation/quote が正しい初期値。
  - legacy flow の regression がない。
  - rollback rehearsal が成功。
  - monitor owner と observation period が決まっている。
- **リスク**: 外部メール/Stripe/Storage を本番で試すと実通知・課金が起こる。test mode、専用宛先、feature flag、運用チェックリストを必須にする。

## 3. Phase 2 へ明示的に送る項目

次は Phase 1 ticket へ混ぜない。

- natori_request_access_tokens と統合 requester project page
- 既存 quote/delivery token の一般 token への統合
- 自由チャット
- requester 向けラフ承認・修正スレッド
- 外部 URL の自動 preview/download
- 過去 note の全自動 request_data backfill
- legacy quote/payment mirror columns の削除
- 全 pricing config の商品種別×scope 行列化（P0-02 で採用した場合は別 epic）

Phase 1 は、これらを将来追加できる owner/project/snapshot/activity 境界だけを整える。

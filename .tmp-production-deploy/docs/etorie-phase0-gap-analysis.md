# エトリエ Phase 0 現行実装・差分分析

調査日: 2026-07-22（JST）
対象: me-ish/me-ish-homepage の main ブランチ、Natori スイート、接続できた Supabase プロジェクト
実施範囲: ソース、テスト、ローカルマイグレーション、生成型、実 DB のカタログ・集計、RPC、RLS、権限、Storage の読み取り確認

## 0. 判定ラベルと前提

- **確認済み（コード）**: main の現行ファイルから確認した事実。
- **確認済み（実DB）**: Supabase へ SELECT 相当の読み取りだけを行い確認した事実。
- **推奨**: Phase 1 の設計案。現行仕様の事実ではない。
- **事業判断**: コードや DB だけでは決められない事項。

接続先はプロジェクト名 “me-ish's Project” とリポジトリの対応から本サービスの本番相当と判断した。ただし、環境変数を読んで project ref を照合することは禁止事項に従い実施していないため、適用作業前に運用担当者が接続先を確定する必要がある。本調査では DDL、データ更新、マイグレーション実行、Storage への書き込みを行っていない。

## 1. 結論

現行の案件、版付き見積、承諾、決済、入金台帳、制作タスク、非公開資料、納品、メールログは再利用できる。一方、問い合わせ受付だけは、未確定値を「金額 0・30日後の納期・推定した案件種別」に変換し、原回答を note の日本語本文へ埋めている。この入口を構造化し、既存フローへ安全につなぐのが Phase 1 の中心になる。

最も大きい運用上の前提リスクは、実 DB に Natori の最新オブジェクトが存在する一方、実 DB のマイグレーション履歴にはローカルの Natori マイグレーション群が記録されていないことである。通常の migration push をそのまま実行してはいけない。

## 2. 現行の実データフロー

### 2.1 依頼フォームから問い合わせ案件

1. PortfolioCommissionForm が氏名、メール、依頼種別、プラン、オプション、予算帯、納期区分、参考画像、詳細、メッセージを multipart/form-data で送る。
2. contact API が CSRF ヘッダー、honeypot、IP 単位 3回/10分のレート制限、Zod 検証を行う。
3. 参考画像は最大5件、各10MBまで。MIME を確認後、非公開 natori-inquiry-refs bucket へ保存する。
4. inquiryProjectService がフォームの表示文字列から案件種別を推測する。認識できない依頼種別は illustration へ倒れる。
5. createNatoriAdminProject が次を生成し、natori_create_project_with_tasks RPC で案件・タスク・参考ファイルメタデータをまとめて保存する。
   - status = inquiry
   - amount = 0
   - due_date = 起票日から通常30日後
   - delivery_plan = normal
   - type = 推測した4分類のいずれか
   - type に応じた制作タスク一式
6. フォーム回答は buildInquiryNote が日本語ラベル付き本文へ整形し、natori_projects.note に保存する。専用の request_data はない。
7. 案件作成後、管理者通知と依頼者の自動返信を best effort で送る。メール用の参考画像 URL は7日間の署名 URL である。
8. 管理画面は inquiryNoteView が note の見出しとラベルを再解析して依頼内容を表示し、見積入力用テキストもこの解析結果から作る。

補足:

- UI は外部 URL 専用入力を表示していない。「詳細欄へ URL を貼る」運用であり、API には refUrls 文字列が残っている。
- 参考画像の保存後に案件作成が失敗した場合は画像を削除して 500 を返す。案件が作成できない状態でメールだけ成功させる経路にはなっていない。
- listNatoriAdminProjects は単なる一覧取得時にも normalizeProjectTasks を呼び、タスクの upsert/delete を行いうる。未確定種別を導入する前に読み取り時書き込みを分離する必要がある。

### 2.2 問い合わせ確認と見積候補

1. InquiriesBoard は受注前ステータスを一覧表示し、InquiryDetailPanel で note を解析した回答を表示する。
2. 現在の amount = 0 は一覧で「未定」、詳細の一部では「¥0」と表示され、意味が統一されていない。
3. EstimateForm は inquiry の解析済みテキストと選択中の料金プリセットを受け取る。
4. pricing.ts がキーワードを照合して基本項目、固定加算、割合加算、警告を作る。基本項目が見つからない場合は bust_up を自動採用する。
5. 基本料金の現行 ID は bust_up / waist_up / full_body であり、案件種別 icon / sd / standing / illustration とは別軸である。
6. EstimateForm 内の CATEGORY_TO_TYPE は料金スコープから案件種別へ再変換するため、商品種別と描画範囲が混同される。SD に対応する基本料金カテゴリもない。

### 2.3 見積発行と承諾

1. 見積メール送信前に natori_issue_quote RPC が project をロックし、版番号、宛先、件名、本文、金額、承諾 token hash と期限を natori_quotes へ保存する。
2. 旧版を superseded にし、active_quote_id とレガシーの見積・承諾列を project にも複製する。
3. pending の natori_order_mail_logs を先に保存し、メール結果を sent / failed / state_error として残す。
4. 依頼者は token 付きページで発行版のタイトルと金額を確認し、POST で承諾する。
5. natori_accept_quote RPC が quote と project をロックして一度だけ承諾し、accepted amount 等を project のレガシー列にも反映する。

現行 quote は「タイトル、顧客、宛先、金額、件名、本文」のスナップショットを持つが、料金明細、採用ルール、料金プリセット、依頼回答のスナップショットは持たない。

### 2.4 支払いと入金反映

1. 支払いリンクは、承諾済み active quote と project の金額が一致する場合だけ Stripe Payment Link を発行する。
2. Stripe 側 idempotency key と DB に保存した link/session 情報により二重発行を抑止する。
3. webhook は processed_stripe_events で event ID を claim し、対象外・重複・一時障害を区別する。
4. natori_record_stripe_payment RPC が project をロックし、quote ID と金額を検証して入金反映と natori_payment_transactions 追加を原子的に行う。
5. 同一 session、別 session の重複、金額不一致、旧見積からの入金を台帳に残す。
6. 手動入金は natori_confirm_manual_payment RPC で project と台帳を原子的に更新する。

### 2.5 制作、ラフ、納品、完了

1. 入金確定後、status は rough へ進み、案件種別別のタスクをチェックして制作工程を進める。
2. natori_update_task_and_status RPC は許可遷移と入金済み条件を確認する。
3. ラフ資料は非公開 bucket の署名 URL をメール送信できるが、依頼者がラフ承認・修正指示を構造化して返すページや履歴はない。現行はメールと waiting 状態による運用である。
4. 納品ファイルは非公開 natori-deliveries bucket に保存し、token 付き納品ページで署名 URL を表示する。
5. 受取確認は delivery_accepted_at と completed_at を更新し、可能なら status = completed に進める。これは単一 RPC ではなく複数更新である。
6. 完了案件は paid_at と completed_at を使って実績集計する。削除操作はアプリでは deleted_at による archive/restore である。

## 3. 現行 DB 構造

### 3.1 主要テーブル

| テーブル | 現行責務 | 主な確認事項 |
| --- | --- | --- |
| natori_projects | 案件の現在状態 | user_id 所有者、type、status、amount、due_date、quote/payment/delivery の要約列、deleted_at。request_data はない |
| natori_project_tasks | 制作タスク | project FK、stage、task_key、done、sort_order、estimated_hours |
| natori_inquiry_reference_files | 受付時画像メタデータ | project FK、storage_path。path は UNIQUE |
| natori_quotes | 版付き見積 | project/user、version、amount、メール本文 snapshot、token hash、期限、状態、承諾時刻 |
| natori_payment_transactions | 入金台帳 | project/quote、Stripe session、期待額・受領額、判定状態。session ID は UNIQUE |
| natori_order_mail_logs | 注文メール送信台帳 | project/quote、kind、状態、宛先、error |
| natori_delivery_files | ラフ・納品ファイル | project、folder = rough/final、storage_path |
| natori_pricing_configs | 所有者別料金プリセット | preset_key、is_default、sort_order、config JSONB |
| natori_events | 管理者のカレンダー予定 | 案件監査イベントではない |
| natori_page_events | ページ計測 | Natori の公開ページイベント |
| processed_stripe_events | webhook 冪等性 | Stripe event ID の処理 claim |

### 3.2 natori_projects の重要な実 DB 定義

- amount: integer NOT NULL DEFAULT 0、0以上
- type: icon / sd / standing / illustration
- status: inquiry / estimating / consulting / quoted / awaiting_payment / rough / lineart / coloring / waiting / delivery_prep / delivered / completed / closed
- delivery_plan: normal / rush_14_days / rush_7_days
- priority: NULL または low / normal / high
- due_date: date NOT NULL
- payment_link_status: NULL または issuing / ready / sent / send_failed / paid / void
- paid_amount: NULL または0以上
- active_quote_id、payment_quote_id: natori_quotes への FK、削除時 NULL
- deleted_at: NULL が通常、値ありはアーカイブ

quote amount も現状は0以上であり、0円見積を DB は拒否しない。

### 3.3 RPC

| RPC | 現行動作 | Phase 1 への影響 |
| --- | --- | --- |
| natori_create_project_with_tasks | project JSON、task JSON、参考画像 path を一括 insert | request_data、外部 URL、未確定種別、タスク未生成を扱えない |
| natori_issue_quote | 版作成、旧版 supersede、token、project mirror 更新 | 正額・確定種別・確定納期の guard と構造化 snapshot がない |
| natori_accept_quote | quote/project を lock して承諾 | 再利用可能。レガシー mirror の責務整理が必要 |
| natori_confirm_manual_payment | 手動入金と台帳を原子的に記録 | 再利用可能。正額・quote を真実源とする確認が必要 |
| natori_record_stripe_payment | 重複、金額、quote を検証して入金反映 | 現行の強みとして維持 |
| natori_update_task_and_status | task と status を原子的に更新 | undecided では task がない前提を追加する |
| natori_delete_project | project を物理 DELETE | アプリは未使用だが service_role が実行可能。soft delete 方針と衝突 |

7個の SECURITY DEFINER RPC は postgres と service_role のみ EXECUTE 可で、anon/authenticated は実行不可だった。search_path は public 固定である。権限面は抑止されているが、Phase 1 の新規/更新 RPC は空の search_path と完全修飾名を推奨する。

### 3.4 RLS・権限・インデックス

- Natori の主要テーブルは RLS enabled。
- 最新の Natori hardening により主要テーブルの anon/authenticated table grant は revoke、service_role のみ付与されている。
- projects/tasks には所有者ポリシー、quotes/payment/mail/reference/delivery 等には service-only deny 方針がある。
- owner/due、active project、deleted_at、quote version/token、Stripe session、storage_path、quote FK 等の主要 index/unique は実 DB に存在する。
- processed_stripe_events は RLS enabled だが policy がなく、anon/authenticated/service_role の table grant が残る。anon/authenticated は RLS で結果的に拒否されるが、Natori hardening と一貫しない。

### 3.5 Storage

| bucket | 公開 | サイズ/MIME |
| --- | --- | --- |
| natori-inquiry-refs | private | 10MB、jpeg/png/webp/gif |
| natori-deliveries | private | bucket 側の size/MIME 制限なし |
| natori-portfolio | public | 公開作品用 |

Natori 専用の storage.objects policy はなく、サーバーの service role と署名 URL を使っている。この設計自体は維持可能である。

ただし実 DB の storage.objects に、全 role を対象に WITH CHECK true とする “Allow Insert 1exduyn_0” policy が存在し、anon/authenticated に INSERT grant もある。bucket_id 条件がないため、Natori の private bucket を含む project 全体の任意 bucket への匿名 upload を許しうる。これは Phase 1 の公開前に別途解消すべき高重要度の既存セキュリティ問題である。読み取り公開を意味するものではない。

### 3.6 実データの非機微集計

調査時点のスナップショット:

- project 11件、すべて active
- status: completed 10、rough 1
- type: illustration 10、sd 1
- amount 0、due_date NULL はともに0件
- paid_at あり11件、completed_at あり10件
- quote 0、payment transaction 2、pricing config 6
- paid/confirmed/amount、completed status/completed_at の確認対象不整合は0件

これは現時点のデータ分布であり、将来の仕様を制約する根拠にはしない。既存 completed の多くは後付け backfill であり、payment transaction が全件に存在するわけではない。

## 4. GitHub と実 DB の一致状況

構造、制約、主要 index、RPC 本体は、20260720 系までのローカル Natori マイグレーションと概ね一致した。src/types/supabase.ts も最新の実 DB に近い。

一方で次の差分がある。

1. 実 DB の migration history は5件しか返さず、ローカルにある Natori マイグレーション群を記録していない。
2. src/lib/supabase/database.types.ts は古く、natori_projects に新しい quote/payment/delivery 列がなく、quotes、payment transactions、delivery files、関連 RPC も不足する。
3. src/types/supabase.ts は新しいため、同じアプリ内に異なる Database 型が2系統ある。
4. storage.objects の全 bucket 許可 policy は Natori のローカル hardening だけでは解消されていない。
5. natori_delete_project は実 DB に物理削除関数として残るが、アプリの現行削除は soft delete である。

確認できた remote history は 20250120、20250124、20260214050324、20260223113216、20260225122344 の5 version である。後ろ3件は card requests と AURA projects 関連であり、20260523〜20260720104033 のローカル Natori migration は履歴に見えない。正しい project ref の最終確認前なので、これは「接続先で観測した履歴」として扱い、直ちに repair 対象と断定しない。

## 5. 理想設計との差分

| 領域 | 現状 | 理想 | 差分 | 重要度 | 変更対象 |
| --- | --- | --- | --- | --- | --- |
| 原回答 | note の日本語本文 | version 付き request_data | 検索・検証不能、表示文言変更で parser が壊れる | Critical | DB、型、API、UI |
| 金額未定 | amount = 0 | NULL = 未確定、0 = 明示的無料 | 未定と無料を区別できない | High | DB、型、UI、RPC |
| 納期未定 | 30日後を自動保存 | 希望納期と確定 due_date を分離 | 架空の確定日が schedule に出る | High | DB、型、schedule、UI |
| 案件種別 | 表示文字列から4種へ推測 | 原回答と管理分類を分離、undecided 可 | unknown を illustration に誤分類 | High | DB、型、task、UI |
| タスク生成 | 受付時に必ず生成 | type 確定時に生成 | 未確定案件へ誤った task ができる | High | RPC、service、UI |
| 相談/見積 | 同じ inquiry、mode 保存なし | status は共通、request_data で mode 区別 | next action と必須入力を分けられない | High | JSON、API、UI |
| 外部資料 | details/refUrls の自由文 | 最大5件の専用 link rows | 個別 validation、編集、期限切れ表示ができない | High | DB、API、UI |
| 料金候補 | note の keyword と label | stable ID と version 付き rule | label 編集に脆く、未一致で bust_up を誤採用 | Critical | pricing 型、ロジック、UI |
| 料金軸 | scope の3基本料金 | request type と scope を分離 | 候補表の type→基本料金は現構造に存在しない | High | 事業判断、pricing config |
| quote snapshot | 金額とメール本文 | request/明細/preset/rule snapshot | 後から見積根拠を再現できない | High | quotes、RPC、UI |
| 現在額と契約額 | project と quote に複製 | quote を契約の真実源にする | mirror 同期責務が曖昧 | Medium | service、RPC、docs |
| 入金 | ledger + project summary | ledger を真実源、summary は派生 | 現状は概ね良いが責務を明文化していない | Medium | docs、validation |
| note | 原回答、内部メモ、各種ログ混在 | 内部メモ専用 | 監査イベントと人のメモを分離できない | High | UI、service、activity |
| ラフ確認 | メール + waiting | 構造化承認/修正 | requester の操作履歴がない | Medium | Phase 2寄り |
| 納品受取 | 複数 DB 更新 | 原子的な受取確定 | 部分失敗の余地 | Medium | RPC、service |
| 削除 | app は soft、RPC は hard | soft delete に統一 | service-role 誤呼出しで物理削除可能 | High | RPC、権限 |
| 一覧取得 | task normalization で書き込み | GET は読み取り専用 | 閲覧だけで DB が変わる | High | projectsService |
| DB型 | 新旧2ファイル | 生成元1つ | compile 時に場所で schema が変わる | High | 型生成、imports |
| migration history | 実体と履歴が不一致 | schema と履歴が一致 | migration 再適用・衝突リスク | Critical | 運用、Supabase |
| Storage RLS | 全 bucket insert policy | bucket/purpose 単位 | private bucket へ匿名書込可能性 | Critical | storage policy |
| access token | quote/delivery 個別 token | Phase 2 の purpose-scoped token | Phase 1 には不要 | Low（Phase 1） | Phase 2 |

## 6. 問題点の整理

### 6.1 データ重複

- project.amount、quoted_amount、quote_accepted_amount、paid_amount と quote/transaction の金額が併存する。
- active_quote_id と project 上の旧 token/acceptance 列が併存する。
- payment_confirmed_at と paid_at は似ているが、前者は運用上の入金確認、後者は決済確定要約である。
- delivery_accepted_at は依頼者の受取、completed_at は案件完了であり、現行の受取処理では同時刻になる。
- note に quote/payment/delivery/mail の一部ログが重複記録される。

推奨する真実源は、契約版 = natori_quotes、入金明細 = natori_payment_transactions、メール送信 = natori_order_mail_logs、ファイル = 各 file table、現在の検索・表示用要約 = natori_projects である。既存 mirror は Phase 1 で削除せず、新規コードからの読み取り優先順位を決める。

### 6.2 未定値

0円と仮の30日後は UI 上の便宜を DB の事実として保存している。NULL を未確定に使い、希望値は request_data、管理者が確定した値だけを project の通常列に保存する方がドメインに合う。

### 6.3 原回答の喪失

表示ラベル、価格表記、自由文を1つの note に連結しており、構造化されたまま残らない。parser は日本語の見出しに依存するため、文言変更や自由文中の似た見出しに弱い。過去 note を自動解析して完全な request_data に backfill するのは誤変換リスクが高い。

### 6.4 型の不整合

- NatoriProject は amount と dueDate を必須 number/string とし、type は4値だけである。
- DB 生成型が2系統あり、一方が最新 Natori schema を欠く。
- pricing config は JSONB だが DB レベルの version や構造制約がない。
- Portfolio の plan/option は編集可能な表示名と価格だけで、stable ID がない。

### 6.5 状態遷移

consulting は既存コードで inquiry の legacy alias として正規化される。相談だけ consulting を初期値にすると、既存一覧と遷移の意味を再び二重化する。そのため、初期 status は両 mode とも inquiry のままにし、mode と next_action を分ける方が安全である。

見積発行は amount = 0、未確定 type、仮 due_date を防ぐ guard がない。制作開始側の支払い guard は強いが、契約前の入力確定 guard が不足する。

### 6.6 後方互換性

- 既存11件には request_data がない。
- 過去 note 解析表示は残す必要がある。
- nullable amount/due_date と undecided は scheduling、calendar、result CSV、form、formatter の広い範囲に影響する。
- 新値を保存する前に全 reader を対応させる expand/contract が必要である。

### 6.7 セキュリティ

- Natori の table/RPC は概ね service-role only で良好。
- Storage の project-wide INSERT policy は Natori 外からの影響もあるため、所有者と正しい bucket を確定してから是正する。
- natori_delete_project の hard delete を残さない。
- 新しい URL は fetch/preview せず HTTPS の文字列として保存する。provider は認可に使わない。
- 新規 SECURITY DEFINER は PUBLIC/anon/authenticated の EXECUTE を revoke し、空 search_path と完全修飾名を使う。

### 6.8 マイグレーションリスク

実体と migration history のずれが最大リスクである。ローカルファイルが未適用扱いのまま通常 push すると、既存 table/function/policy と衝突する可能性がある。正しい project ref、実 schema snapshot、各 migration の同値性を確認し、履歴を安全に reconcile してから Phase 1 migration を作成する。

## 7. 確認できた強み

- quote version と supersede、承諾 token hash/expiry
- payment link の再利用と Stripe idempotency
- webhook event claim と一時障害時の再送設計
- payment transaction の mismatch/duplicate 台帳
- private bucket と短期 signed URL
- CSRF、honeypot、rate limit、MIME/件数/容量検証
- project owner scope、soft archive、RLS/grant hardening
- quote/payment/status の主要競合を RPC の row lock で防ぐ設計
- quote、webhook、status、archive、フォーム guard のテスト群

これらは全面刷新せず Phase 1 でも維持する。

## 8. 事業判断が必要な不明点

1. 無料案件を正式に扱うか。扱うなら amount = 0 を無料として使い、pricing_status または billing_mode で明示する必要がある。
2. 見積公開時に確定納期を必須にするか。推奨は必須だが、「金額だけの概算見積」を公開版として許すかは業務判断である。
3. 料金の基本軸は「描画範囲（胸上/腰上/全身）」か「商品種別（アイコン/SD/立ち絵/一枚絵）」か。現行は前者であり、候補表をそのまま採用するには料金モデル追加が必要。
4. requestType = other をどの管理 type に確定するか。推奨は見積前に4分類へ管理者が補正し、project.type に other は追加しない。
5. 商用利用、実績公開、著作権譲渡、リテイクの料金・確認ルールを全クリエイター共通にするか、料金プリセットごとにするか。
6. 相談フォームの最低入力をメッセージ1項目だけにするか、用途や希望も必須にするか。
7. ラフ承認・修正履歴を Phase 1 に含めるか。推奨は現行メール運用を維持し、統合 requester page とともに Phase 2 で扱う。
8. project activity table を Phase 1 の必須にするか。推奨は新規 lifecycle event から記録を開始し、過去 note の完全 backfill はしない。
9. 接続した “me-ish's Project” が本番の正しい project ref か、および migration history をどの方法で reconcile するか。

## 9. Phase 1 の境界

Phase 1 に含める推奨範囲は、構造化 request、未確定値、外部リンク、stable ID の見積候補、quote snapshot、既存 reader の後方互換、権限/移行安全性である。

依頼者用統合案件ページ、汎用 access token、自由チャット、ラフ承認 UI の全面導入は Phase 2 とする。既存 quote/delivery token は Phase 1 で維持し、project へ新たな生 token/hash を追加しない。

## 10. 主な調査根拠

### 受付

- src/features/natori/components/portfolio/PortfolioCommissionForm.tsx
- src/app/api/natori/portfolio/contact/route.ts
- src/features/natori/server/portfolioContactService.ts
- src/features/natori/server/inquiryProjectService.ts
- src/features/natori/lib/inquiry.ts
- src/features/natori/lib/inquiryNoteView.ts
- src/app/api/natori/portfolio/contact/__tests__/route.test.ts

### 案件・schedule

- src/features/natori/types/projects.ts
- src/features/natori/lib/projects.ts
- src/features/natori/lib/scheduling.ts
- src/features/natori/lib/statusTransitions.ts
- src/features/natori/server/projectsService.ts
- src/features/natori/data/supabaseProjects.ts
- src/features/natori/components/dashboard/InquiriesBoard.tsx
- src/features/natori/components/dashboard/InquiryDetailPanel.tsx
- src/features/natori/components/dashboard/ProjectRegisterForm.tsx
- src/features/natori/components/dashboard/ProjectEditForm.tsx
- src/features/natori/lib/__tests__/projects.test.ts
- src/features/natori/lib/__tests__/scheduling.test.ts
- src/features/natori/lib/__tests__/statusTransitions.test.ts
- src/features/natori/server/__tests__/projectsService.test.ts

### 見積・決済・納品

- src/app/[locale]/natori/estimate/page.tsx
- src/features/natori/components/dashboard/EstimateForm.tsx
- src/features/natori/lib/pricing.ts
- src/features/natori/types/pricing.ts
- src/features/natori/server/pricingService.ts
- src/features/natori/server/orderMailService.ts
- src/features/natori/server/quoteAcceptService.ts
- src/app/api/webhook/stripe/route.ts
- src/features/natori/server/deliveryService.ts
- src/features/natori/lib/__tests__/pricing.test.ts
- src/features/natori/server/__tests__/orderMailService.test.ts
- src/features/natori/server/__tests__/quoteAcceptService.test.ts
- src/app/api/webhook/stripe/__tests__/route.test.ts

### DB・型

- supabase/legacy-migrations/20260523_natori_projects.sql から
  supabase/legacy-migrations/20260720104033_harden_natori_data_api_and_indexes.sql
  までの Natori 関連 migration
- src/types/supabase.ts
- src/lib/supabase/database.types.ts
- 実 DB の information_schema、pg_constraint、pg_indexes、pg_policies、
  pg_proc、table grants、storage.buckets、storage.objects policies

実 DB の業務データは本文や宛先を取得せず、件数と整合性フラグだけを集計した。

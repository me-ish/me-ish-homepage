# エトリエ Phase 0 推奨ターゲット設計

本書は Phase 1 の推奨確定案である。現行の natori_projects 中心設計、版付き見積、入金台帳、private Storage、既存 token、冪等性を維持し、受付と見積根拠を追加する。

表記:

- **採用推奨**: Phase 1 の標準案。
- **互換維持**: Phase 1 では削除・置換しない。
- **事業判断**: 実装着手前に責任者の選択が必要。

## 1. 設計原則

1. 依頼者の原回答と管理者の確定値を分離する。
2. 未確定を 0、仮日、誤分類で埋めない。
3. 見積候補は自動確定せず、stable ID と警告を使う。
4. 公開済み見積は、依頼内容・明細・料金設定の要約を不変 snapshot として残す。
5. 既存案件は無理に構造化せず、request_data = NULL と legacy note fallback を正規の状態として扱う。
6. 新値を書き始める前に、全 reader を nullable/undecided 対応させる。
7. Data API は引き続き service-role only とし、将来の依頼者画面も server endpoint + purpose-scoped token を使う。

## 2. 推奨データモデル

### 2.1 natori_projects

| カラム | 推奨型 | NULL | default | 制約・責務 |
| --- | --- | --- | --- | --- |
| request_data | jsonb | 可 | なし | 依頼者原回答。NULL は legacy/未取得。空 object を sentinel にしない |
| type | text | 不可 | undecided | undecided / icon / sd / standing / illustration |
| amount | integer | 可 | NULL | 管理上の現在見積額。NULL = 未確定、0 = 無料を許す場合だけ明示的無料 |
| due_date | date | 可 | NULL | 管理者が確定した納期。希望納期は request_data.deadline |
| note | text | 可 | 現行どおり | 管理者の内部メモ。原回答全文や機械ログを新規追記しない |
| status | text | 不可 | inquiry | 現行 CHECK を維持。相談専用 status は追加しない |
| next_action | text | 不可 | 現行どおり | mode と確定状況に応じた人向け次アクション |

request_data の DB CHECK は粗い envelope のみとする。

- NULL、または JSON object
- schemaVersion = 1
- text 化した全体が最大64KiB

詳細な条件分岐、文字数、配列件数、日付、URL は共有 Zod schema と RPC/service で検証する。Postgres CHECK へ JSON 全構造を重複実装しない。

既存 amount >= 0 CHECK は amount IS NULL OR amount >= 0 へ変更する。due_date NOT NULL を外す。type CHECK に undecided を追加する。既存行は書き換えない。

Phase 1 の既定推奨は「有償案件のみ公開見積可能」とし、amount は受付中 NULL、見積前に正の整数とする。無料案件を正式に扱う事業決定になった場合は、0だけから意味を推測せず billing_mode = paid / free の通常列を追加し、free は支払いリンクを通さない専用遷移と監査理由を設ける。

推奨 index:

- active 案件の user_id, due_date。ただし due_date IS NOT NULL の partial index
- active 案件の user_id, type, status
- request_data の汎用 GIN は Phase 1 では追加しない。実クエリが決まってから expression index を追加する

### 2.2 natori_project_reference_links

外部資料 URL は request_data の配列ではなく専用 table を採用する。理由は、順序、重複、個別編集、アクセス不能表示、将来の公開範囲、監査を project と独立して扱うためである。

| カラム | 型 | NULL | default | 制約 |
| --- | --- | --- | --- | --- |
| id | uuid | 不可 | gen_random_uuid | PK |
| project_id | uuid | 不可 | なし | natori_projects(id) ON DELETE CASCADE |
| url | text | 不可 | なし | 元 URL、HTTPS、最大2048文字 |
| normalized_url | text | 不可 | なし | server で正規化した重複判定用 URL、最大2048文字 |
| label | text | 可 | NULL | 最大100文字 |
| provider | text | 可 | NULL | 表示補助、最大50文字。認可には使わない |
| sort_order | integer | 不可 | 0 | 0以上 |
| created_at | timestamptz | 不可 | now |  |
| updated_at | timestamptz | 不可 | now |  |

制約と index:

- UNIQUE(project_id, normalized_url)
- INDEX(project_id, sort_order, created_at)
- 1案件最大5件は row CHECK では表せないため、project row を lock する作成/更新 RPC か transaction 内で検証する

URL 正規化:

- URL parser で構文を検証し、https のみ許可
- scheme/host を小文字化、既定 port と fragment を除去
- path と query は署名 URL の意味を変えうるため保持
- redirect 先の追跡、OGP、サムネイル、ファイル download はしない
- provider は hostname から google_drive / dropbox / figma / other 等を表示用に推測するだけ

期限切れ・権限不足はエトリエ側では検知せず、管理画面に「リンクを開けない場合は依頼者へ再共有を依頼」と表示する。管理者の追加・編集・削除を許可し、将来 requester page へ返す場合は project 単位の明示 allowlist を使う。

### 2.3 natori_quotes

現行列を維持し、次を nullable で追加する。

| カラム | 型 | NULL | 責務 |
| --- | --- | --- | --- |
| request_snapshot | jsonb | 可 | 発行時点の request_data コピー。legacy quote は NULL |
| pricing_snapshot | jsonb | 可 | 発行時点の preset 情報、mapping version、最終明細、警告への判断、合計 |

新規 quote の amount は pricing_snapshot.total と一致させる。RPC は正の整数を必須にする。DB の CHECK を > 0 に強化するのは、無料案件方針と既存0円 quote の有無を確認してから行う。

公開後は natori_quotes の snapshot、amount、subject/body snapshot を更新しない。修正は必ず新 version を発行する。project.amount は作業中の現在値、quote.amount は公開した契約候補版、payment transaction は入金の真実源である。

推奨 index は既存の project/version UNIQUE、active token hash UNIQUE を維持する。JSONB 用 GIN は Phase 1 では不要。

### 2.4 natori_project_activity

natori_events は個人カレンダーであり、案件監査に転用しない。新規 lifecycle event から service-only の activity table に記録することを推奨する。

| カラム | 型 | NULL | 責務 |
| --- | --- | --- | --- |
| id | uuid | 不可 | PK |
| project_id | uuid | 不可 | project FK、CASCADE |
| event_type | text | 不可 | request_received、type_confirmed、quote_issued、quote_accepted、payment_recorded、rough_sent、delivery_sent、delivery_accepted、closed、reopened、archived、restored 等 |
| actor_type | text | 不可 | requester / admin / webhook / system |
| actor_user_id | uuid | 可 | auth.users FK。system/requester token は NULL 可 |
| payload | jsonb | 不可 | default empty object。event 固有の非機微 metadata |
| idempotency_key | text | 可 | webhook/RPC の二重記録防止 |
| created_at | timestamptz | 不可 | now |

制約/index:

- event_type と actor_type は許容値 CHECK
- idempotency_key は最大200文字
- UNIQUE(project_id, idempotency_key) WHERE idempotency_key IS NOT NULL
- INDEX(project_id, created_at DESC)

専用台帳を置き換えない。金額は payment transactions、メールは order mail logs、quote 状態は quotes が真実源であり、activity は横断 timeline 用の参照である。過去 note を自動分解して backfill しない。

activity が Phase 1 の日程に入らない場合も、新フォーム回答を note に複製しない。新しい機械ログの note 追記を止める作業だけは行う。

### 2.5 natori_pricing_configs

config JSON に schemaVersion を導入し、reader は version ごとに parse する。各配列内の item ID は user/preset 内で一意、ASCII の stable ID とする。label と price を編集しても ID は変えない。

追加推奨:

- UNIQUE(user_id, preset_key) は維持/確認
- user_id ごとの is_default = true を1件にする partial UNIQUE
- config schemaVersion と stable ID 重複を共有 Zod schema で検証

現行6件は2所有者 × 3 preset で、ID は全 preset で共通している。基本料金は bust_up / waist_up / full_body、固定項目は commercial_use 等である。

## 3. RLS・権限方針

新規 table は次の方針を採用する。

1. RLS を enable。
2. PUBLIC、anon、authenticated の table privilege を revoke。
3. service_role の必要 privilege だけを grant。
4. Phase 1 は browser から Supabase Data API を直接呼ばず、認証済み server route だけを経由。
5. 将来 owner access を追加するときは、project_id から natori_projects.user_id = auth.uid() を EXISTS で検証し、project の deleted_at と token scope も route で確認。
6. SECURITY DEFINER は PUBLIC/anon/authenticated の EXECUTE を revoke、service_role のみ grant。SET search_path = '' と public.table の完全修飾名を使用。
7. RPC に p_user_id を渡す場合も、対象 project の user_id と一致することを lock 後に確認。

Storage は private bucket + service role upload + short-lived signed URL を維持する。既存の無条件 INSERT policy を解消し、bucket_id と認証主体を限定した policy 以外を許さない。natori-deliveries には app の200MB制限だけでなく bucket 側の size/MIME 制限も設定候補とする。

## 4. 正式な NatoriRequestDataV1

### 4.1 TypeScript 型

~~~ts
export type NatoriInquiryModeV1 = "consultation" | "quote";

export type NatoriRequestTypeV1 =
  | "undecided"
  | "icon"
  | "sd"
  | "standing"
  | "illustration"
  | "other";

export type NatoriCommissionScopeV1 =
  | "undecided"
  | "bust_up"
  | "waist_up"
  | "full_body"
  | "other";

export type NatoriUsageTypeV1 =
  | "social_icon"
  | "streaming"
  | "video_thumbnail"
  | "trpg"
  | "original_character"
  | "print"
  | "merchandise"
  | "advertising"
  | "other";

export type NatoriSelectedOptionV1 = {
  /** 料金設定またはフォーム設定内で不変の ID。最大64文字。 */
  id: string;
  /** 送信時に依頼者が見た表示名の snapshot。最大100文字。 */
  label: string;
  /** 同一項目の数量。1〜10。 */
  quantity: number;
  /** 数量や希望の補足。最大300文字。 */
  notes: string;
};

export type NatoriBudgetV1 =
  | {
      kind: "undecided";
      min: null;
      max: null;
      currency: "JPY";
    }
  | {
      kind: "range";
      min: number;
      /** 上限なしは null。 */
      max: number | null;
      currency: "JPY";
    }
  | {
      kind: "fixed";
      /** fixed は min = max。 */
      min: number;
      max: number;
      currency: "JPY";
    };

export type NatoriDeadlineV1 =
  | {
      kind: "undecided" | "standard";
      date: null;
      note: string;
    }
  | {
      kind: "preferred_date";
      /** YYYY-MM-DD */
      date: string;
      note: string;
    }
  | {
      kind: "rush_consultation";
      /** 希望日がまだなければ null。 */
      date: string | null;
      note: string;
    };

export type NatoriLegacyRequestSourceV1 = {
  formVersion: "natori-portfolio-v1";
  requestTypeLabel: string;
  planLabel: string;
  optionLabels: string[];
  budgetLabel: string;
  deadlineLabel: string;
  referenceUrlsText: string;
  details: string;
  message: string;
};

export type NatoriRequestDataV1 = {
  schemaVersion: 1;
  formVersion: "etorie-request-v1" | "natori-portfolio-v1";

  inquiryMode: NatoriInquiryModeV1;

  requestType: NatoriRequestTypeV1;
  requestTypeOther: string | null;

  commissionScope: NatoriCommissionScopeV1;
  commissionScopeOther: string | null;

  options: NatoriSelectedOptionV1[];

  usageTypes: NatoriUsageTypeV1[];
  usageTypeOther: string | null;

  commercialUse: "none" | "yes" | "unknown";
  publicationPolicy:
    | "allowed"
    | "delayed"
    | "work_private"
    | "fully_private"
    | "unknown";

  budget: NatoriBudgetV1;
  deadline: NatoriDeadlineV1;

  characterFeatures: string;
  expressionMood: string;
  composition: string;
  colorDirection: string;
  referenceNotes: string;
  message: string;

  /**
   * 現行フォームから V1 を作る間だけ、表示ラベルと自由記述を
   * 欠損なく保持する。新フォームでは null。
   */
  legacySource: NatoriLegacyRequestSourceV1 | null;
};
~~~

氏名とメールは request_data に複製せず、natori_projects.client_name/client_email を使う。画像は natori_inquiry_reference_files、外部 URL は natori_project_reference_links を使う。

### 4.2 候補型からの変更理由

- deadline に standard を追加した。現行の「通常（約1ヶ月前後）」は none や preferred_date では欠損なく表せない。
- options を string[] から stable ID、表示 snapshot、数量、補足を持つ object[] にした。
- usageTypes は既知値を列挙し、その他だけ usageTypeOther へ逃がす。
- budget に currency を固定し、金額は0以上の整数、range は max >= min、fixed は min = max とする。
- legacySource を追加した。現行 details は複数項目を含む自由文であり、機械的に characterFeatures 等へ分解すると原回答が失われる。
- request_data は NULL 可・default なしとする。空 object は valid V1 ではなく、legacy を正しく表せない。

### 4.3 schemaVersion の更新

- writer は常に最新 version を新規保存する。
- reader は schemaVersion を discriminant にした union で V1/V2 を読む。
- 既存 JSON を request のたびに暗黙 upgrade しない。
- UI で編集版を作る場合は原 snapshot を残し、別の管理補正または新 revision として扱う。
- quote 発行時はその時点の request_data を request_snapshot にコピーする。その後 project.request_data の表示/訂正があっても公開 quote は変わらない。
- V2 が必要になった時点で migration script による一括変換ではなく、reader fallback と明示的な upgrade command を用意する。

## 5. JSON 例

### 5.1 内容がほぼ未定の相談

~~~json
{
  "schemaVersion": 1,
  "formVersion": "etorie-request-v1",
  "inquiryMode": "consultation",
  "requestType": "undecided",
  "requestTypeOther": null,
  "commissionScope": "undecided",
  "commissionScopeOther": null,
  "options": [],
  "usageTypes": [],
  "usageTypeOther": null,
  "commercialUse": "unknown",
  "publicationPolicy": "unknown",
  "budget": {
    "kind": "undecided",
    "min": null,
    "max": null,
    "currency": "JPY"
  },
  "deadline": {
    "kind": "undecided",
    "date": null,
    "note": ""
  },
  "characterFeatures": "",
  "expressionMood": "",
  "composition": "",
  "colorDirection": "",
  "referenceNotes": "",
  "message": "配信用のイラストを考えています。内容から相談したいです。",
  "legacySource": null
}
~~~

### 5.2 通常の見積依頼

~~~json
{
  "schemaVersion": 1,
  "formVersion": "etorie-request-v1",
  "inquiryMode": "quote",
  "requestType": "icon",
  "requestTypeOther": null,
  "commissionScope": "bust_up",
  "commissionScopeOther": null,
  "options": [
    {
      "id": "expression_variation",
      "label": "表情差分",
      "quantity": 2,
      "notes": "笑顔と困り顔"
    }
  ],
  "usageTypes": ["social_icon"],
  "usageTypeOther": null,
  "commercialUse": "none",
  "publicationPolicy": "allowed",
  "budget": {
    "kind": "range",
    "min": 5000,
    "max": 10000,
    "currency": "JPY"
  },
  "deadline": {
    "kind": "standard",
    "date": null,
    "note": ""
  },
  "characterFeatures": "ピンクのボブヘア、青い瞳、白いパーカー",
  "expressionMood": "明るい笑顔、やわらかい雰囲気",
  "composition": "正面の胸上、丸型アイコンでも顔が切れない構図",
  "colorDirection": "淡いピンクと水色",
  "referenceNotes": "添付画像は髪型と衣装の参考です。",
  "message": "",
  "legacySource": null
}
~~~

### 5.3 商用利用・完全非公開・お急ぎ相談

~~~json
{
  "schemaVersion": 1,
  "formVersion": "etorie-request-v1",
  "inquiryMode": "quote",
  "requestType": "standing",
  "requestTypeOther": null,
  "commissionScope": "full_body",
  "commissionScopeOther": null,
  "options": [
    {
      "id": "detailed_background",
      "label": "しっかり背景",
      "quantity": 1,
      "notes": "配信部屋"
    },
    {
      "id": "commercial_use",
      "label": "商用利用",
      "quantity": 1,
      "notes": "収益化済み配信で使用"
    },
    {
      "id": "private_work",
      "label": "完全非公開",
      "quantity": 1,
      "notes": ""
    }
  ],
  "usageTypes": ["streaming", "video_thumbnail"],
  "usageTypeOther": null,
  "commercialUse": "yes",
  "publicationPolicy": "fully_private",
  "budget": {
    "kind": "range",
    "min": 20000,
    "max": null,
    "currency": "JPY"
  },
  "deadline": {
    "kind": "rush_consultation",
    "date": "2026-08-05",
    "note": "配信開始日に間に合うか相談したいです。"
  },
  "characterFeatures": "黒髪ロング、猫耳、赤いジャケット",
  "expressionMood": "自信のある表情",
  "composition": "全身立ち絵、背景透過版も希望",
  "colorDirection": "黒と赤を基調",
  "referenceNotes": "外部リンクに三面図と衣装資料があります。",
  "message": "公開前案件のため、制作実績への掲載も不可でお願いします。",
  "legacySource": null
}
~~~

## 6. 入力制約

| 項目 | 型 | 相談時 | 見積時 | 最大長/件数 | 備考 |
| --- | --- | --- | --- | --- | --- |
| client_name | string | 必須 | 必須 | 100 | project 通常列 |
| client_email | email | 必須 | 必須 | 254 | project 通常列、小文字化は表示値を壊さない範囲 |
| inquiryMode | enum | consultation | quote | 1値 | status とは分離 |
| requestType | enum | undecided 可 | undecided 不可を推奨 | 1値 | other は補足必須 |
| requestTypeOther | string/null | 条件必須 | 条件必須 | 100 | requestType = other の時1文字以上 |
| commissionScope | enum | undecided 可 | undecided 不可を推奨 | 1値 | 料金基本項目の軸 |
| commissionScopeOther | string/null | 条件必須 | 条件必須 | 100 | scope = other の時1文字以上 |
| options | object[] | 任意 | 任意 | 20件 | ID最大64、label 100、notes 300、quantity 1〜10 |
| usageTypes | enum[] | 任意 | 1件以上を推奨 | 10件、重複不可 | other は補足必須 |
| usageTypeOther | string/null | 条件必須 | 条件必須 | 200 | usageTypes に other がある時 |
| commercialUse | enum | unknown 可 | unknown 可 | 1値 | unknown は見積警告 |
| publicationPolicy | enum | unknown 可 | unknown 可 | 1値 | unknown は見積警告 |
| budget | union | undecided 可 | undecided 可 | JPY整数 | 見積金額の自動確定には使わない |
| deadline | union | undecided 可 | undecided 可 | note 500 | preferred_date は date 必須 |
| characterFeatures | string | 任意 | 任意 | 1000 |  |
| expressionMood | string | 任意 | 任意 | 1000 |  |
| composition | string | 任意 | 任意 | 1000 |  |
| colorDirection | string | 任意 | 任意 | 1000 |  |
| referenceNotes | string | 任意 | 任意 | 2000 | URL 本体は別 table |
| message | string | 条件必須 | 任意 | 2000 | 相談は詳細全体が空なら必須 |
| reference images | file[] | 任意 | 任意 | 5件、各10MB | 現行制約を維持 |
| reference links | link[] | 任意 | 任意 | 5件 | HTTPS、URL 2048、label 100 |
| request_data 全体 | JSON object | 必須（新フォーム） | 必須（新フォーム） | 64KiB | legacy project は NULL |

共通条件:

- characterFeatures、expressionMood、composition、colorDirection、referenceNotes、message の少なくとも1つは非空。
- quote mode でも requestType と commissionScope は undecided を許可する。quote は見積希望の受付であり、管理 project.type は管理者が確認するまで undecided のまま。正式見積の発行条件は P1-09 で検証する。
- unknown は入力拒否ではなく review warning にする。依頼者が分からない状態でフォームを離脱させない。
- text は trim し、制御文字を拒否する。表示時は text として escape し HTML として扱わない。

## 7. フォーム回答から案件への変換

### 7.1 新フォーム

| 入力 | project 初期値 |
| --- | --- |
| client name/email | client_name / client_email |
| inquiryMode | request_data にのみ保存 |
| requestType | request_data の原回答。project.type は undecided |
| budget | request_data。project.amount は NULL |
| deadline | request_data。project.due_date は NULL |
| consultation | status = inquiry、next_action = 相談内容を確認 |
| quote | status = inquiry、next_action = 内容確認・案件種別を確定 |
| title | request type の表示 snapshot + client name から安全に生成 |
| task | 生成しない |

管理者が project.type を icon/sd/standing/illustration のいずれかへ確定した時に、専用 RPC で task template を一度だけ生成する。制作開始後の type 変更は通常禁止し、必要時は明示的な task 再構成確認を要求する。

public submission 用 create RPC は natori_create_project_with_tasks_v2 のように別名で追加し、request_data、reference file paths、reference links を1 transaction で保存する。旧 RPC は rollback 期間中維持する。PostgREST の overload 解決を避けるため、同名 overload より versioned name を推奨する。

### 7.2 現行フォームとの移行期間

- 現行の全表示値と自由文を legacySource にそのまま保存する。
- requestType/plan/option label が既知の stable mapping に完全一致したものだけ structured field へ変換する。
- 認識できない値を illustration や bust_up へ倒さない。undecided/other と warning にする。
- refUrls は改行等で分割し、HTTPS URL として個別検証できたものだけ link row にする。残りの原文は legacySource.referenceUrlsText に残す。
- 過去 project は request_data を作らず、既存 note parser で表示する。

現行入力の欠損防止表:

| 現行 field | V1/通常列 | 欠損防止 |
| --- | --- | --- |
| name | projects.client_name | そのまま |
| email | projects.client_email | そのまま |
| requestType | requestType、必要なら requestTypeOther | 元 label を legacySource.requestTypeLabel に保持 |
| plan | commissionScope または requestType の既知 mapping | 元 label を legacySource.planLabel に保持 |
| options | stable ID が一致した options | 全 label を legacySource.optionLabels に保持 |
| budget | budget union | 元 label を legacySource.budgetLabel に保持 |
| deadline | standard / rush_consultation | 元 label を legacySource.deadlineLabel に保持 |
| refImages | inquiry_reference_files | file metadata と private object を維持 |
| refUrls | project_reference_links | parse できない原文も legacySource.referenceUrlsText に保持 |
| details | structured fields へ自動分解しない | legacySource.details に全文保持 |
| message | message | legacySource.message にも現行送信値を保持 |

したがって現在の form payload は V1 + 通常列 + file/link table で欠損なく表現できる。ただし legacySource を外して details を機械分解する案では欠損するため採用しない。

## 8. 見積候補の型と変換規則

~~~ts
export type NatoriQuoteItemV1 = {
  itemId: string;
  kind: "base" | "fixed" | "percentage" | "manual";
  label: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  sourceField: string | null;
  ruleId: string | null;
};

export type NatoriReviewWarningV1 = {
  warningId: string;
  code:
    | "request_type_unresolved"
    | "scope_unresolved"
    | "commercial_use_unknown"
    | "publication_unknown"
    | "rush_requires_confirmation"
    | "deadline_requires_confirmation"
    | "pricing_rule_missing"
    | "copyright_requires_manual_quote";
  message: string;
  sourceField: string;
};

export type EstimateSuggestionV1 = {
  schemaVersion: 1;
  mappingVersion: "estimate-suggestion-v1";
  pricingPresetId: string;
  automaticItems: NatoriQuoteItemV1[];
  reviewItems: NatoriReviewWarningV1[];
  ignoredFields: string[];
};
~~~

変換規則:

| 回答 | 現行 preset での扱い |
| --- | --- |
| commissionScope = bust_up | base item ID bust_up を候補 |
| commissionScope = waist_up | base item ID waist_up を候補 |
| commissionScope = full_body | base item ID full_body を候補 |
| requestType = icon/sd/standing/illustration | project type 候補。現行 preset では基本料金に直接変換しない |
| option.id が preset の fixed item ID | 該当 fixed item を候補 |
| option.id = additional_character | quantity と percentage rule から候補 |
| commercialUse = yes | commercial_use を候補。既に option にあれば重複排除 |
| commercialUse = unknown | warning |
| publicationPolicy = work_private | sample_usage_denied を候補 |
| publicationPolicy = fully_private | private_work を候補 |
| publicationPolicy = unknown | warning |
| deadline = rush_consultation | rush_delivery 候補 + 可否確認 warning |
| deadline = preferred_date | 納期可否 warning |
| copyright transfer の希望 | 金額自動決定せず warning |
| scope が undecided/other、rule 不在 | default 基本料金を入れず warning |

現行候補表の requestType → アイコン/SD/立ち絵/一枚絵基本料金は、現行 pricing config には対応 ID がない。これを自動化する場合は、商品種別基本料金を追加するか、requestType × commissionScope の価格行列を追加するという事業判断が必要である。Phase 1 の初期実装は現行 scope 基本料金を尊重する。

mapping は version 付きコード定数、pricing は user ごとの config に置く。label の部分一致で結び付けない。config に必要 ID がない場合は warning にし、代替項目を黙って採用しない。

## 9. 管理者補正と見積公開

### 9.1 管理者補正

- request_data は依頼者原回答として上書きしない。
- 管理者は project.type、amount、due_date、delivery_plan、next_action を確定する。
- 原回答に訂正が必要な場合は「管理補正」object または activity payload として、元値、補正値、理由、時刻を残す。V1 JSON を直接書き換えない。
- external link は管理者が row 単位で編集できる。編集履歴が必要なら activity に記録する。

### 9.2 quote 発行 precondition

採用推奨:

1. project は deleted_at IS NULL。
2. status は受注前。
3. type は4つの concrete type のいずれか。
4. amount は正の整数。
5. due_date は非 NULL。
6. finalItems の合計 = quote amount = project amount。
7. request_snapshot と pricing_snapshot は新フォーム由来 project では必須。
8. 未解決 warning は管理者が resolution を記録。

無料案件を許可する、または納期未定の概算見積を公開する場合は 4/5 を変える必要があるため事業判断とする。支払いリンクは必ず accepted quote の amount を基準にし、project の legacy mirror だけを信頼しない。

### 9.3 Pricing snapshot

~~~ts
export type NatoriQuotePricingSnapshotV1 = {
  schemaVersion: 1;
  mappingVersion: "estimate-suggestion-v1";
  currency: "JPY";
  pricingPreset: {
    id: string;
    presetKey: string;
    name: string;
    configSchemaVersion: number;
  };
  projectTerms: {
    type: "icon" | "sd" | "standing" | "illustration";
    dueDate: string;
    deliveryPlan: "normal" | "rush_14_days" | "rush_7_days";
  };
  finalItems: NatoriQuoteItemV1[];
  reviewDecisions: Array<{
    warningId: string;
    resolution: "accepted" | "priced_manually" | "not_applicable";
    note: string;
  }>;
  subtotal: number;
  total: number;
};
~~~

全 pricing config を複製する必要はない。公開金額を再現できる最終 item の ID、label、単価、数量、rule ID と preset/version を保存する。request_snapshot は別列に完全コピーする。

## 10. 状態遷移

~~~text
public form
  consultation ─┐
                 ├─> inquiry ─> estimating ─> quoted ─> awaiting_payment
  quote request ─┘                                      │
                                                       payment
                                                         v
rough <-> lineart <-> coloring <-> waiting -> delivery_prep
  -> delivered -> completed

受注前の inquiry / estimating / quoted / awaiting_payment
  -> closed
closed -> inquiry（再開）
~~~

初期値:

| mode | status | project.type | amount | due_date | task | next_action |
| --- | --- | --- | --- | --- | --- | --- |
| consultation | inquiry | undecided | NULL | NULL | なし | 相談内容を確認 |
| quote | inquiry | undecided | NULL | NULL | なし | 内容確認・案件種別を確定 |

consulting は legacy alias として reader/transition の互換だけ維持し、新規保存しない。type 確定 → task 生成 → 見積作成の順序を UI と RPC で強制する。入金前に制作工程へ入らない既存 guard は維持する。

## 11. データ責務

| データ | 真実源 | 更新方針 |
| --- | --- | --- |
| 依頼者の原回答 | projects.request_data | 送信後は不変。legacy は NULL + note |
| 受付画像 | inquiry_reference_files + private Storage | file row 単位 |
| 外部資料 | project_reference_links | URL row 単位 |
| 管理上の確定値 | projects の type/amount/due/status/plan | 管理者/RPC が更新 |
| 公開した見積版 | quotes | 発行後不変、新版を追加 |
| 発行時の依頼回答 | quotes.request_snapshot | 発行時コピー、不変 |
| 見積明細・根拠 | quotes.pricing_snapshot | 発行時コピー、不変 |
| 入金事実 | payment_transactions | append-only |
| メール送信 | order_mail_logs | state machine |
| 内部メモ | projects.note | 人が編集する短いメモ |
| 横断 timeline | project_activity | append-only、専用台帳への参照 |
| 現在値 mirror | projects の quote/payment 列 | 互換表示用。真実源から検証可能にする |

active_quote_id を quote の現在版参照として維持する。旧 token、quote_accepted_amount、quoted_amount は Phase 1 では削除しないが、新規 reader は active quote を優先する。paid_at/paid_amount/payment_confirmed_at は一覧用 summary とし、transaction ledger との整合性 SELECT をリリース検証へ入れる。

delivery_accepted_at は依頼者の受取、completed_at は業務完了として分けたままにする。受取で両方を同時に進めるなら、将来 atomic RPC 化する。

## 12. UI の後方互換

- request_data が valid V1: 構造化 section を表示。
- request_data が NULL: 現行 inquiryNoteView で legacy note を表示し、「旧形式」と明示。
- request_data が壊れている/未知 version: エラーで案件全体を落とさず、raw data は server log に個人情報を出さず、legacy note と警告を表示。
- amount NULL は「未定」、0 は無料案件を許す場合のみ「0円/無料」。
- due_date NULL は「未定」。calendar/schedule/capacity 対象から除外し、問い合わせ一覧には created_at で並べる。
- type undecided は「未確定」。result type 集計と task template から除外。
- archived project は全通常一覧・集計から server query で除外し、archive view だけに含める。

## 13. Phase 2 アクセストークン

Phase 1 から外して問題ない。現行 quote/delivery token で契約と納品は成立している。

project へ token hash を直接追加しない理由:

- 複数端末、再発行、失効、purpose、利用履歴を1列で表せない
- project row の権限と requester credential の lifecycle が異なる
- quote/delivery の単用途 token と統合する際も複数 row が必要

Phase 2 では別 table を検討し、少なくとも次を要件化する。

- 256-bit 以上の乱数、DB には hash のみ
- purpose/scope、expires_at、revoked_at、last_accessed_at
- token rotation、複数 token、漏えい時の個別 revoke
- rate limit、失敗 audit、noindex、Referrer-Policy、URL log への token 露出抑止
- GET は表示のみ、状態変更は POST + 再認証/CSRF 相当
- project owner と token project の両方を server で確認
- requester に返す column/file を allowlist
- 既存 quote/delivery token の一括統合はせず、脅威分析と移行期間を設ける

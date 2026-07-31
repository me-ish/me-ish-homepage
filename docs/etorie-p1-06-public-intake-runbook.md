# Etorie P1-06 public intake runbook

P1-06 は公開ご依頼フォームを RequestData V1 と
`natori_create_project_with_tasks_v2` へ接続する application 変更である。
DB migration、生成型、Vercel 設定、Supabase project への操作は含まない。

## 1. rollout guard

新しい writer は既定で無効。既存 repo の flag 慣習
（`NATORI_REQUIRE_AUTH` / `CERT_ONE_TIME` と同じ「未設定なら無効、`"1"` で有効」）に
合わせた env 1本だけで切り替える。

| 変数 | 既定 | 有効値 | 影響 |
| --- | --- | --- | --- |
| `NATORI_PUBLIC_INTAKE_V2` | 未設定（無効） | `1` | `/natori/portfolio` が構造化フォームを表示し、contact API が create v2 RPC を使う |

- 未設定の環境では、フォーム UI も API 経路も現行のまま（legacy payload → 旧 RPC）。
- 値を `1` にした環境だけが structured 経路になる。
- 有効化された環境で `NATORI_OWNER_USER_ID` が未設定なら、受付は 503
  `temporarily_unavailable` で安全に失敗する（任意 owner へ倒さない）。
- P1-06 では env 値も Vercel 設定も変更していない。Preview での設定は
  統合工程で別途行う。

### 入口の version 分岐

`POST /api/natori/portfolio/contact` は payload 到着直後に1回だけ分岐する。

- `formVersion = "etorie-request-v1"`（multipart のみ）… structured 受付
- それ以外 … 現行フォーム互換の legacy 受付（挙動・レスポンス契約は据え置き）

structured を名乗る JSON payload は 400。structured payload が届いても
rollout guard が無効なら 503 で writer を使わない。

## 2. public intake owner 境界

`resolveNatoriActingUserId`（`server/natoriOwner.ts`）は管理画面向けの
session-first resolver で、単一 owner の DB 探索 fallback を持つ。公開 route で
これを使うと、無関係にログインした閲覧者の session が案件 owner になり得る。

P1-06 では責務を分離した。

- 公開受付は `server/publicIntakeOwner.ts` の `resolvePublicIntakeOwnerId()` だけを使う。
- 参照するのは `NATORI_OWNER_USER_ID` のみ。session / cookie / DB 探索を行わない。
- 未設定・UUID 形式不正はどちらも 503（設定エラー）。
- 実値は log にも response にも出さない。
- 解決した owner は `createStructuredInquiryProject({ ownerId })` へ明示的に渡す。
  値が `auth.users` に実在するかは create v2 RPC が最終確認する。
- 管理系 resolver の挙動は変更していない。

## 3. Storage cleanup と orphan 運用

### 3.1 submission 単位の境界（P1-05 契約の維持）

| RPC 結果 | Storage object | HTTP |
| --- | --- | --- |
| 成功 | cleanup しない | 201 |
| 明確な validation / rejection | 今回 upload した未参照 object だけ best-effort 削除（`inquiryProjectService` の責務） | 400 `submission_rejected` |
| 結果不明（timeout / status 0 / 5xx / malformed / response loss） | 同じ project UUID・同じ envelope で1回だけ retry。なお不明なら **削除せず保持** | 503 `temporarily_unavailable` |
| 台帳の読み取り失敗 | 1件も削除しない | 上記に同じ |

RPC 呼び出し前（画像 upload 中）の失敗だけは route が自分で削除する。
route は RPC 後の cleanup を行わず、二重削除しない。

結果不明時の project UUID は内部の突合キーとしてのみ扱い、client response と
一般 log には出さない。

### 3.2 orphan 棚卸し endpoint

既存の maintenance 基盤（`/api/cron/*` と同じ `CRON_SECRET` /
`ADMIN_API_TOKEN` 認証、service role 経由の Storage 操作）を再利用した。

`/api/natori/maintenance/inquiry-orphans`

- `GET` … dry-run 固定。副作用なし。
- `POST` … `?dryRun=0` を明示したときだけ削除する。
- bucket は `natori-inquiry-refs` 固定。
- path 形式は `{projectUuid}/{fileUuid}.webp` のみ対象。
- 既定 24 時間以上経過した object のみ候補（`minAgeHours` で延長のみ可）。
- 削除直前に `natori_inquiry_reference_files` を再確認し、台帳にある object は残す。
- 台帳・Storage の読み取りに失敗したら1件も削除せず 503。
- 一度の削除上限は既定 50 件（`limit` で縮小のみ可）。
- secret も storage path も log に出さない。

#### prefix pagination

bucket root は1回の list では読み切れないため、offset 付きで走査する。

- 内部では 100 件ページで list し、**1回の実行あたり最大 200 entry** まで消費する。
- 読み切れなかった場合は `truncated = true` と `nextOffset` を返す。
  root のページが上限ちょうどで返った場合も、後続が存在する可能性として
  `truncated = true` にする。
- 削除上限で prefix の途中を打ち切った場合は、その prefix の offset を
  `nextOffset` として返す（同じ prefix から再開する。削除済み object は
  次回の list に現れないため再実行は安全）。
- 走査し切っていれば `nextOffset = null`。
- 運用者は `?offset=<前回の nextOffset>` で続きを実行する。

response フィールド:

| field | 意味 |
| --- | --- |
| `startOffset` | 今回の走査開始位置 |
| `scannedPrefixes` | 今回検査した project UUID prefix の数 |
| `inspectedObjects` | 形式が一致した object の数 |
| `candidateCount` | 台帳未登録と確認できた orphan の数 |
| `deletedCount` | 実際に削除した数（dry-run では 0） |
| `truncated` | 未走査 prefix または未処理候補が残る可能性 |
| `nextOffset` | 次回の `offset`。走査し切っていれば `null` |

query parameter（`offset` / `minAgeHours` / `limit`）は 0 以上の整数のみを受け付け、
指定があるのに不正・範囲外なら黙って既定値へ倒さず 400 `invalid_parameter` を返す。
error response には parameter 名だけを載せ、値・path・secret は載せない。

**`vercel.json` へ schedule は追加していない。** 推測で本番 job を新設せず、
運用者が Preview / 手動で実行できる状態までを P1-06 の範囲とする。
定期実行の要否と頻度は P1-13 で判断する。

### 3.3 運用手順（結果不明 submission の突合）

1. 受付 API が 503 `temporarily_unavailable` を返した時刻を記録する。
2. 管理画面で該当時刻前後の案件が作成されているかを確認する。
   - 作成済み … object は正しく参照されている。何もしない。
   - 未作成 … 24 時間経過後に 4 へ進む。
3. 依頼者から再送があった場合は新しい submission として通常どおり処理する
   （project UUID が異なるため重複 object は独立して扱われる）。
4. `GET /api/natori/maintenance/inquiry-orphans` を dry-run で実行し、
   候補件数を確認する。
5. 想定どおりなら `POST .../inquiry-orphans?dryRun=0` を実行する。
6. 実行結果（startOffset / scannedPrefixes / inspectedObjects / candidateCount /
   deletedCount / truncated / nextOffset）を記録する。
7. `truncated = true` なら `?offset=<nextOffset>` を付けて 4〜6 を繰り返し、
   `nextOffset = null` になるまで進める。

## 4. メール契約

- DB 受付が成功した後にメールが失敗しても、案件を rollback / archive / 削除しない。
- 受付成功とメール失敗は response で区別する
  （`accepted: true` + `mailed: false` + `mailDelivery: "mail_delivery_failed"`）。
- structured メールには request_data の raw JSON、署名 URL、Storage path、
  内部 project ID、owner UUID、token、例外全文を載せない。
- 依頼者が入力した外部 URL は、既存契約どおり escape 済みの平文としてだけ載せる
  （`<img src>` にも自動リンクにもしない）。
- 添付画像は件数のみ。実体は管理画面（P1-07）から確認する。

## 5. 未解決の release gate

P1-06 を merge しても公開 writer は本番で有効にならない。有効化前に必要なもの:

- P1-07（問い合わせ詳細・type 確定 UI）
- P1-08（stable ID 見積候補）
- P1-09（quote snapshot・発行 guard v2）
- P1-11（生成型の一本化。`intakeRpcAdapter` の narrow adapter 除去）
- P1-13（E2E regression・段階 rollout・監視）
- P1-05 runbook の isolated integration matrix の実行
- Preview での `NATORI_OWNER_USER_ID` 設定有無の確認
- create v2 の race test と real Storage smoke
- orphan 棚卸し endpoint の実環境確認と、定期実行要否の判断

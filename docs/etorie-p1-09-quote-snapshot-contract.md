# Etorie P1-09 正式見積 snapshot / 発行 guard contract

作成日: 2026-08-02

## 1. 目的

P1-09 は、P1-08 が生成した見積候補を管理者が確認・採用した後、正式見積として不変 snapshot に固定し、安全に版付き発行する。

正式見積発行後に案件内容、料金プリセット、mapping、メール本文が変更されても、発行済み見積の契約候補内容は変化してはならない。

## 2. 現行資産

既存の `natori_quotes` は以下を既に持つ。

- `project_id`
- `user_id`
- project単位の `version`
- `title` / `client_name` / `to_email`
- `amount`
- `subject` / `body_snapshot`
- `token_hash` / `expires_at`
- `accepted_at` / `superseded_at`
- `UNIQUE(project_id, version)`

既存の承諾フローは、token hashで版付き見積を取得し、公開後の内容を案件現在値から再計算しない。

P1-09ではこの設計を維持し、全面置換しない。

## 3. 追加 snapshot

`natori_quotes` に次を nullable で追加する。

### request_snapshot

発行時点の依頼原回答 snapshot。

- structured inquiry: 検証済み `NatoriRequestDataV1` を保存
- legacy inquiry: `NULL`
- 発行後更新禁止

### pricing_snapshot

発行時点の正式見積根拠を保存するJSON object。

最低限、次を含む。

- `schemaVersion: 1`
- `mappingVersion`
- `pricingConfigVersion`
- `pricingPresetId`
- `pricingPresetNameSnapshot`
- `projectTypeSnapshot`
- `items`
- `reviewResolutions`
- `subtotalBeforePercentage`
- `total`
- `currency: "JPY"`
- `issuedAt`

各 `items` は最低限次を持つ。

- `id`
- `presetItemId | null`
- `kind: base | fixed | percentage | manual`
- `labelSnapshot`
- `quantity`
- `unitAmount`
- `amount`
- `automatic`
- `sourceFields`
- `ruleId | null`
- `note | null`

発行時点の金額・表示名・根拠を snapshot として保持し、発行後にプリセットを参照して再構築しない。

## 4. 発行前条件

正式見積発行は、以下をすべて満たす場合だけ許可する。

1. 対象projectが存在し、発行者の所有projectである
2. projectがsoft deleteされていない
3. project typeが `undecided` ではない
4. structured inquiryの場合、request_dataが共有schemaで検証可能
5. 未解決blockerが0件
6. 正式明細が1件以上ある
7. `pricing_snapshot.total` が正の安全整数
8. quoteの `amount` と `pricing_snapshot.total` が一致
9. itemごとの `amount = unitAmount * quantity`
10. item合計とtotalが一致
11. `subject` / `body_snapshot` / 宛先が空でない
12. idempotency keyが有効

legacy quoteは `request_snapshot = NULL` を許可するが、pricing snapshotと金額整合性は必須とする。

## 5. 発行RPC

正式発行はserver側から単一RPCで行う。

推奨名:

- `natori_issue_quote_v1`

RPCの責務:

1. project rowを `FOR UPDATE` でlock
2. ownerとsoft delete状態を検証
3. idempotency keyの重複を検証
4. 現在の最大versionから次versionを採番
5. 既存active quoteをsupersede
6. 新quoteをsnapshot付きでinsert
7. `natori_projects.active_quote_id` を新quoteへ更新
8. projectの管理用現在金額を正式見積額へ更新
9. 必要なstatus / next_actionを一貫して更新
10. quote ID・version・再利用結果を返す

採番、supersede、project更新をapplication側の複数queryへ分割しない。

## 6. 冪等性

発行要求には `idempotency_key` を必須とする。

推奨:

- quote側に最大200文字の通常列を追加
- `UNIQUE(project_id, idempotency_key)`

同一project・同一keyの再実行は新versionを作らず、既存quoteを返す。

別projectで同じkeyを使うことは許可してよい。

## 7. 不変性

発行済みquoteについて、次を直接更新してはならない。

- `request_snapshot`
- `pricing_snapshot`
- `amount`
- `title`
- `client_name`
- `to_email`
- `subject`
- `body_snapshot`
- `version`
- `token_hash`
- `created_at`

許可される状態更新は原則として以下に限定する。

- `accepted_at`
- `superseded_at`

修正は既存行の上書きではなく、新version発行で行う。

不変性はservice規約だけでなく、DB triggerまたは権限分離で防御する。

## 8. blocker解決 snapshot

P1-08のwarningを単に削除して発行してはならない。

`reviewResolutions` に最低限次を保存する。

- warning `code`
- `ruleId`
- `resolution: accepted | overridden | not_applicable`
- 管理者メモ
- 解決時刻

blockerは解決記録なしでは発行不可。

attentionは未解決でも発行可能とするか、UIで明示確認を必須とする。P1-09では後者を推奨する。

## 9. メール送信との境界

正式見積のDB発行とメール送信は分ける。

- quote発行RPC成功を先に確定
- その後、発行済みquote snapshotを使ってメール送信
- メール失敗時もquoteを削除・巻き戻ししない
- 再送は同じquote/versionを使う
- 再送で新quoteを発行しない

`natori_order_mail_logs.quote_id` で発行済みquoteに紐付ける。

## 10. 承諾フローとの整合

承諾ページは引き続き発行済みquote rowだけを参照する。

- projectの現在amountを表示根拠にしない
- superseded quoteは承諾不可
- accepted quoteは期限後も承諾済み表示を維持
- 承諾RPCはquoteとprojectを同一transactionで更新

P1-09は既存 `natori_accept_quote` の意味を壊さない。

## 11. migration方針

想定追加:

- `request_snapshot jsonb NULL`
- `pricing_snapshot jsonb NULL`
- `idempotency_key text NULL`
- `issued_at timestamptz NULL` または既存 `created_at` を発行時刻として正式採用
- idempotency partial unique index
- JSON object / size上限の粗いCHECK
- snapshot不変trigger
- `natori_issue_quote_v1` RPC

既存quoteはbackfillしない。

- 既存行はsnapshot NULLのlegacy quoteとして維持
- 既存token、version、accepted/superseded状態を変更しない

## 12. テスト

最低限、次を自動化する。

### schema / RPC

- snapshot列と制約
- PUBLIC / anon / authenticatedからRPC実行不可
- service_roleのみ実行可
- owner不一致拒否
- soft deleted project拒否
- undecided type拒否
- blocker残存拒否
- amount / total不一致拒否
- item合計不一致拒否
- 同一key再実行で同一quote返却
- 並行発行でもversion重複なし
- 新版発行で旧版supersede
- snapshot直接更新拒否

### service

- structured request snapshot保存
- legacy request snapshot NULL
- 発行後にpricing configを変えてもquote表示不変
- メール再送でquote版が増えない
- メール失敗でもquoteが残る

### UI

- blockerが残ると発行不可
- warning解決内容がsnapshotへ入る
- 発行成功後にquote ID / versionを表示
- 再送と改訂発行を区別

## 13. 非対象

- quote PDF生成
- 電子署名
- requester account
- payment link自動発行
- 無料案件の正式運用
- 過去quote snapshotのbackfill
- pricing preset全履歴table

## 14. 中断条件

次の場合はmigration実装前に止めて再設計する。

- 既存quote発行処理が複数経路に分散し、単一RPCへ安全に集約できない
- 既存0円quoteが存在し、正額必須化の事業判断が未確定
- quoteのimmutabilityが既存運用と衝突する
- blocker解決情報の保存shapeが業務上未確定
- 発行とメール送信を同一transactionにする必要があるという要求が出た場合

# Etorie P1-08 stable ID 見積候補 contract

作成日: 2026-08-02

## 1. 目的

P1-08 は、依頼文の label keyword 判定と `bust_up` の暗黙 fallback を廃止し、`NatoriRequestDataV1` の stable ID と、管理者が確定した案件の商品種別を入力として、説明可能な見積候補を生成する。

この ticket は見積「候補」を生成する。正式見積の immutable snapshot と DB 発行 guard は P1-09 の責務とする。

## 2. 料金軸

Phase 1 ADR に従い、基本料金の主キーは商品種別とする。

- `icon`
- `sd`
- `standing`
- `illustration`

`commissionScope` は補助情報であり、基本料金を自動選択しない。scope と商品種別が矛盾する可能性がある場合は review item を生成する。

`other`、`undecided`、未知 ID は既存商品へ推測 mapping しない。

## 3. version

- pricing config schema: `schemaVersion: 1`
- stable mapping: `mappingVersion: "natori-pricing-mapping-v1"`
- estimate suggestion: `schemaVersion: 1`

既存の version なし pricing config は compatible reader で V1 として読む。保存時は `schemaVersion: 1` を付与する。読めない config を既定料金へ黙って置換しない。

## 4. 出力 contract

### QuoteItemV1

各自動候補は、最低限次を持つ。

- `id`: suggestion 内の一意 ID
- `presetItemId`: pricing preset 内の stable item ID
- `kind`: `base | fixed | percentage`
- `labelSnapshot`
- `quantity`
- `unitAmount`
- `amount`
- `sourceField`
- `ruleId`
- `automatic: true`

割合料金は、基準額と rate を根拠として保持する。丸め規則は既存の100円単位を維持する。

### ReviewWarningV1

- `code`
- `severity`: `blocker | attention`
- `title`
- `action`
- `sourceField`
- `ruleId`

### EstimateSuggestionV1

- `schemaVersion`
- `mappingVersion`
- `pricingConfigVersion`
- `automaticItems`
- `reviewItems`
- `ignoredFields`
- `subtotalBeforePercentage`
- `total`
- `canIssueQuote`

P1-08 時点の `canIssueQuote` は UI guard であり、P1-09 で DB guard を追加する。

## 5. stable mapping

### 基本料金

案件の確定済み `project.type` を pricing preset の同一 stable ID へ mapping する。

- `icon -> icon`
- `sd -> sd`
- `standing -> standing`
- `illustration -> illustration`

対応 item が preset にない場合:

- automatic base item は0件
- `pricing_base_rule_missing` blocker
- 別 item を採用しない

### fixed option

request option の stable ID と preset item ID が一致した場合だけ候補化する。

対象例:

- `complex_prop`
- `mascot_prop`
- `expression_variation`
- `detailed_background`
- `retake_extra`

同一 ID が複数送られても item は1行にまとめ、quantity を合算する。quantity は request schema の上限内で扱う。

### percentage option

- `additional_character`

quantity は追加人数として扱い、1件ごとの割合料金を計算する。基準額は商品種別の基本料金だけとし、fixed option や短納期料金を重ねた小計を基準にしない。

### request field 由来

- `commercialUse = yes` -> `commercial_use`
- `publicationPolicy = work_private` -> `sample_usage_denied`
- `publicationPolicy = fully_private` -> `private_work`
- `deadline.kind = rush_consultation` または管理確定 `deliveryPlan` が rush -> rush review/candidate

同じ料金項目が request option と field mapping の両方から到達した場合、`presetItemId` 単位で1件にまとめ、二重課金しない。複数根拠は source metadata に保持する。

## 6. warning / ignored field

次は管理者確認対象とする。

- project type が未確定
- 基本料金 rule 不在
- request type が `other` / `undecided`
- commission scope が `other` / `undecided`
- commercial use が `unknown`
- publication policy が `unknown` / `delayed`
- rush consultation または希望日と管理納期プランの不一致
- copyright transfer を示す stable option ID
- unknown option ID
- pricing preset 内の重複 stable item ID

`commissionScope`、`usageTypes`、自由記述、予算、通常納期など、P1-08で直接料金化しない情報は `ignoredFields` に理由付きで表示する。ignored は「読み落とし」ではなく、「自動料金化しないと判断した入力」を意味する。

## 7. UI

EstimateForm は structured inquiry が選択された場合、依頼文 keyword engineではなく stable ID engineを使う。

表示順:

1. 自動候補明細
2. review items
3. ignored fields
4. 管理者による採用・修正後の最終明細

未解決 blocker が1件以上ある場合、見積発行操作を無効化する。単なる概算表示やコピーまで止めるかはUI責務として分離する。

legacy note 案件は既存 keyword engineを互換経路として残し、「旧形式・自動判定は参考値」の明示を行う。

## 8. 非対象

- pricing config の商品種別×scope 行列化
- request free text の意味推論
- external URL / image の内容解析
- quote snapshot のDB保存
- warning解決履歴のDB保存
- project type の自動上書き

## 9. 中断条件

次の場合は実装を止めて別 ticket / migration とする。

- 現行 preset に商品種別 stable ID が存在せず、全既存 config の data migration が必要
- warning 解決状態を永続化しないと P1-08 UI が成立しない
- quote 発行経路を安全に止めるために P1-09 DB guard を同時導入する必要がある
- percentage item の基準額が事業ルール上未確定

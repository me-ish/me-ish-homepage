# Etorie Phase 1 Domain Decisions

- Status: Accepted
- Decision owner: me-ish / Etorie project
- Decision date: 2026-07-26
- Scope: Etorie Phase 1

## Context

Phase 1 では、問い合わせ、案件化、料金提案、見積、管理画面が同じ事業ルールを共有する必要がある。未決のまま実装すると、金額未定と無料案件、納期未定と確定納期、商品種別と作業範囲が混同され、DB・RPC・UI・validation に異なる条件分岐が入り込む。

本 ADR は、Phase 1 の実装前提となる事業判断を確定する。

## Decisions

### 1. 無料案件を許可する

- 無料案件は有効な案件として許可する。
- 金額未定は `NULL` とする。
- 無料案件は `0` とする。
- UI では `NULL` を「未定」、`0` を「無料」または「0円」と表示し、両者を混同しない。

#### Reason

無償依頼、特典、モニター、例外対応を記録できる一方で、未見積の案件を誤って無料扱いしないため。

### 2. 相談・問い合わせ段階では納期未定を許可する

- consultation および初期 inquiry では `due_date = NULL` を許可する。
- 正式見積を公開・送付する時点では、確定納期または明示的な納期目安を必須とする。
- 納期未定案件はカレンダー、期限超過、稼働圧、マイルストーン計算から除外する。

#### Reason

初回相談の入力負担を下げつつ、見積確定後の約束を曖昧にしないため。

### 3. 料金の基本軸は商品種別とする

- 基本料金は商品種別に紐づける。
- 例: アイコン、立ち絵、SD、イラストなど。
- 表情差分、商用利用、短納期、追加修正などはオプションまたは加算要素として扱う。
- 作業範囲は補助情報として保持するが、基本料金の主キーにはしない。

#### Reason

依頼者と管理者が理解しやすく、料金表・フォーム・見積の対応関係を安定させやすいため。

### 4. consultation / inquiry の最低入力を少なくする

最低入力は次とする。

- 名前
- 連絡先
- 相談内容

次の項目は未定を許可する。

- 商品種別
- 作業範囲
- 予算
- 納期

quote request では、見積に必要な追加条件を validation する。

#### Reason

初期段階で依頼者に過剰な選択を強いず、相談導線の離脱を抑えるため。

### 5. unknown / other は管理者が解決する

- 依頼者は商品種別や作業範囲を `undecided` または `other` で送信できる。
- `other` を選択した場合は補足入力を必須とする。
- 管理者は案件化または見積作成前に正式な商品種別へ解決する。
- unknown label を既存 item に推測で自動対応させない。

#### Reason

問い合わせ受付の柔軟性を保ちつつ、料金計算や集計に曖昧値を残さないため。

### 6. activity table は Phase 1b とする

- `project_activity` 相当の専用 activity table は Phase 1 の必須範囲から外す。
- Phase 1 では、受付、案件化、見積、支払いの本線を優先する。
- 新規フォーム回答や機械ログを `note` へ複製しない。
- 監査履歴やイベントタイムラインが必要になった時点で Phase 1b として追加する。

#### Reason

初期リリースの複雑性を抑え、主要業務フローを先に完成させるため。

### 7. ラフ承認専用 UI は Phase 2 とする

- Phase 1 では既存の進捗管理と手動コミュニケーションで対応する。
- ラフ提出、承認、差し戻し、版管理を専用 UI として実装するのは Phase 2 とする。

#### Reason

Phase 1 の目的は受注から見積・支払いまでの基盤整備であり、制作進行の高度化は後続段階に分離した方が安全なため。

## Consequences

### Positive

- 金額未定と無料案件を区別できる。
- 納期未定の相談を受け付けられる。
- 商品種別が決まっていない依頼も受け付けられる。
- 見積時点で条件を確定できる。
- 初期実装を過剰に複雑化しない。
- DB、Zod、RPC、UI のルールを一貫させやすい。

### Trade-offs

- 管理者が undecided / other を解決する運用が必要になる。
- activity timeline とラフ承認は Phase 1 時点では簡易運用となる。
- 正式見積時の due date または納期目安 validation が必要になる。

## Implementation mapping

- P1-01: `NatoriRequestDataV1` と共有 validation に反映する。
- P1-02: `amount: number | null`、`dueDate: string | null`、`type: undecided` に対応する。
- P1-03: nullable amount / due_date、undecided type、request_data を schema に反映する。
- P1-05/P1-06: consultation と quote request の最低入力・条件分岐に反映する。
- P1-08: 商品種別を基本料金軸とし、オプションを加算要素とする。
- P1-09: 見積 snapshot と正式見積時の納期条件に反映する。
- P1-10: Phase 1b 扱いとする。

## Revisit conditions

次の場合に再検討する。

- 無料案件の頻度が高く、承認フローが必要になった場合。
- 商品種別より作業範囲を料金軸にした方が実績上合理的になった場合。
- activity timeline が監査・問い合わせ対応上の必須要件になった場合。
- ラフ承認の件数増加により、手動運用の負担や誤認が顕在化した場合。

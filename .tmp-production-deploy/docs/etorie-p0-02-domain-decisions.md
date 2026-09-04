# ADR：エトリエ Phase 1 ドメイン判断

- ADR ID: `ETORIE-PHASE1-DOMAIN-001`
- Status: Accepted
- 決定日: 2026-07-22
- 対象: Phase 1（依頼フォーム → 案件 → 見積）
- Decision owner: natoriスイート運営責任者
- 再検討時期: Phase 1実運用の初回10案件完了後、または2人目のクリエイター候補が確定した時

## 1. 背景

現行システムは問い合わせ受付時に、未確定情報を次の値へ変換している。

- 金額未定 → `amount = 0`
- 納期未定 → 受付日から約30日後
- 種別未定 → 表示文字列から4分類へ推定し、不明時は`illustration`
- 原回答 → `note`の日本語本文

Phase 1では、未確定値を事実のように保存せず、依頼者の原回答と管理者の確定値を分離する。

## 2. 決定事項

### Decision 1：無料案件

**決定: Phase 1では無料案件を正式対応しない。**

- `projects.amount = NULL`: 金額未確定
- `projects.amount >= 1`: 有料案件の確定金額
- `projects.amount = 0`: 新規運用では使用しない
- 新規quoteは正の整数だけ発行可能
- 既存0円データはlegacyとして読み取り互換のみ維持

再検討時は `billing_mode = paid | free` を追加する。

### Decision 2：正式見積の納期

**決定: 公開して承諾対象にする正式見積には、確定納期を必須とする。**

- 受付時の`projects.due_date`はNULL可
- 依頼者の希望日は`request_data.deadline`に保存
- 管理者が対応可能日を確認し、`projects.due_date`を確定
- `due_date IS NULL`では正式quoteを発行できない
- 金額だけを伝える段階は概算案内または見積調整中とする

### Decision 3：料金の基本軸

**決定: Phase 1では既存の描画範囲ベースを維持する。**

基本料金軸:

- `bust_up`
- `waist_up`
- `full_body`

責務:

- `requestType`: 案件分類・タスクテンプレート
- `commissionScope`: 基本料金候補
- options / usage / publication / rush: 加算候補または確認警告

禁止:

- `requestType`から存在しない料金項目を自動生成する
- 基本料金未一致時に`bust_up`を黙って採用する
- `commissionScope`から`project.type`を上書きする

### Decision 4：相談フォームの最低入力

**決定: 相談モードは軽量、見積モードは構造化入力を要求する。**

相談モード必須:

- 氏名
- メールアドレス
- 相談内容

見積モード必須:

- 氏名
- メールアドレス
- requestType
- commissionScope
- 制作内容を示す自由記述のいずれか1項目

見積モードでもbudget、deadline、commercialUse、publicationPolicyは未定を許可し、見積画面でreview warningにする。

### Decision 5：unknown / other

**決定: フォーム送信は許可し、正式見積発行前に管理者が解決する。**

- `unknown`はvalidation errorにしない
- `other`は補足文字列を必須にする
- `request_data`の原回答は上書きしない
- 管理者は`project.type`、見積項目、納期、利用条件を確定
- 未解決warningがある場合、`natori_issue_quote_v2`は発行を拒否
- 解決内容はpricing snapshotの`reviewDecisions`へ保存

### Decision 6：案件activity

**決定: `natori_project_activity`の本格実装はPhase 1bへ分離する。**

Phase 1必須:

- 新フォーム回答を`note`へ全文複製しない
- 新しい機械ログを`note`へ追加しない方向へ整理
- 専用台帳がある情報はそのテーブルを真実源とする

Phase 1b:

- `natori_project_activity`
- 横断タイムライン
- idempotency key
- 新規lifecycle eventのappend-only記録

### Decision 7：ラフ承認UI

**決定: Phase 2へ送る。**

Phase 1:

- 現行メール送信と`waiting`ステータスを維持
- ラフファイルの非公開Storageと署名URLを維持

Phase 2:

- 依頼者用統合案件ページ
- ラフ承認
- 修正依頼
- バージョン別履歴
- requester access token

## 3. 関連する確定仕様

### 3.1 新規案件の初期値

| 入力モード | status | type | amount | due_date | task | next_action |
| --- | --- | --- | --- | --- | --- | --- |
| consultation | inquiry | undecided | NULL | NULL | なし | 相談内容を確認 |
| quote | inquiry | undecided | NULL | NULL | なし | 内容確認・案件種別を確定 |

`consulting`はlegacy aliasとして読み取り互換だけ維持し、新規保存しない。

### 3.2 見積発行条件

- projectがactive
- 受注前status
- concreteなproject.type
- amountが正の整数
- due_dateが非NULL
- structured final itemsの合計がamountと一致
- 新形式案件ではrequest snapshotとpricing snapshotが存在
- review warningが全て解決済み

### 3.3 データの真実源

| データ | 真実源 |
| --- | --- |
| 依頼者原回答 | `natori_projects.request_data` |
| 管理上の現在値 | `natori_projects`通常列 |
| 公開見積 | `natori_quotes` |
| 見積時原回答 | `natori_quotes.request_snapshot` |
| 見積明細・根拠 | `natori_quotes.pricing_snapshot` |
| 入金事実 | `natori_payment_transactions` |
| メール送信 | `natori_order_mail_logs` |
| ファイル | 各file table + private Storage |
| 内部メモ | `natori_projects.note` |

## 4. 却下した選択肢

- `amount = 0`を未確定と無料で兼用
- 受付時に30日後をdue_dateへ保存
- 未定typeを`illustration`へ倒す
- 相談だけ`status = consulting`
- 商品種別を即時に料金基本軸へ変更

## 5. 影響するチケット

- P1-01 RequestData V1・stable ID・共有validation
- P1-02 nullable/undecided compatibility reader
- P1-03 Phase 1 additive schema・constraint
- P1-05 受付create v2・type確定RPC
- P1-06 新依頼フォーム・contact API
- P1-07 問い合わせ詳細・管理補正
- P1-08 stable ID見積候補エンジン
- P1-09 quote snapshot・発行guard v2

## 6. 再検討条件

- 無料案件を正式管理する必要が出た
- 概算見積を承諾可能な商品として扱う必要が出た
- scopeベース料金ではSD・アイコン等を表現できない
- 相談フォームの離脱率が高い
- unknown項目の管理者確認が過大な負担になる
- activity tableなしでは監査や問い合わせ対応が困難
- Phase 2の依頼者ページ設計でPhase 1データ境界が不足する
- 2人目のクリエイター候補が確定した

## 7. 結論

Phase 1は、無料案件、統合依頼者ページ、ラフ承認、自由チャット、商品種別×scopeの料金行列を対象外とする。

優先するのは次の4点。

1. 原回答の構造化保存
2. 未確定値の正しい表現
3. stable IDによる説明可能な見積候補
4. 公開見積の不変snapshot

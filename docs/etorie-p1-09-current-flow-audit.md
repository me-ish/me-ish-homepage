# Etorie P1-09 現行正式見積フロー監査

作成日: 2026-08-02

## 1. 結論

正式見積の発行経路は、現時点では `sendNatoriOrderMail(... kind: "estimate")` から `natori_issue_quote` RPC を呼ぶ1系統に集約されている。

既存設計には、次の重要資産がすでにある。

- project row の `FOR UPDATE`
- project単位のversion採番
- 旧active quoteのsupersede
- 新quote insert
- `active_quote_id` と project.amount の同一transaction更新
- token hashのみの保存
- 発行済みquote rowを参照する承諾フロー
- payment時のactive accepted quoteとの金額一致確認

したがってP1-09は全面置換ではなく、既存RPCのversioned後継を追加して段階移行する。

## 2. 現行発行経路

### application

`src/features/natori/server/orderMailService.ts`

見積メール送信時に次を行う。

1. 案件所有者・status・未入金・type確定を確認
2. 承諾tokenを生成し、DBにはSHA-256 hashのみ渡す
3. 本文へ承諾URLを差し込む
4. メール送信前に `natori_issue_quote` RPCを呼ぶ
5. 発行成功後にメールを送信
6. mail logへquote_idを記録

### database

`natori_issue_quote` は次を同一transactionで実行する。

1. projectをowner・status・未入金条件付きでlock
2. 既存active quoteをsupersede
3. `max(version) + 1` で採番
4. quote rowをinsert
5. projectのactive_quote_id、amount、token系列を更新

### acceptance / payment

- 承諾ページはtoken hashから `natori_quotes` を取得する。
- superseded quoteは拒否する。
- accepted quoteは期限切れ後もaccepted表示を維持する。
- 支払い依頼はactive quoteがaccepted済みで、入力金額がquote.amountと一致する場合のみ許可する。

## 3. P1-09で解消する差分

### 3.1 snapshot不足

現行quoteは件名・本文・金額等は固定するが、依頼原回答と正式明細根拠を持たない。

追加対象:

- `request_snapshot`
- `pricing_snapshot`
- `idempotency_key`

### 3.2 冪等性不足

現行RPCは呼ばれるたびに新versionを発行する。

必要な挙動:

- 同一project・同一idempotency keyは既存quoteを返す
- 新versionを作らない
- 旧quoteを追加でsupersedeしない

### 3.3 再送と改訂発行が未分離

現行 `kind: "estimate"` は、実質的に送信のたびに新quoteを発行する。

P1-09では明確に分ける。

- **改訂発行**: 新snapshot・新token・新versionを作る
- **再送**: 既存active quoteのsnapshotとversionを使い、新quoteを作らない

この差分はapplication serviceとUIの両方で明示する。

### 3.4 DB側の正式明細検証不足

現行RPCは `p_amount` を受け取り、その金額をそのまま保存する。

後継RPCでは最低限次を検証する。

- pricing snapshotがJSON object
- itemsが1件以上
- item amountとquantity/unitAmountの整合
- item合計とsnapshot.totalの一致
- quote amountとsnapshot.totalの一致
- unresolved blockerが0件
- project.typeがundecidedでない
- soft deleteされていない

### 3.5 不変性のDB防御不足

現行table権限はservice-onlyだが、service-role経由なら発行済みquoteの契約列を直接更新できる。

P1-09ではtriggerで契約列の更新を拒否し、許可列を原則次に限定する。

- accepted_at
- superseded_at

## 4. 互換性方針

- 既存 `natori_issue_quote` はすぐ削除しない。
- 新規 structured正式見積は `natori_issue_quote_v1` へ移す。
- legacy quoteも後継RPCを利用し、`request_snapshot = NULL` を許す。
- 既存quoteはbackfillしない。
- `natori_accept_quote` の公開contractは維持する。
- payment flowのactive accepted quote参照も維持する。

## 5. 次の実装順

1. snapshot TypeScript contractとvalidator
2. migration: nullable列・index・immutability trigger
3. `natori_issue_quote_v1` RPC
4. schema/RPC静的テスト
5. server serviceを「発行」と「再送」に分離
6. P1-08 structured見積画面から発行payloadを接続
7. テストSupabaseへ適用・検証
8. 本番反映前レビュー

## 6. 現時点の判断

- 発行経路は分散しておらず、後継RPCへの安全な集約が可能。
- メール送信前にquoteを確定する既存順序は維持できる。
- メール失敗時にquoteが残る挙動もP1-09の方針と一致する。
- 最大のapplication差分は、再送と改訂発行の分離である。
- migration実装へ進める前に、0円quoteの実データ有無だけはテストDBで確認する。

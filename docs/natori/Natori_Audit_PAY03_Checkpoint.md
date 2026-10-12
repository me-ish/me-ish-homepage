# PAY-03: 支払状況の確認とチャットの支払案内

## 現在地

実装・ローカル検証済み、本番未反映。main `9abcd1310aba049d512221c2786119af06b12e35` から独立した
`codex/audit-pay03-payment-guidance` で作業する。未マージの #162 / #163 / #164 の
差分を含めず、既存 branch の変更も行わない。

## 問題と修正範囲

相談チャットは世代情報の読取エラーを「世代なし」と扱い、旧 ready/sent リンクへ
戻っていた。また、支払 read model の available / requiresReview / confirmedAt /
linkState を使わず、要照合でも支払いボタンを表示する場合があった。
attempt 自身が needs_review の場合は元からリンクが消えるため、すべての要照合で
発生するという指摘ではない。実際の二重課金を確認したものでもない。

修正は表示に用いる共通判定 `lib/clientPayment.ts` と server adapter に限定する。確認できない状態、
要照合、確認処理中、停止・終了・期限切れでは支払いを促さず、状態を案内する。
正常な入金確認は保持し、要照合が併存する場合は追加支払いを控える案内を付ける。
旧リンクの互換は、世代情報を正常に読み取って 0 行だった場合に限る。
成功には `error:null` を要求し、応答 envelope の欠落や不正も失敗として扱う。
後の link read で入金確認や terminal を取得した場合も取り落とさない。terminal は
見積・ラフ・納品も含め全カードの操作を抑止するが、カードと確認済み事実は保持する。
SQL の契約どおり closed / deleted を terminal とし、completed は一律に閉じない。
読取間で URL・期限・状態が矛盾すれば支払案内を抑止する。内部の attempt identity /
generation / revision は shape を検査するが browser DTO へは渡さない。

## 受入確認

架空の値だけを使い、次を確認する。

- 正常な active リンク、正常な世代なし legacy ready/sent、無効な URL。
- available=false、needs_review / legacy_review、処理中、停止・終了、未知の状態。
- 期限前・期限ちょうど・期限後、不正な期限、分かれた読取の矛盾。
- 世代の 0 行と DB エラー・transport rejection を区別し、エラーで旧 URL を復活させない。
- 先の案件読取後に入金確認が届き、後の読取で確認された場合の支払いボタン抑止。
- 入金済みと要照合の併存、現在の closed / deleted、見積・ラフ・納品の回帰。
- 描画されたリンクと表示文言、型・Lint・関連 unit・全 unit・既存 CI。

## 検証結果

6.1 Sol・極高で実装と関連テストを行い、Astra・極高が独立レビューした。

- 初回の元コード: 2ファイルで 3 failures / 9 passes。要照合＋active、世代読取エラー＋
  legacy ready、見積ページの processing＋active の3件で不適切な支払誘導を再現。
- root は最終の同じ3テストを main9abcd の製品コードへコピーして再実行し、
  **3 failures / 38 skipped** を取得。skip は選択した3件以外のケースであり、
  元コードの製品ファイルは変更しなかった。検証後に test copy も元へ戻した。
- 修正後: 関連 **7ファイル / 152件成功**。Astraも同じ最終152件を独立実行して成功。
- root の最終全 unit: **235ファイル / 2,347件成功**。型検査・Lint・diff check 成功。
  Lint は既存 AnnouncementCard の img / alt 警告のみ。unit には既存 JSDOM navigation
  未実装の出力があるが、失敗・skip はなく exit0。
- 途中の旧 inactive テストは「カードなし」を要求して1件失敗した。停止状態を案内する
  今回の仕様に合わせ「停止表示あり・操作なし」へ更新した。assertion を無条件化していない。
- 最終点検で不正 envelope と後の terminal 観測を追加し、全 unit を再実行した。
- baseline static: **31 active / 55 archived、0 failures**。凍結pair
  `d395d0735ab8e25826a2654f9d38f4c3e7688f08f47405e861ba6bd2956d980a` 不変。
  schema source preflight 成功。SQL・migration manifest・元source pinsを変更していない。
- Phase6B の明示的 rendered-source inventory に新しい判定moduleと payment type の
  2パスを追加した。checksum処理・元の検査・assertion は保持し、script syntax check 成功。
- Astra最終source review: **今回の範囲でブロッカーなし**。読取契約・失敗/矛盾・表示・
  旧リンク互換・既知の限界を確認。実provider期限や旧表示の自動更新を承認対象に含めない。

CIはDraft PRの最新HEADのcheckを正とし、実runと結果をPR description / 引き継ぎ記録に
保存する。このファイルの数値はローカル検証結果であり、架空値のVitest/JSDOM検証を
実Stripe・本番DB・本番HTTP受入の成功とは扱わない。

## 本番適用の条件と限界

この項目では migration / DB 権限 / Storage の変更を追加しない。既存の支払 integrity
設定と read RPC の契約を利用するため、適用前に既存設定との互換を確認する。
`NATORI_PAYMENT_INTEGRITY_ENABLED` が無効なときは従来の表示互換を保持し、inbox の
照合・処理中確認を実施しない。`NATORI_PAYMENT_LINK_INTEGRITY_ENABLED` も有効なときは
既存 link RPC の現在情報で照合する。無効な設定で有効時と同じ確認をしたとは扱わない。
main が他 PR のマージで変わった場合は最新 main に統合し、競合と CI を再確認する。

本番コードの反映には、内容・影響を提示したユーザーの承認が必要。
main へのマージが自動デプロイを起動する構成である可能性も含め、反映方法を確認する。
PAY-03 を理由に既存リンクの一括停止、顧客行の修復、実決済・実メール送信は行わない。

複数 read の間と read 後には状態変化が起き得る。検証するのは、取得できた支払事実や
矛盾を無視して誘導しないことであり、全 read の原子的 snapshot や、表示済みの古い
ページを自動更新する保証ではない。旧 URL・メールの直リンク、provider の受付期限、
すでに開いている Checkout Session の停止は PAY-02 の別スコープ。

## 安全な手動確認経路

隔離環境の架空案件で、承認済み見積 → 正常 active の支払案内を表示する。
照合待ち・確認処理中・読取失敗へ切り替えて再読み込みし、案内は残る一方で支払い
リンクが消えることを確認する。入金確認後は「支払い完了」、要照合があれば注意も
残ることを確認する。見積とラフのカードは支払障害だけで消えないことを確認する。
実 Stripe リンクを開いて決済したり、実顧客の状態を変更したりする手順ではない。

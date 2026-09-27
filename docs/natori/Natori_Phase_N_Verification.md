# Phase N 実メール・iPhone確認（2026-09-27）

## 開始時点と目的

PR #98 は main `40a626126455914a8795cd5e14e5eacbe2bc3771` へ取り込み済み。本番 deployment `dpl_BGJoyAGpFDsb6rua2HcPFFbCMPN7` は READY。追加DB適用済み、新通知tableは0件。既存案件18件・見積り2件・決済記録6件の内容fingerprintは前後で一致。旧RPC・既存token/URL・確定記録は保持した。

ただし `NATORI_ACCEPTANCE_OUTBOX_ENABLED` と `NATORI_NOTIFICATION_SENDING_ENABLED` は未設定（OFF）。実Resend受付・受信箱到着・iPhone Safariの確認を終えるまでは、通常業務を新通知経路へ切り替えない。PR #98 本文に本番移行の詳細を記録している。

ユーザーはナトリ先生の既存通知先への架空案件メール3通（見積り承諾・受取完了・受取控え）を明示承認した。本確認画面は、その許可済み試験だけを既存serverの送信設定で行う。秘密のAPI keyを取り出したり、正式案件を承諾/受取して試験したりしない。Stripe・Storage・相談・本番業務行への変更はない。

## 送信境界

- `/natori/dashboard/notification-check` と `/api/natori/admin/notification-verification`。既存管理画面layoutと管理APIの認証を使用する。POSTには既存CSRF保護。認証を緩めたり別の公開入口を設けたりしない。
- Productionのみ `NATORI_NOTIFICATION_VERIFY_ENABLED=1`。Previewは明示拒否。開放時間は **2026-09-27 09:00 UTC以上、18:00 UTC未満（日本時間18時〜翌日3時）**。時間外はフラグが残っていても停止する。
- To/Reply-Toを承認済みの `natori.o0716@gmail.com`、Fromを `ナトリ（me-ish） <noreply@me-ish.art>` に固定。BCCなし。現在の明示設定が一致しなければ、1通目の通信前に停止する。UI/APIから宛先、本文、案件ID、keyを指定できない。
- 本番と同じpayload builder・Resend HTTP送信関数を使用し、固定の架空snapshotに「テスト・対応不要」を明示する。GET・画面表示では送らず、管理者が送信ボタンを押したPOSTでだけ送る。
- campaign `natori-phase-n-verification-20260927-v1` と3purposeから各1個の固定idempotency keyを作る。同じkeyには同じpayloadだけを渡す。押し直し・並行リクエスト・結果不明からの復旧でもkeyを変えない。
- 9時間のハード期限はproviderの24時間保持より短い。期限の延長やkeyの交換で結果不明を迂回しない。補助の5回/10分/IP制限はインスタンス内制限であり、全体の重複防止は固定keyと期限で担保する。
- 新しいDB/table/通知jobは作らない。応答はpurpose/status/受付時刻だけ。本文・宛先・provider ID・key・秘密情報をログや応答へ出さない。既存管理APIの認可用読み取りと操作監査は維持する。

## 確認手順

1. この変更のPRで通常CI、Phase N実DB/ブラウザ試験、Vercel Preview buildを確認する。本番用メール資格情報をCIへ渡さない。
2. Productionに確認専用フラグだけを追加し、レビュー済みSHAを配信する。新通知経路の2フラグはOFFのまま。既存 `.node-version`、依存/lockfile、DB migrationは変更しない。
3. いつもの管理ホームを再読み込みし、上部の「メール通知の確認（テスト）」から確認ページを開き、「確認メール3通を送る」を1回押す。入口も同じProduction/フラグ/期限で表示を制限する。管理ログインがないクラウドブラウザでは進めず、本人の通常の管理ログインを使用する。
4. 3行の「送信サービス受付済み」を確認。これは受信箱到着の証明ではない。受信者がテスト3通の到着、誤った宛先/BCCがないこと、表示内容を確認する。受付不明なら元のkeyで対象だけを再試行し、解消しなければ停止する。
5. iPhone Safariで文字・ボタンが切れないことと「状態を更新」の操作を確認。本画面は通常管理ホームと**同じ `NotificationStatusView`** を使用する。表示は画面内の試験結果であり永続通知履歴ではない。再読み込みで初期表示へ戻るが、再送しても同じ3keyを照会する。
6. 受付・受信・iPhone確認が成立してから、既存報告書の順に本番outbox/送信を切り替える。正式案件のテスト操作は行わない。確認専用フラグはOFFにして配信し、後続の小さなcleanupで一時画面/APIを削除できる。期限後は再開せず、未確認なら停止理由を記録する。

## 検証と限界

- ローカル補助試験: 送信先/BCC/From変更、Preview、未開放/期限切れ、並行・応答喪失時の同key、実HTTP sender、業務DB未使用、表示/再試行の成功記録保持を確認する。
- route試験: 任意宛先・案件ID・key・不明purposeを拒否、CSRF必須、GETでは送信0、期限閉鎖時送信0。
- 隔離Next/実ブラウザ: 管理者未認証でGET/POST 401、認証済みでもフラグOFFなら404、CSRFなし403、provider通信0。既存の23 DB試験と7ブラウザ試験に、この2境界シナリオを追加する（計9ブラウザ試験）。必須試験のskipや期待値緩和はしない。
- 実メールとiPhone確認は**実施後に**PR本文へ対象SHA・結果を記録する。コード作成、ローカルmock、CI成功をもって実送信済み/本番切替完了とはしない。
- Rollback: 確認専用フラグOFFを配信するか、今回のアプリ差分だけを戻せる。追加DBなし。受信済みメールは取り消さない。期限/固定keyは変更せず、通常業務フラグは別管理する。

参照: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)、[PR #98](https://github.com/me-ish/me-ish-homepage/pull/98)。

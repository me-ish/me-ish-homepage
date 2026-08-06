# エトリエ P1-13 段階 rollout / rollback runbook

## 1. この手順の境界

P1-13 は DB migration を追加しない。本番 Supabase の変更、実メール送信、実課金、実顧客データを使った試験はこの手順に含めない。P1-12 delivery atomicity は Phase 1b の別作業であり、P1-13 の公開条件には含めない。

公開判定は、自動化できる回帰 gate と、運用担当者が Preview / sandbox で行う canary を分ける。後者の記録が埋まるまで一般公開しない。

## 2. 担当と観測期間（公開前に必須）

- release owner: `operator_confirmation_required`
- rollback owner: `operator_confirmation_required`
- monitor owner: `operator_confirmation_required`
- observation period: `operator_confirmation_required`（開始・終了日時と timezone）
- canary 専用メールアドレス: `operator_confirmation_required`
- 証跡リンク: `operator_confirmation_required`

`operator_confirmation_required` が1つでも残っている場合、release status は **BLOCKED** とする。

## 3. 自動回帰 gate

同一 commit で次をすべて成功させる。

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

最低限、次の回帰が suite に含まれることを確認する。

- legacy form / legacy note / legacy quote
- consultation、quote、target design の3 request
- image/link validation、upload failure、RPC failure時 cleanup、unresolved orphan 保持
- type confirm、pricing、quote concurrency、quote accept retry
- Stripe test mode webhook の duplicate / amount mismatch / quote mismatch
- task、delivery token、delivery accept retry
- archive / restore、RLS / ACL、匿名 Storage deny

ブラウザE2Eの Natori 送信は `/ja/etorie/demo/app/portfolio` を使う。デモは外部メール・DB・Storageへ書き込まない。`?structured=1` はデモページだけの structured form 切替であり、本番flagを変更しない。

## 4. compatibility deploy

1. Production の `NATORI_PUBLIC_INTAKE_V2` は未設定または `1` 以外（default OFF）を維持する。
2. deploy後、公開ページが legacy form のまま表示・送信できることを専用宛先で確認する。
3. 管理画面で legacy note project と snapshotなし legacy quote が引き続き読めることを確認する。
4. 旧 `natori_create_project_with_tasks` RPC と dual reader を削除していないことを確認する。

## 5. Preview canary

1. Productionとは分離した Preview に `NATORI_PUBLIC_INTAKE_V2=1` を設定する。
2. Supabase staging/branch、Resend test modeまたは専用受信箱、Stripe test modeだけを接続する。Production secret、実顧客、実カードを使わない。
3. consultation を1件送信し、管理者が編集する前に次を確認する。
   - valid RequestData V1
   - `amount = NULL`、`due_date = NULL`、`type = undecided`、`status = inquiry`
   - task 0件、原回答が `note` に複製されていない
4. quote を1件送信し、同じ初期値を確認する。
5. canary ID自体をログへ出さず、アクセス制限された証跡にのみ記録する。
6. `supabase/verification/etorie-p1-03-selects.sql`、P1-04、P1-05、P1-13 の順にSELECTを実行し、説明不能な異常 count が0であることを記録する。

## 6. sandbox full-flow rehearsal

専用データで次を順に実行する。

```text
form -> type confirm -> estimate -> quote -> accept -> payment
     -> task progress -> delivery -> delivery accept
```

- quote承諾の再送が同じ結果を返し、二重更新しない。
- Stripe test webhookを再送し、duplicate、amount mismatch、quote mismatchが正しく分類される。
- delivery acceptを再送し、既に受取済みとして安全に終了する。
- archive / restore後も通常一覧と履歴の境界が保たれる。
- mail、signed URL、token、メールアドレス、氏名がapplication logへ出ない。

## 7. 監視

ログドレインで `metric=natori_public_intake` を code ごとに集計する。各行は固定codeと `count=1` のみで、PII、project ID、Storage path、tokenを含まない。

観測対象:

- `structured_accepted`
- `structured_payload_invalid` / `structured_reference_invalid` / `structured_upload_invalid`
- `structured_owner_unavailable` / `structured_upload_failed`
- `structured_create_unresolved` / `structured_create_rejected`
- mail / auto-reply の sent / failed / skipped

観測期間中は accepted、create failure、mail failure の件数と比率を記録する。閾値は monitor owner が通常トラフィックと canary 件数を踏まえて公開前に決める。未設定の閾値を都合よく解釈して公開しない。

## 8. rollback rehearsal

1. Preview の `NATORI_PUBLIC_INTAKE_V2` をOFFにして再deployする。
2. 公開フォームがlegacy表示へ戻り、legacy送信が成功することを確認する。
3. structured canary案件がdual readerで読めることを確認する。
4. 旧create RPCが利用可能で、新規structured writerが呼ばれないことを確認する。
5. DBをdown migrationしない。作成済みRequestData、quote snapshot、linkを削除・書換しない。
6. flag OFF後も異常が続く場合は deploy rollbackを行い、release ownerへ連絡する。

一般公開後の緊急rollbackも同じ順序（flag OFFを先行）で行う。

## 9. release record

- commit / deployment:
- automated gate result:
- consultation canary evidence:
- quote canary evidence:
- post-deploy SELECT result:
- full-flow rehearsal result:
- rollback rehearsal result:
- monitor dashboard:
- final decision / decided at:

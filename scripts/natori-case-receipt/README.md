# receipt退役・復旧とmigration replayの隔離検証

```sh
node scripts/natori-case-receipt/verify.mjs /tmp/meish-receipt-new-run
```

既存Node22/dependencies/Dockerとcached Postgres17.11 imageが必要。未作成の/workspaceまたは/tmp出力先だけを使う。2台の所有containerを順にnetwork none/tmpfsで起動し、必ずlabelを照合して破棄する。host mount/公開port/image pull/CLI/secret取得はない。

最初のDBはactive migration40本を先頭から適用する。承認済みの7本目2CHECKの修正は同一定義の再利用・異なる定義の停止・欠落時の作成を検証する。次のエラーが出れば停止し、後続を飛ばして合格にしない。Auth/Storageは最小catalog fixtureで、platformのフル受入ではない。

別DBは縮小payment依存schemaと正式writer/outbox/workspace/退役migrationで、段階ごとの23時間境界・既知ID・元receipt期限・lease・並行lock・本文消去・旧token拒否・pending/固定key保持・期限revision変更・件数上限と滞留・RPC権限を検証する。provider/mail/encryption/API/Auth境界はこのnative SQL実験では呼ばず、opaque payloadを使う。

results.json/duplicate-constraints.txt（replay失敗時はreplay-error.log）を保存する。`success:true`は35項目の検証成功を表す。`replay.status`と適用本数、代替境界を合わせて読むこと。実Auth/API/middleware/browserの検証は別runnerで行う。

```sh
node scripts/natori-case-local-auth/run.mjs /tmp/meish-receipt-browser-new --payment --normal-schema
```

このrunnerは実GoTrue Auth schemaと通常業務migration40本、実PostgREST/通常middleware/アプリを使う。Storage catalog・gateway・Stripe/Resend・password loginの代替境界は残る。実行結果は[検証記録](../../docs/natori-case-receipt-retirement-validation-20261021.md)を参照。

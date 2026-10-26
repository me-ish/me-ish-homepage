# 既存案件操作の隔離ローカル検証

対象は、新workspace内の元依頼・参考リンク/次回メモ・旧入口/制作予定/設定と、案件登録・基本編集・手動入金・見送り/保管/復元・見積作成/提示・許可された通知復旧。
既存の本番gateやloopback検証の既定動作は変更しない。

## 前提

- Node 22、既存node_modules、Docker、`/usr/bin/chromium`。
- 共有runnerにdigestを固定した公式PostgreSQL / GoTrue / PostgRESTイメージがキャッシュ済みであること。pullしない。
- 出力先は存在しない`/workspace/`または`/tmp/`配下。上書きは拒否する。
- ブラウザ試験はloopbackの4193/4195を使う。使用中なら停止し、既存プロセスを終了しない。

```sh
# 通常業務schemaのSQL検証。Auth/Storageは最小catalog fixture。
node scripts/natori-case-administration/verify.mjs /tmp/case-admin-sql-new-run

# 実ローカルAuth / PostgREST / 通常middleware / PC-mobile UI。
node scripts/natori-case-local-auth/run.mjs /tmp/case-admin-browser-new-run --payment --normal-schema --administration

# 元依頼・旧入口・制作予定・設定だけの原因切り分け。上の全回帰の代わりにはしない。
node scripts/natori-case-local-auth/run.mjs /tmp/case-screen-browser-new-run --payment --normal-schema --administration --screen-only

# 操作停止表示と4入口の既存回帰。業務データは読み取りだけ。
node scripts/natori-case-local-auth/run.mjs /tmp/case-admin-readonly-new-run --payment --normal-schema --entry-preview --entry-read-only
```

`--administration`は`--payment --normal-schema`必須の独立モード。他の受入/制作/照合/入口モードとの併用を拒否する。
`--screen-only`は`--administration`とだけ併用でき、同じローカル安全境界で今回の画面試験だけを選択する。
通常runnerの業務GET制限はそのまま。明示モードだけ必要なservice-role RPCをallowlistで許可する。

## 検証の境界

- 正式migration全48本を順番に適用する。SQL試験では47本適用後に合成案件を作り、48本目で既存案件checksumが変わらないことも確認する。
- SQL試験は本物のPostgreSQLでowner・revision・操作ID・並列処理・通知の用途/期限・権限/RLS/追記専用記録を検証する。Authそのものの試験ではない。
- ブラウザ試験は実GoTrueのpassword認証、Cookie、PostgREST、通常アプリmiddleware/APIと正式SQLを使う。bootstrapは破棄するアプリコピーにだけ置き、製品の認証例外や公開テストログインを追加しない。
- 合成ユーザー・架空案件のみ。Stripe/Resendは既存のローカルtransport double。Storageは最小catalogのみで、実StorageのuploadやGoogle OAuth/PKCE、実iPhoneは検証しない。
- Dockerはnetwork-none共有名前空間/tmpfsで、外部ネットワーク・ポート公開・host mountを持たない。host側gateway/Nextはloopbackのみ。既存secrets/環境ファイルを読まない。
- ブラウザの既知telemetryや外部フォントは送信前に遮断し、試行先を記録する。外部APIに接続して成功したという証拠ではない。
- finallyで所有ラベルを照合したコンテナだけを削除し、所有Nextプロセス群/gatewayを終了する。失敗時も`results.json`と`cleanup.json`を確認し、重複起動しない。

結果・限界・保存済み証拠は[既存操作](../../docs/natori-case-existing-operations-20261022.md)と[画面接続](../../docs/natori-case-screen-integration-20261022.md)の検証記録を参照。

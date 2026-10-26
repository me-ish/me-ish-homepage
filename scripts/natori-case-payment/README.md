# 新案件workspaceの支払案内・隔離検証

```sh
node scripts/natori-case-local-auth/run.mjs /tmp/meish-case-payment-new-run --payment
```

既存ローカルAuth harnessを使う。Node22、既存node_modules、Chromium、run.mjsに固定したキャッシュ済みDockerイメージが必要。出力先は未作成の/workspaceまたは/tmp配下。起動先はloopbackのみ、コンテナはnetwork none共有・tmpfs・host mount/公開ポートなし。既存secretsや.envをコピーしない。

実物はGoTrue、Postgres、PostgREST、通常Nextアプリ/middleware/管理認可/Cookie処理、正式reader、既存支払writer/outbox SQL、新しいforward migration。`fixture.mjs`は**縮小依存schema**に既存outbox/支払writer migrationをそのまま適用する。過去migration全体・通常業務schemaの再現成功とは扱わない。fixture内のservice_role用UPDATEはwriterの行ロック/更新検証用であり、外部サービスの権限変更ではない。

Stripe SDKと固定Resend fetchだけを`provider-preload.cjs`で代替し、価格/link/keyごとの合成結果と件数を記録する。StripeをCommonJSへexternalizeする変更は使い捨てアプリコピーのNext設定だけ。通常アプリの設定は変更しない。メール、Stripe、OAuth、Storage、hosted previewへの接続はない。送信サービス受付の試験は到達/既読を証明しない。

予約済み`.invalid`宛先でunknown/確定失敗を模擬。合成案件6はリンク作成後の応答喪失、9はoutbox commit後の応答喪失、12は通知claim後の応答喪失を模擬する。DB/認可応答は代替しない。lease時間経過は、その合成行の期限を過去へ移すことで検証する。

`results.json`、provider-summary.json、PC/mobile PNG、isolation.json、cleanup.jsonを出力する。資格情報はログから除く。finallyで所有labelを照合して自分のコンテナのみ破棄し、Nextの所有プロセスグループを停止する。外部フォント/解析/Nextのバージョン照会は遮断し、その試行を証跡に残す。実機iPhone、Google OAuth/PKCE、hosted gateway、完全schema、実Stripe/Resendは未検証。

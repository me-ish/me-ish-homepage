# 実Auth・PostgREST・通常middlewareのローカル検証

新案件画面のブラウザ → 既存の認可/API → 正式RPC → reader/adapter → 表示を、同じ作業環境内で検証する。
GoTrueとPostgRESTは実バイナリを使い、Auth応答やJWT検証、SQL応答を模擬しない。
業務DBは既存の**縮小schema**を使うため、フル受入成功とは扱わない。

## 起動と再現

Node 22、既存node_modules、Docker、Chromiumが必要。
`run.mjs`内のdigestに対応する公式GoTrue v2.197.0、PostgREST v14.18、既存PostgreSQL 17.11イメージがキャッシュされていること。
スクリプトはimage pullやSupabase CLI、環境ファイル、クラウド接続を行わない。

```sh
node scripts/natori-case-local-auth/run.mjs /tmp/meish-local-auth-new-run
```

出力先は存在しない`/workspace/`または`/tmp/`配下を指定する。既存出力の上書きを拒否する。
4193/4195が使用中なら停止し、既存プロセスは終了しない。

## 隔離と実装境界

- DBを`--network none`で起動し、Auth/PostgRESTを同じネットワーク名前空間に置く。すべて内部loopbackで待受け、コンテナにポート公開・外部インターフェース・host mountを持たせない。DBはtmpfsだけを使用。
- 作業環境のloopbackにHTTP gatewayとNext devを起動する。Docker execの`nc`ストリームで実HTTPを中継する。中継はJWTや認証・SQLの応答内容を作成/置換しない。公式Kong/Envoyやhosted gatewayの再現ではない。
- gatewayは生成したローカルanon/service_roleキーだけを受け付け、外部providerやメール系Auth経路を閉じる。業務Data APIはGETだけを通す。
- 合成ユーザーを実GoTrueの管理APIで作成し、メール確認済みにする。SMTP接続先は利用不能な内部loopbackに限定。外部OAuth・メール・SMS・Storage・決済を使用しない。
- 一時パスワード・署名鍵・サービスキーをランダムに作成し、既存secretsを読まない。これらはローカルDB破棄後に有効な接続先を持たない。ログの資格情報は伏せる。
- trackedおよび新規の非ignoredローカル通常アプリsrc/publicと必要な設定だけをコピーし、`.env*`を除外する。middleware、認証、API、reader、production gate、既存業務操作のコードは変更しない。起動前に重要ファイルのバイト一致・SHA-256を保存する。
- NextのGoogle Fonts用テストhookはローカルfallbackを返す。ブラウザの外部フォント・Google Analytics・Vercel Analytics要求は実行前に遮断し、試行先を記録する。外部通信の試行がなかったとは扱わない。
- 実ブラウザSDKによるpassword sign-inをテスト専用bootstrapで行う。通常Google OAuthログインUI・PKCE callbackを通した受入ではない。通常Nextアプリの認可ヘルパーへのスタブや例外は追加しない。
- 合成fixture生成用bundleだけは、使用しない認証importを呼ぶとthrowするスタブへ解決する。これはデータ生成の依存解決に限り、起動するNextアプリやAuth/API応答には使わない。
- GoTrueは自身のAuth schemaをmigrationする。業務schemaは`natori-case-app-read/fixture-schema.sql`の合成依存列とadmin_emailsのみ。既知の過去migration replay重複制約は修正・迂回適用しない。正式な新規読取migrationだけをそのまま適用する。

## 検証

未認証/非スタッフ、サーバー確定ownerと他owner分離、実Cookie発行とサーバー更新/Set-Cookie、
JWT署名・期限、refresh token失効、両RPCのEXECUTE権限、実表示、通常locale middleware、
Today/Cases/Schedule、戻る/進む/再読込、部分取得不足、旧入金/受取、不明情報、mobileを確認する。
PostgREST本体を停止・再起動して読み取り失敗/復旧も検証する。
共有キーCookieは通常middlewareから発行し、Secure/HttpOnly/SameSiteと実ブラウザの送信、改ざん拒否を確認する。
Secure Cookieの受渡しはChromiumのlocalhostでの実測であり、実サービスのHTTPS/ドメイン設定は別途受入が必要。

Authのセッション行更新は発生する。業務行のチェックサムは読取前後で一致し、Data APIにはGET以外を送らない。
終了時は作成時ラベルを照合して自分のコンテナだけを削除し、自分のNextプロセス群とgatewayを終了する。
`owned-process.json`は異常終了時に所有プロセスを確認するための記録。

証拠は`results.json`、`browser-results.json`、`preparation.json`、`isolation.json`、`applied-migration.sql`、
`owned-process.json`、`cleanup.json`、PC/mobile画像、資格情報を伏せたログ。
`egress-denied.jsonl`があればNode側で遮断した接続試行のhostを記録する（例: Next devのnpmバージョン確認）。

## 残る受入

通常業務schemaの全制約/trigger/RLS/ACL、無修正migration replay、Google OAuth/PKCE、
hosted環境/gateway、production build、iPhone実機、既存の送信/決済/更新系は未検証。
production gateはdevelopment/testのままで、通常Previewへの公開判断を代替しない。
本番や既存の外部検証プロジェクトへ接続・適用せず、push/PR/merge/deployも行わない。

参考: [公式Docker構成](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)、
[Auth v2.197.0](https://github.com/supabase/auth/tree/v2.197.0)、
[PostgREST v14.18](https://github.com/PostgREST/postgrest/tree/v14.18)。

支払案内のwriter検証を行う明示的な`--payment`モードは、[専用README](../natori-case-payment/README.md)を参照。通常モードは引き続き業務GETのみ。

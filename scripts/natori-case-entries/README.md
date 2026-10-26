# 4入口の隔離ブラウザ検証

既存local-auth runnerの既定は変更せず、`--entry-preview`を明示したときだけ
新しい分岐を使う。通常46本の業務migration、合成ユーザー・案件、実GoTrue/PostgRESTと
通常Next middleware/APIを使用。DBは既存imageをpullせず、network-none/tmpfs/公開portなし。
gatewayとアプリはloopbackだけ。production/hostedや既存秘密値は使用しない。

```sh
node scripts/natori-case-local-auth/run.mjs /tmp/new-entry-run --normal-schema --payment --entry-preview
```

照会のみの停止表示も別runで確認できる:

```sh
node scripts/natori-case-local-auth/run.mjs /tmp/new-entry-pause-run --normal-schema --payment --entry-preview --entry-read-only
```

出力先は未作成の `/workspace` / `/tmp` ディレクトリ。既存runへ上書きしない。
`--entry-preview`はnormal-schema/payment専用で、R1/R2/R3やproduction-buildの別モードと
混在させない。既存モードのflag/JWT期限/実行フローは変えない。

確認: 未認証/非staff、元dashboard/projects URL、4入口×quoted/awaiting_payment、
通知ID/対象版と戻り条件、PC/mobileの月/日/検索/フィルタ/選択/履歴、別owner/不存在、
閲覧中の業務全テーブルchecksum不変、送信/決済のwriter/provider呼出しなし、Cookie除去後の401確認。
この分岐ではtoken期限切れや失効済みtoken再利用まで検証していない。
中盤に合成通知をSQLで準備し、終盤に120案件・1005個人予定・251通知系列と再試行履歴を追加する。
全件取得/途中更新検知/通知5ページ目/案件3ページ目/月末・年末を検証する。
これはアプリの業務writerが動いた記録ではない。
通常操作modeでは、その後に明示した個人予定の追加/編集/削除だけを既存APIで実行する。
gatewayはentry-preview通常操作modeかつ合成service_roleでのnatori_events POST/PATCH/DELETEだけを追加許可。
既定modeと照会のみmodeは変更せず、任意table/RPCを許可しない。予定の実行結果と閲覧無更新を混同しない。

外部Stripe/Resend境界は既存test doubleのまま、今回の画面移動では呼ばれないことを検証。
Storageはcatalog fixtureで実サービスを使わない。Google OAuth/PKCE、実iPhone、実provider、
専用acceptance profileの個人予定/本番切替の受入とは扱わない。
アプリ内の既存GTM/Vercel解析scriptの接続試行はbrowserで通信前に遮断し、
`blockedExternalAttempts`へ記録する。未知の外部hostは失敗にする。
実hosted環境での解析除外設定を確認した結果ではない。
終了時は所有labelを確認して自分の3コンテナ・Next/gatewayを片付ける。
結果は `r4-browser.json`、`results.json`、`cleanup.json`、`r4-1440.png`/`r4-390.png`。

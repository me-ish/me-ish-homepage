# ローカル通知復旧・全体規模の検証

既存の `natori-case-local-auth/run.mjs` の明示モードを使う。通常モードの既定を変えない。
Node22、キャッシュ済みDocker画像、既存のChromiumが必要。出力先は**存在しない** `/workspace` または `/tmp` 配下を指定する。

```bash
/workspace/me-ish-thumbnail-validation-20261018/runtime/node scripts/natori-case-local-auth/run.mjs /workspace/new-notice-check --normal-schema --payment --administration --continuity-only
/workspace/me-ish-thumbnail-validation-20261018/runtime/node scripts/natori-case-local-auth/run.mjs /workspace/new-scale-check --normal-schema --payment --administration --scale-only
node scripts/natori-case-administration/verify.mjs /workspace/new-native-check
```

- `continuity-only`: 通常業務schema、実ローカルAuth/PostgREST/middleware/UI、合成252系列で200外のexact対象を確認。確定失敗の復旧、unknown非再送、応答喪失の同operation照会。外部providerはdoubleのみ。
- `scale-only`: read-only表示、515/1,015案件、予定/通知1,000/2,000件、子タスク混在で全件/owner/uniqueを確認。初回/暖機/3並列/画面/検索/月/履歴/focus、外側EXPLAIN、nested SQL統計、HTTP bytes/時間、Node/Chromium memoryを記録。1000-warmのみNode内蔵CPU profileを採る（inspectorポートなし）。後続頁の一度の503と、実合成DBの途中revision変更も確認する。
- native: 正式業務migrationsをreplayし、既存の管理/履歴回帰にexact通知・異なる二operationの並行復旧を加える。Auth/Storageはcatalog fixtureで、ブラウザ受入の実Authとは区別する。

Dockerはnetwork-none、tmpfs、host公開ポートなし。gateway/appは127.0.0.1の4193/4195だけ。`.env`をコピーせず、外部SDK/fetchは代替し、実SMTP/Storage/Stripe/Resend/Googleへ接続しない。Supabase CLIやHOME変更は使わない。合成資格情報を含む作業ディレクトリ全体をGitへ追加しない。

結果はresults/cleanup/isolation/normal-schema-replayと測定JSONで確認する。nativeは`removed=true`、browserはownedContainersRemovedが3件であること、最後に4193/4195が空くことを確認する。ログを読む場合はCookie/合成資格情報を出力しない。

現状の制限：既存支払/旧通知/R1一括モードは、旧通知APIが先に呼ぶ`natori_delivery_purge_payloads_v1`をgatewayが許可していないため中断した。該当操作を再試行/別経路実行せず、許可リストも広げていない。これは上記2つのfocused modeやnative成功と別の未完了。全体停止/切戻し機構も未実装。

実測と残件：[固定範囲・検証記録](../../docs/natori-case-recovery-performance-hold-20261022.md)。測定値はdev/ローカルの標本で、production/hostedのSLO・メモリ上限・費用保証ではない。

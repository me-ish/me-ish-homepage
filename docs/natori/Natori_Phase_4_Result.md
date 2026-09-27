# Natori Phase 4 実装結果

更新日: 2026-09-27

## 対象と開始点

- 依頼: Phase 4「相談の見落とし・返信漏れを防ぐ改善」。F11 / F17 / U02 / U03 / U06 / U07 / U14（管理側）。
- 開始main: `6b3b39ecc02b63cb0a10293c8e7b2503559e12d3`（PR #99）。作業開始時に最新mainと一致を確認。
- branch: `codex/natori-phase-4`。既存の同名branch/PRなしを確認して作成。
- 実装、通常push、Draft PR、隔離CIまで。本番DB・メール・設定・main merge・本番配信は未実施。

## 変更したこと

1. 全工程を同じ相談詳細へ接続。旧 `/natori/inquiries?project=...` を保持し、相談メールと案件カードは `view=conversation` 付きで同じ画面を開く。filterに含まれない案件もowner条件付きのID検索で開く。
2. 最新の実メッセージのsender/created_at/idを集計し、「新規・未対応」「ナトリの返信待ち」「依頼者の返信待ち」を表示。制作status、noteのメール記録、既読は判定に使わない。ラフや見積りメール送信も相談の最終senderを自動変更しない。最終発言が古い順で表示し、日付は日本時間。
3. 管理ホームに全工程の要確認リスト、案件カードと相談一覧に返信状況を表示。メールの失敗・未送信を別に表示。Phase Nは各notification_keyの最新attemptだけを集計し、過去のfailedを再通知扱いにしない。
4. 相談履歴は表示時・画面復帰時・手動更新・送信後に取得。履歴更新で下書きや表示中の過去履歴を消さず、新着へは明示操作で進む。保存後に取得失敗しても「送信失敗」にはしない。開いている案件情報の再取得に失敗した場合は、古い情報の可能性を詳細内に表示し、読み取りだけで再取得できる。
5. closed/archiveは履歴のみ。実APIの既存書込拒否を維持。詳細は既存Radix Dialogへ接続し、キーボード、Escape、フォーカス復帰を扱う。相談内の固定スクロール領域を除去。
6. ラフ案内は既に案内済みの相談ページからの返信を優先し、期限切れ時の既存再発行と、リンクが見つからない場合のメール返信を案内。メール直接返信は履歴に自動取込されないと明記。

### 計画との設計判断

旧consultation tokenはhashのみ保存されるため、ラフメールの都度既存URLを復元して添付することはできない。今回はラフ本文で既存の案内先を使うよう明示し、**token追加発行・有効期限延長を新たに実装しない**。以前のURLは元の期限のまま利用でき、期限切れ画面の再発行経路を残す。相談API自体の既存の新規返信通知・再送の仕様は変えていない。

リアルタイムチャット、既読管理、業務状態の再設計、相談処理の全面outbox化は追加しない。通知失敗の一元的な再送設計・添付finalize再試行はPhase 3B、納品の完全性はPhase 1へ引き継ぐ。

## DB・権限と移行順

新migration: `supabase/migrations/20260927102757_natori_consultation_overview.sql`（CLI 2.118.0のmigration newで作成）。

- `natori_consultation_overview_v1(owner UUID, project UUID[])` を追加。SQL stable / SECURITY INVOKER / 空search_path。
- service_roleだけEXECUTE。anon/authenticated/publicのEXECUTEを明示revoke。APIがowner絞込み済みIDを渡し、RPCもowner条件を再適用する。
- 1batch最大100件。既存のproject/created_at/id索引とnotification project索引を使用し、不要なcolumn/index追加なし。
- **全テーブルの業務行・status・quote・snapshot・accepted_at・paid_at・入金・納品・token・Storageを更新しない。backfillなし。**
- 未適用DBやRPC取得障害は `consultation: null` とし、「返信状況を取得できません」と表示。空会話に変換しない。

本番作業は別途承認後に、(1) 対象SHA/既存相談・Phase N定義/権限をread-only照合 → (2) このadditive RPCだけ適用 → (3) 権限・owner境界・read-only結果確認 → (4) application merge/配信 → (5) 管理ホーム・制作案件の相談・既存依頼者URLの確認、の順。必須照合に失敗したら停止する。全migration履歴の無検証適用はしない。

rollbackはapplicationを直前版へ戻せる。追加RPCを残して旧コードが動作する。データ修復やtoken再発行不要。即時のDROP/contractは行わない。

## テストと証跡

- Draft PR: https://github.com/me-ish/me-ish-homepage/pull/100
- 製品コードの最終変更: `b3f86211a010f57fcfe84d411609f2f6a364c626`。以後は専用検査の操作順・生成テスト環境・文書のみの変更。
- 検査コードを含む検証対象head: `d738743551c70db7f417f76baeb6d74fdb2d4e5d`。
- 成功した専用run: https://github.com/me-ish/me-ish-homepage/actions/runs/36316239727 。実checkout（GitHub PRのtest merge）SHA: `db023ac8617bd73039f590cc5729d8cdb1cfc8ec`。Phase 4は **17成功・0失敗・0skip**。必須の復旧試験を含め成功、ブラウザ例外・hydration/DOM/Dialog警告なし。
- 同じjobの追加回帰: Phase N 23成功＋ブラウザ9成功、Storage現行35成功/候補35成功、接続隔離17成功（各構成変更後にも同じ17件を再実行）。いずれも0失敗・0skip。
- ローカルで関連unit/component、型検査、baseline静的検査を実施。製品依存とlockfileは変更していない。
- 通常CIの同一head検証: run https://github.com/me-ish/me-ish-homepage/actions/runs/36316239721 。unit 132ファイル/1209件成功、既存E2E 15成功・0失敗・既存4skip、lint/型検査/security audit成功。既存skipは今回追加・変更していない。
- 同一headの既存専用workflowも成功: [Phase T](https://github.com/me-ish/me-ish-homepage/actions/runs/36316239773)、[Phase 0A](https://github.com/me-ish/me-ish-homepage/actions/runs/36316239777)、[Phase 0B](https://github.com/me-ish/me-ish-homepage/actions/runs/36316239808)、[Phase N](https://github.com/me-ish/me-ish-homepage/actions/runs/36316239804)。
- この成功記録を加える後続commitは文書だけ。最新PR headのChecksと再実行証跡はPR本文も参照。

### 必須試験の範囲

Phase 4はDB権限試験を含め17件。実DB/Auth/Storage、実Next APIとChromium、HTTPメールcaptureを組み合わせ、以下を確認する。モックだけの成功は完了としない。

- 13工程＋archiveの相談、旧URL、owner境界、許可staff2名と合言葉入口、匿名/無関係ユーザー/RPC直接呼出の拒否。
- 最新発言者と同時刻IDの順序、通知の最新attempt、既存失敗通知と返信待ちの独立表示。
- 閲覧前後の案件全column/既存access不変、返信後の制作status不変、closed/archiveの閲覧と書込拒否。
- 下書きを残す新着取得、通知失敗でも本文保存、保存後の履歴取得失敗と未送信の区別、案件取得失敗の再試行、表示中の案件情報が古い場合の案内と再取得。
- 既存private添付をstaff/client両方が署名URLで取得し、実ファイルのbytes一致を確認。
- 管理ホーム、キーボード開閉とフォーカス復帰、360/390pxの幅・スクロール、未処理例外/hydration/DOM/Dialog警告がないこと。

Phase Nの23件＋ブラウザ9件、Phase Tの接続隔離・Storage正負試験を同じjob内でも実行する。実メール配達とGoogle OAuthは対象外で、captureと隔離Authによる検証である。

### 途中の失敗と修正

失敗runを成功やskipとして扱っていない。再試行は原因を確認してコードを修正した後の通常branch更新で行った。

| run | 結果と対応 |
| --- | --- |
| [36314137772](https://github.com/me-ish/me-ish-homepage/actions/runs/36314137772) | DB2件後に起動確認がlocale転送で停止。検査側の転送を同一originだけ許可。 |
| [36314518899](https://github.com/me-ish/me-ish-homepage/actions/runs/36314518899) | 14成功/2失敗。route-announcerと本文内buttonを区別できるlocatorへ修正。 |
| [36314984666](https://github.com/me-ish/me-ish-homepage/actions/runs/36314984666) | 17成功/0失敗/0skip。その後、開いた案件の再取得失敗を表示する補完と、その回帰試験を追加。 |
| [36315320307](https://github.com/me-ish/me-ish-homepage/actions/runs/36315320307)、[36315855118](https://github.com/me-ish/me-ish-homepage/actions/runs/36315855118) | 各16成功/1失敗。固定checkpointで「詳細を再試行」のクリック待ちを特定。コード上で最初の一覧取得が詳細を自動更新することを確認し、障害解除との競合を解消。検査は一覧の取得完了後に詳細取得障害を注入する順へ変更し、表示・保存・復旧の必須assertionは維持。 |

Next開発用バッジは生成した試験configだけで非表示にする。製品configは変更せず、未処理例外/hydration/DOM/Dialogの検査は維持する。バッジが再試行失敗の原因と断定していない。

### 再実行・環境・記録

再実行は `scripts/natori-phase-4/README.md`。PRの通常更新で **Natori Phase 4** が起動し、30分上限・PRごと1run。失敗時の自動再試行はなく、必須検査をskipしない。既存CIの条件は緩めない。

使用版: `.node-version` のNode 22（CI実測22.23.2）、Supabase CLI 2.118.0、Playwright 1.58.2 noble、GitHub hosted Ubuntu 24.04、Docker 28.0.4、Postgres 17.6、Storage 1.77.0、Auth 2.197.0、PostgREST 16.3、Kong 2.8.1。lockfileと実イメージのdigest、元ソース/試験wrapperのchecksumを非秘密artifactに記録する。

通信制御はPhase Tの専用network namespaceを継承し、構築時のdownloadと試験時の通信を分離する。試験プロセスと子プロセスは隔離Supabase・同namespaceのNext/HTTPメールcapture以外へ接続できない。資格情報は使い捨て、公開URL/トンネル/本番Secretsなし。cleanupはjob所有の専用リソースのみ。

Git HTTP送信用認証が端末から使えなかったため、接続済みGitHubのGit Data APIで同一treeを照合し、作業branchをfast-forward更新した。forceなし、main更新なし。Git管理される成果物は37ファイルで、追加RPC、API/service/DTO、管理/相談UI、テスト、専用workflow、文書のみ。全変更一覧はPRのFiles changedを参照。

## 完了判定と本番反映前・配信時に残る確認

実装・Draft PR・隔離実試験まで完了。本番適用は未実施。mainは開始時と同じ `6b3b39ecc02b63cb0a10293c8e7b2503559e12d3`、PRはDraft/open、merge/auto-mergeなしを確認した。本番反映の承認後は上記のDB追加→権限確認→application配信の順を守る。

- 配信時の受入確認としてiPhone Safari実機: 管理ホーム→制作中案件の相談→入力→戻る、キーボード表示時の送信ボタン、古い依頼者URLから履歴更新。隔離Chromiumの360/390pxを実機済みと扱わない。
- ホーム画面版の添付白画面はユーザー了承済みの別問題。今回、添付URL・Storage policyは変えていない。
- me-ishギャラリー・未使用Colab運用は変更対象外。
- 実顧客へのメール送信や既存正式案件への書込は検証に使用しない。

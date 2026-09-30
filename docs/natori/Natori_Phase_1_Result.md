# Natori Phase 1 Result

作成日：2026-09-30。対象：`me-ish/me-ish-homepage`。実装・Draft PR・隔離試験まで。
**main取り込み、本番DB migration、環境変数変更、本番配信、実メール送信はこのWorkでは実施しない。**

## 要点と追跡

取得できない納品を「受取完了」にできる接続部分を直す。ファイルを予約し、実体の
保存・サイズ・MIME・Storage版・署名したURLの実読取を確認してからreadyにする。
すべての最終ファイルを固定した納品を発行し、その発行と通知予約を一度に保存する。
メール失敗は通知だけの失敗として残す。受取APIも直前の全ファイル読取を確認する。
再案内では旧リンク、期限、受取日時、完了日時、入金・合意・原回答を維持する。

| ID | 対応 |
| --- | --- |
| F03 | 受取後の再送でも記録を消さない。追加accessは同じ固定納品へつなぎ、旧hashを維持 |
| F04 | pending/legacyを完成扱いにしない。実体確認→ready→固定manifest→発行→受取の各境界を検証 |
| U04 | 取得不能なファイルも一覧に残し、CTAを無効化。古い画面からのPOSTも再検証し拒否 |
| U18（保存期限・再取得部分） | 固定した期限を画面・メールで表示。GETの更新で署名URLだけ再取得し、期限は延長しない |
| U14（受取結果部分） | 明示的な受取操作、結果へのfocus、未確認時の説明、読み取り更新による復旧 |

開始main：`5ee6e8201254966f7d1ce84802e041bba497d58d`（Phase 4 PR #100と一致）。
作業ブランチ：`codex/natori-phase-1`。既存の同名ブランチ・PRがないことを確認した。
計画のPhase 1、既存Phase T/0A/0B/N/4、最新コード・作業規約を基準に実装。
今回の実試験場所はGitHub-hosted Linuxの一時Docker環境。ユーザーPC/ローカルDockerを
前提にしない継続方針であり、自動Vercel Previewを安全な試験環境として扱わない。

## 定義照合と保護条件

本番から読んだのは納品関連table/constraint/trigger/functionのカタログ、対象bucket設定、
件数の集計のみ。顧客の業務行、メールアドレス、Authユーザー、token、実ファイルは取得していない。

- `natori_delivery_files`：project/folder/path/name/size/created_atはNOT NULL、size既定0、
  Storage path UNIQUE、folder rough/final、project FKはON DELETE CASCADE。
- 旧 `natori_accept_delivery_v1` はproject lock・支払/期限/status/mail日時を確認するが、
  ファイルの実体を確認しない。既存の受取済み結果を期限より先にreplayする性質は維持する。
- Phase Nの受取通知予約・lease・provider idempotency・送信証跡は再利用する。
- 既存のdelivery activity triggerを維持。通知成功日時の更新は一度だけで、statusを巻き戻さない。
- `natori-deliveries` はprivate、bucket側のsize/MIME制限はNULL。
  **プロジェクト全体のStorage上限は未確認。200MiB本番送信の可否はこの情報から判断できない。**
- 読取時の集計：納品ファイル0件、delivery hashあり0件、受取済み0件、未受取旧納品0件。
  正式案件・入金を変更しない。移行直前にもこの集計を読み直す必要がある。

## 実装した責務

### DBと状態

`20260930101753_natori_delivery_integrity.sql` はCLIで生成した新しいmigration。
DB適用は隔離試験のみ。既存行のstatus/hash/期限/受取/入金を一括更新しない。
既存baseline manifestのactive/required migration一覧・件数・checksumへ新規ファイルだけを追加。
frozen baselineやmigration履歴の再配置は行わない。

- 既存filesへstate、content_type、storage_version、verified_at、deleted_atを追加。
  既存行は`legacy_unverified`。証明のない一括ready backfillを行わない。
- `natori_delivery_releases`：projectごとに固定manifest/snapshot/期限/受取日時。
  今回はrevision 1。発行後の通常削除・差し替え・最終ファイル追加を拒否する。
  誤った納品の内容差し替えは、受取済み証跡を残す別途の訂正設計が必要であり今回自動化しない。
- `natori_delivery_access`：旧hashは維持し、再案内用の追加hashも同じ納品・同じ期限へ。
  生tokenは保存しない。GETはaccess/operation/通知を作成しない。
- `natori_delivery_operations`：project+operation UUID UNIQUE、入力hash、保存済みresult参照。
  発行と通知予約は単一DB transaction。中間processing行は不要。応答消失時は同じIDでresult replay。
- reserve/finalize/delete/issue/acceptはproject→関連rowの順でlock。
  削除はStorage操作より前にdeletingを確保し、失敗時は削除だけを再試行する。
  10件/200MiBの境界とfresh proof（60秒、未来許容5秒）をDBでも確認する。
- 新table/RPCはservice_roleのみ。ブラウザはowner認可・CSRFのある管理APIを経由する。
  old RPC署名は残すが、未受取は新しい実読取proofなしでは確定できない。

StorageとDBを単一transactionにはできない。発行済みpathを通常操作で不変にし、版と実読取を
直前に照合する構成。サービス管理者による外部削除や将来の障害まで恒久保証するものではない。
受取はサーバーが取得可能と確認した固定集合への明示的な確認であり、端末への実保存の自動証明ではない。
受取後にファイルが失われても確定記録を戻さない。

### API・UI・通知

- delivery-files POSTは安定したfile UUIDで予約・upsertなしの署名upload。
  PATCHはサーバー検証によるfinalize。応答不明時は再確認し、勝手にrowや実体を消さない。
- 6MiB超は既存依存`tus-js-client 4.3.1`による署名TUS、6MiB chunk・有限retry。
  小ファイルは従来の署名upload。製品依存・lockfileは変更しない。
- order-mailのdelivery経路はPhase 1 flag有効時に新serviceへ。sessionStorageに保持するのは
  operation UUIDだけ。異なる内容で同じIDを再利用した場合は409で明示的な確認を求める。
- delivery GETは固定集合を全件表示。署名失敗・一部欠落・版変更時も項目を黙って除外しない。
  全件が取得できないと受取CTAを有効にしない。APIは古い有効画面からのPOSTも再検証。
- 完了済み案件から同じ納品を再案内できる。発行済みfilesは追加/削除を無効化する。
- 新目的`delivery_issue_client`をPhase Nの通知jobへ統合。
  業務発行成功後のメール失敗/unknown/finish応答消失は発行を巻き戻さない。
  送信サービス受付が確認できた時だけ`delivered_mail_at`をCOALESCEで保存する。
- メール本文の再試行には同じリンクが必要なので、delivery発行payloadだけAES-256-GCMで暗号化。
  生リンクをDB/ログへ出さず、AADで有効期限を拘束。復号はリンク期限/発行24時間の短い方まで。
  providerの安全な再試行期間（既存Nの23時間基準）を越えて無条件に新keyで送り直さない。
- 期限を過ぎた暗号本文はowner認可の発行/通知再試行POSTで最大100件ずつ消去。
  sent/provider/snapshot等の証跡は維持。**復号期限到達時の即時物理消去を行う常時schedulerは追加していない。**
  定期的な消去を運用上必要とする場合、専用RPCを認可された保守処理で呼ぶ運用を本番前に決める。

## 検証結果

ローカル：変更に関連するunit/component 69件成功、型チェック成功、変更箇所lint成功。
新規migrationのmanifest登録を確認する既存schema artifact試験12件も成功。
隔離実Storage/ブラウザ：Draft PRの専用Actionsで実行する。最終run/SHA/件数は実行完了後に更新する。
スクリプト作成やモック成功だけでPhase 1完了とは判定しない。

### 2026-10-01 JST 追加調査・最小修正

調査基準：`67cc3d91ca3916445d9963fbd164c59a258b40fa`。PR #101はDraft、main未反映。

| 失敗 | 切り分けと再現条件 | 必要な修正・検証 |
| --- | --- | --- |
| CI Security Audit | mainと同一のdev依存`brace-expansion` 1.1.18/2.1.4/5.0.9。`npm audit --audit-level=high`で再現。Phase 1による追加ではない | lockfileの3パッケージだけを1.1.21/2.1.7/5.0.12へ更新。通常CIの全ジョブで検証 |
| Phase 0A after 25/26 | natural同時finish sample 20でpublished downloadが一時500 `InternalError`、既存APIは503。Storage内部の詳細原因は採取されていない。今回の差分でこのギャラリー経路・policy・試験は変更していない | 元の失敗を保持して同一headを1回再実行。attempt 2はbefore/after 26/26、各24自然競合+12同期競合成功。製品コード・retry・assertionの変更なし |
| Phase 1 browser 10/11 | 既存`globals.css`のGoogle Fonts importが隔離環境でDNS失敗。更新/HMRに伴うroot stylesheetのpreloadが`Event`をreject。今回追加した試験fixtureの外部CSS依存が原因で、納品DB/APIの整合性失敗ではない | 試験用CSSだけでこのimport 1行を除外。全CSSルールと実画面/APIを維持。全page/DOM error検知を維持し、正常なlocal CSS responseとresource rejectionゼロも要求 |

同一headの0A再実行：[run 36715938260 / attempt 2](https://github.com/me-ish/me-ish-homepage/actions/runs/36715938260/attempts/2)。
依存修正+診断head：`865aff1992f5c8f631350f497889c2f12315c760`。
[通常CI 36774112435](https://github.com/me-ish/me-ish-homepage/actions/runs/36774112435)は全ジョブ成功。
[Phase 1 36774112570](https://github.com/me-ish/me-ish-homepage/actions/runs/36774112570)は28+10成功、
最終error gateだけ失敗。artifactの3件の`Event`はすべて`LINK / root-layout-css`で、
local CSS自体は全13応答200、外部font CSSが`ERR_NAME_NOT_RESOLVED`だった。
秘密値/URLを公開せず、画面遷移で診断が失われないよう記録を追加した。

修正順は、元headの0A再実行→依存3箇所の更新/通常CI→上記CSS診断→fixture import修正→
Phase 1全試験と共有lockfileを使うT/0A/0B/N/4の確認。
source/fixture CSSのchecksumを別々に記録し、ローカルでも変更がimport 1行だけと確認した。
本番`globals.css`・Next/Reactのバージョン・通信allowlist・納品製品コードは変更していない。
本番の外部フォント可用性はこの隔離試験で保証しない。

修正後の確定head、各workflowのrunリンク、最終件数は
[PR #101本文](https://github.com/me-ish/me-ish-homepage/pull/101)に記録する。
失敗試験の除外、page errorの無視、Storage失敗の成功扱い、mergeによる試験起動は行わない。

予定する必須試験：Phase Tのkernel隔離・Storage正負試験、Phase Nの既存DB/ブラウザ回帰、
Phase 1 DB/Auth/Storage 28件、実API/画面Chromium 11件。失敗・起動不能・認証不足はskip扱いにしない。
主なfailure injection：DB commit前拒否とcommit後応答消失の区別、provider受付後中断、通知finish失敗、
署名/実読取の503、ファイル部分欠落、版変更、publish/delete・accept/resend競合、旧RPC迂回拒否。
200MiB署名TUSは全bytes download digestまで照合する。試験専用bucket/Storage capは250MiB。
固定CLIのStorageが隔離network移動後に別hostのTUS継続URLを返したため、このrunのStorageだけを
同一image/Auth設定/専用volumeで再作成し、STORAGE_PUBLIC_URLを許可済みinternal originへ設定。
local HTTP modeと新旧size環境keyを明示する。クライアントの継続URLを書き換えたり、通信許可先を
広げたりしない。実効する非秘密のsize/protocol環境値をversions artifactへ記録する。

2回目（head `088fdbfdf7e6e7e2045f310f6456abf6b3a4d921`、
[run 36712295359](https://github.com/me-ish/me-ish-homepage/actions/runs/36712295359)）は実Storage
27成功/1失敗/0 skip、ブラウザ4成功/7失敗/0 skip。継続URLのorigin拒否が通信前に作動した。
実画面では保存・発行・受取・再送のDB事実も確認できたが、閉じるボタン/alertの重複locatorと
期限切れ文言の試験側不一致を修正。未処理page errorは消さずに分類して再確認する。

3回目（head `5fde0cb27b3e873ad7e45ab1a8dddaaa5da260d6`、
[run 36713652568](https://github.com/me-ish/me-ish-homepage/actions/runs/36713652568)）では
実Storage **28成功/0失敗/0 skip**。200MiBの署名TUS・全bytes digestも成功。
画面の業務シナリオ10件は成功したが、未処理page errorを検出する1件は失敗。
更新操作で発生するエラーを秘密値/URLを消した診断で特定し、成功扱いにせず修正を続ける。
同headの既存Phase 0Aでは、ギャラリー受付の同時finish試験2件がStorageの一時500で失敗
（[run 36713652064](https://github.com/me-ish/me-ish-homepage/actions/runs/36713652064)）。
同経路は今回変更しておらず、先の2 runは成功している。失敗証跡を保持し、検証条件は弱めない。
4回目（head `c9f4d9a2d997548dc66ef6693d7fb35d79ecf9ef`、
[run 36714644852](https://github.com/me-ish/me-ish-homepage/actions/runs/36714644852)）も
28+10件成功、未処理エラー検知1件失敗。秘密値を除いたエラーは`Event`で、業務操作の失敗とは
判別できない。N/1の試験用Nextコンパイルcacheを分離し、resource失敗の分類も採取して切り分ける。

初回Actions（head `2ed143d5d0522ab075ed1f6a0f0dde3a4e143da2`、
[run 36709511224](https://github.com/me-ish/me-ish-homepage/actions/runs/36709511224)）では
Phase 1実Storageが26成功/2失敗/0 skip、ブラウザ試験は未到達だった。
旧受取日時の比較をDB表現へ合わせ、TUS継続先の安全な診断と通信前origin拒否を追加して再試験する。
独立したブラウザ試験も証跡を採取し、いずれか失敗ならjobを失敗にする。
既存CIのSecurity Auditはmainと同じlockfileのdev依存`brace-expansion`に対するhigh警告で失敗。
初回は実装試験の成否と分けて記録した。追加調査では上記のdev依存3箇所だけを更新し、
high severity gateや通常CI/既存Phaseの検証条件は維持した。

未実施：実メール箱での納品通知/再案内/受取通知、iPhone Safari実機・ホーム画面版、
本番Storage上限の確認、本番flag/暗号鍵設定、実顧客案件の納品操作。
以前のホーム画面版から相談添付を開く白画面は、ユーザーが軽微として次へ進むと判断した事項。
今回のモバイル幅試験をその実機問題の解消根拠として扱わない。

## 将来の本番移行順と停止条件

この節は次の承認対象であり、このWorkでは実行しない。

1. **Verify**：main/配信SHA、対象table/RPC/trigger定義と件数、private bucket、global/bucketの
   200MiB上限、N outbox、メール設定、既存hash/expiry/accepted/paidの維持条件を再確認。
   定義が異なる場合や既存納品が増えている場合は、対象だけ読み取り確認して順序を見直す。
2. **Application expand**：Phase 1コードを有効flagなしで先に配信。旧コードが新tableを要求しないことを確認。
   新UIの完了後再案内はflag切替まで旧APIが拒否する。旧APIのcompleted拒否は維持する。
3. **DB expand**：短い納品操作保留期間を明示し、migrationをtransactionで適用。
   旧RPCは未受取をfail closedするため、先にDBだけ変更して旧受取が通常動作するとは扱わない。
   この間、新規納品の送信・ファイル編集・受取試験を並行して走らせない。
4. **Compatibility /必要時migrate**：旧行があれば、管理画面の再確認で実体を証明した行だけready。
   正常な旧納品は明示的な発行操作で同じ期限・同じ旧hashをreleaseへ追加できる。
   サイズ不整合・期限切れ・欠落・受取済み実体不明は自動修正せず記録を維持して個別確認。
   存在しないfileをreadyにする、期限を延長する、受取を消す、token一括再発行は禁止。
5. **Cutover**：安全な秘密管理から専用の64桁hex暗号鍵`NATORI_DELIVERY_NOTIFICATION_KEY`を設定。
   `NATORI_ACCEPTANCE_OUTBOX_ENABLED=1`を維持し、`NATORI_DELIVERY_INTEGRITY_ENABLED=1`を有効にする。
   送信停止中の事前確認では`NATORI_NOTIFICATION_SENDING_ENABLED=0`を使えるが、公開GETは読み取りのみ。
   鍵なし/誤設定では発行を拒否する。保管期間内の鍵ローテーションをこの実装で自動化しない。
6. **Verify production**：許可された架空案件で保存→ready→発行→取得→受取、通知状態、旧URL、再案内、
   PCとiPhone実機を確認。実メール3種と再送の結果も別途確認し、異常時はその段階で停止。
7. **Contract**：今回なし。既存column/旧hash/RPCを削除しない。旧コード削除は安定確認後の別Work。

必須のStorage limit、秘密鍵、N outbox、migration互換性を確認できない場合は有効化しない。
メールで業務statusを戻す経路や、旧署名でのファイル差し替えが残る場合も停止する。

### Rollback

追加table/columnを残す。発行前ならflagなしのコードに戻せるが、DB適用後の旧RPCは未受取を拒否する。
**新releaseが1件でも作られた後は、旧版へ単純rollback/Phase 1 flag OFFをしない。**
追加accessの読取・manifest・受取ガードを持つPhase 1互換コードを最小復帰点として、納品操作を保留して
修正配信する。通知だけを止める場合はsending flagを0にし、業務記録とjobを残す。
application rollbackで確定事実・hash・expiryを巻き戻すことはできないし、行わない。
DB drop/down、一括status変換、既存file削除、暗号鍵の即時破棄はしない。

## 再実行・次の判断

### 2026-10-01 JST 0Aの追加診断と復旧

診断head `d7a8fd1a988b4a3ce2fac78455726ff8608698b4`の[run 36778520351](https://github.com/me-ish/me-ish-homepage/actions/runs/36778520351)はbefore/after 26/26。
Storageの実backendはfileで、59件の同一公開先への複数200 uploadと旧版削除を確認したが、このrunでは500は発生しなかった。
固定サンプルを各mode自然96組・同期48組へ増やしたhead `55302499e252fbb983887908cd086f9dbe6d920d`の
[run 36779194764](https://github.com/me-ish/me-ish-homepage/actions/runs/36779194764)もbefore/after 26/26で、自然な500は捕捉できなかった。
これらの成功だけで、過去の失敗解消や隔離環境固有と判断しない。

head `1f147c1ec21042138cbf8cd96280a207d567269f`の[run 36781501860](https://github.com/me-ish/me-ish-homepage/actions/runs/36781501860)で、
順序制御fixtureを入れる前の通常before/synchronized sample 47に自然な失敗を捕捉した。
両upload 200後のdownload 500の内部原因は`ENOENT / FileBackend.getObject`。
欠落した内部版のfingerprint `abc39108cb25d278`と、その5ms前の同じobjectの`ObjectAdminDelete`削除版が一致した。
これはcutover前でも起きる既存Storage/旧版削除の競合であり、Phase 1の納品処理やpolicy切替を原因としない。
初期修正候補はstorage-js downloadがHTTP Responseを`StorageUnknownError.originalError`へ包む形に未対応だった。
実SDKを固定レスポンスで動かす回帰testで失敗を再現し、このenvelopeとS3のHTTP400/semantic404を識別する読取復旧を追加した。

公式Storage v1.77.0のpermission checkは試行insertをrollbackし、completeUploadは同じ公開先をlock後にupsertする。
両writerが先にpermission checkを通過すると、upsert=falseでも2つのuploadが200となり、2番目が旧内部版の削除を予約できる。
downloadが旧DB版を参照してからbackend実体を読む間に旧版が削除される競合を、上記の未変更Storageのログで確認した。
自然な競合で内部原因を採取できたため、一時的な順序制御fixtureは最終構成から除去した。
最終検証はStorage内部コード・レスポンスを変更せず、before/afterそれぞれ26ケース、固定自然96組・同期48組で行う。
実SDKの500/semantic404 envelope、認可拒否、継続障害を別のunit testで確認する。
正確な試験範囲・最終結果は[0A runbook](../../scripts/natori-phase-0a/README.md)とPR #101本文に記録する。

gallery serviceの最小修正は公開先の読取を最大3回へ限定し、metadata・容量・MIME・全bytesのSHA256を読み直すこと。
追加待機は50ms/100ms。内容不一致、認可拒否、継続障害はfail closedを維持し、読取失敗から再uploadへ戻らない。
unit testは旧実装で失敗を確認してから復旧・容量/MIME/hash不一致・認可拒否・継続障害・公開先消失を検証した。
今回のPhase 1納品処理を原因とするものではない。本番のStorage版/backendおよび実際の発生有無は未確認。

`scripts/natori-phase-1/README.md`の手順とPRのNatori Phase 1 workflowを使う。
初回専用workflowはpull_requestで起動し、mainへの先行mergeや本番Secretsを必要としない。
既存CI、Phase N/4のassertion・skip・continue-on-errorは弱めない。

最終的にDraft PR、実際の試験SHA、run URL、成功/失敗/skip件数を確認してから本番移行の判断へ進む。

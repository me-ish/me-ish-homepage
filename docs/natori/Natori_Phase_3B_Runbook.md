# Natori Phase 3B — consultation send integrity

原本範囲は `Natori_Improvement_Plan_2026-09-26.md` Phase 3B（555–581行）、QA F16/F20、UX U08。U07の履歴更新は既存Phase 4を再利用する。原本3資料の現Work保存コピーとLibrary由来記録を参照しており、認証済みmaterializeのバイト証跡とは区別する。

依存baseは受入済みPhase 3A / Draft PR106、`110f3f9484f2698f9efdb5358d615d941286c08b`。本草案は通常コード・回帰テスト・依存Draft PR・隔離検証の引継ぎ資料であり、本番マージ、デプロイ、本番DB更新、実顧客操作、実メール送信を含まない。3Bのcommit/head/PR/CI受入は親担当が実施後に記録する。現時点で3B完了とはしない。

## 実装する動作

管理側・依頼者側とも、ファイル選択は名前・容量・取消を持つローカル下書きであり、選択だけでは予約、upload、message共有、通知を行わない。本文のみ、添付のみ、本文＋添付を同じ「送信」で確定する。送信前のファイル取消は本文を維持する。

一つの送信operationはproject＋sender側＋operation IDとcanonical hashで固定する。同じIDの再試行・並行送信・応答喪失後の照合は元のmessage/file/通知receiptへ戻り、内容変更は拒否する。同じ本文を別IDで改めて発言することは許可する。sessionStorageに同じ操作と本文・添付manifestを保持し、reload時に照合する。Fileの実バイトは自動復元できないため、未upload分は元と同じファイルを元の順序で再選択し、名前・MIME・容量・SHA256の一致を確認する。不明結果から別IDを自動生成しない。

送信後に予約・正確なStorage pathの署名発行・upload・実オブジェクトの容量/MIME/SHA検証を行う。署名発行前にprivate issuerをDBへ保存し、返却されたcredentialの実expiryとbucket/path/upsert=falseを確認してから発行結果をdurableに登録する。登録成功前にcredentialをUIへ返さない。発行/登録の不明結果を未発行と見なさない。

本文、添付関連、予約finalize、必要なaccess、message一件に対する通知予定一件、operationの確定receiptを同じDB transactionで保存する。owner/current project-scoped token、frozen hash、claim/leaseをlock待ち後にも再確認し、最後のbusiness/FK更新後に期限を再確認する。遅延したclaim/accessは40001で全business更新をrollbackする。3B確定済み・通知連携済みmessageの通知失敗時は通知のみ再試行し、本文・添付・accessを再作成しない。保存後の履歴取得失敗は「保存済み／表示更新に失敗」と分け、本文の再送を誘導しない。

相談添付と応募時原資料は、存在情報、署名URL取得状態、一覧取得状態を分ける。署名失敗した行は残し、一覧取得失敗を「資料なし」に置き換えない。URL再取得で回復できる。画像/PDF/音声の既存形式・サイズ・所有検証を保持する。新しいリアルタイムチャットは追加しない。

## 既存案件と通知表示の互換性

既存consultation token/access、過去message、file path、原資料、制作status、入金・受取・メール履歴を保持する。古いmessageへoperation IDを推測backfillせず、旧未完了reservationを一括削除しない。新旧データを同じ履歴readerで扱う。既存finishの履歴は書き換えず、旧直接finishは正確な確定済みmessage IDを返すread-only adapterへ移す。IDなし旧送信は副作用を起こす前に426の更新案内を返す。入力を捨てる自動reloadは行わない。通常の明示的な旧staff通知retryはowner/project/messageを検証し、連携済みの通知証拠を再利用して既存相談窓口へ案内する。通知job未連携の旧staff messageの初回明示retryだけは、一件の通知証拠と新accessを同transactionで初めて固定し、以後は再利用する。既存token・本文・fileは保持する。

Phase 4の画面、返信待ち表示、返信窓口を再実装しない。新messageは通知jobの状態を本文へ投影するため、従来overviewの「全message通知件数＋最新job件数」では同じ通知が二度計上される。3B migrationの通知count互換overlayは、インストール済みoverviewのlegacy集計だけを `notification_id IS NULL` に限定する。元の関数本文のexact clauseが一か所であることを検査し、差異は23514でmigration全体を拒否する。owner/project範囲、最新message、最新retry、既存N/4以降の全通知purpose、戻り値・権限と旧message/job自体を保持する。元のPhase 4 migrationは変更しない。

## 発行済み権限の保留・容量制約

署名期限切れは、新しいprovider requestの拒否と、期限前に受理されたuploadの完了を区別する。実providerのadmitted-write quiescenceは証明されていない。現在の方針では未解決issuerまたは一度でも発行済みcredentialを持つ予約は、取消・期限経過後も自動cleanupから恒久的に保護する。expiry/issuer証拠をtimeoutで消さない。これは自動処理上の無期限保持であり、実providerの安全なdrain/revocationや運用回復が実証済みという意味ではない。

案件ごとの60ファイル上限はsender双方で共有し、確定済み相談fileと、旧unfinalized予約および未cleaned operationのunfinalized予約を含む。取消済みでもissued/unknownの保留予約は枠を消費し続け、枠不足へ達し得る。新規予約は既存の一時間10ファイル上限と一送信10ファイル上限も維持する。上限を緩めたり、実案件の予約を削除して回避したりしない。実運用の容量・復旧方針の確認は将来の本番切替前に必要である。

未発行であることが確定した取消operationだけは、未確定・非参照・leaseなし、記録済みsigned_expires_atが未来でないことをDBで再確認し、durable cleanup tombstoneと正確なpath一覧に対してStorage削除し、同じ一覧のcleanup_doneを確認する。予約時にも記録するsigned期限は既存のDB timing fenceであり、provider quiescenceの証明ではない。remove失敗・ACK喪失は証拠を保持する。operation/予約metadataは削除せず、cleaned状態で残す。実provider完了の推測時間、広域scan削除、旧予約一括削除は導入しない。短TTL PUT/PATCH probeは通常受入へ未接続であり、仮に成功してもin-flight完了の上限証明にはならない。

## 最終7層パックとソース固定

最終パックは `task/phase3b-after-notice-rebased`。original apply manifest全35pathのうち、古いworkflow一件と共有runner二件を除外したfiltered original32へ、次を順に重ねる。除外したrunner/workflowは最終runner層で既存phase chainと合成する。旧sealedパックを直接更新せず、各層のexact block/source hashを守る。

1. filtered original32 product
2. issuer6
3. storage-inflight4
4. authoritative-path/retention fixture（1path / 2blocks）
5. abnormal fixture（1path / 3blocks）
6. notice-count SQL/fixture（2paths / 4blocks）
7. 最終runner（6paths）

初回f179時点の Canonical 3B migration `20261001225106_natori_consultation_operations.sql` LF SHA256は `33d42306360dfff141b50f7ab21740ed90334dbb01ab5d77fb8ffddc137d7586`、Git blobは `8a48f81ad86ac80390c10a106b83d4f5739be900`。最終integration LF SHA256は `934cab274465ae4da992e6479c6e771b6ea5ca70bc975a11ae5427a8d2d3927b`。3A SQLは `b933138814adbd86f8e9fb9658a76e3de3dab808d07f5dfa96432c6fa6189d14` を維持する。baseline checksum、binder、dependency guardはこの最終3B SHAを使う。

## 実検証・静的確認・未検証

受入済み3A証跡は `task/ci-36963306132/verified-acceptance.json`。CI36963306132、head `110f3f9484f2698f9efdb5358d615d941286c08b`、tested merge `a7c374406fb01689543ad1f41ba3a0b3d7f8dc23`、同一tree `05a790cb1f00e46a6dd921ef09859a82539f98bd`。3Aは実隔離DB/Storage26件、実Next/Chromium9件、失敗・skipなし。既存N23/9、2A14/6、2B18、2C35/9、2D41/5、post2D compatibility18、isolation17、current/candidate各35も同runで成功し、committed browser source31件を確認した。実providerの検証済み証跡ではない。この3A結果を3Bの成功へ読み替えない。

最終3Bパックはtask内のcombined graphでtype/bundle/fixture/syntax13確認、適用順・flag・mount・hash・baseline等27guard確認を記録している。13確認には最終timing unit overlay後のfresh type再確認と、入力fingerprint一致後のみ持ち越した他12結果を含む。通常commitの57source agreementと38raw source guardも記録する。これらはソース確認・構築であり、DB/Storage/Next/browserの実行受入ではない。通知count層は別途type/bundle/SQL fixture構築/AST保持と7applicator確認、actual reader/component＋mocked RPCの4再現確認を実施した。実SQL件数の証明はこれからである。

草案作成時の凍結パックREADYは `accepted3AHead:null`、`binderExecuted:false` の受入前snapshotを保持している。上記の実3A受入を確認した後、親が同じartifactの26/9・head/tested tree・source agreementをbinderへ渡し、新しいtask binding metadataを記録する。草案は旧パックを変更せず、まだ実行していないbinderや3B CIを成功扱いしない。

必須3B gateは**実隔離DB/Storage30件、実Next/Chromium13件**。175assertion callsiteは直前の163expressionと全30case identityを保持した追加であり、175件の実テスト成功を意味しない。並行/同本文別ID/応答喪失、owner/cross-token/anonymous拒否、lease/token期限のlock待ち、atomic rollback、実Storage内容/権限/改ざん、unknown issuer保護、cleanup remove失敗/ACK喪失/参照競合、既存finish replay、通知だけretry、連携通知の一回集計、localdraft取消、資料URL・list失敗と回復、履歴reload失敗後のreceipt維持を含む。前段全phase chain、private historical preseed、alias preflight、purpose互換gate、sealed egress/mail/provider境界を保持する。最新3B headに対する親の独立レビュー、CI head/tested/tree・実source digest・全report・egress証跡確認後に受入を記録する。

3B Draft PR/head/CI、実30/13結果、実行環境version、source receipt、artifact/隔離確認は未記入・未検証。本番Storageのadmitted-write completion、実provider profile、実メール、iPhone写真/PDF・長い会話操作の手動受入は未検証。実メール/iPhoneはユーザー指定のPhase 7後のまとめ受入で行う。

## 将来の切替・rollback・次工程

将来の本番切替は今回の範囲外。原本順序は追加キー/互換DTO/RPC→新旧reader→composer/server同時cutover→旧sign/finish adapter。旧caller利用と更新案内を確認し、既存reader/receipt/確定済みfinish replayを保持する。DB未展開のserverや、新operationを読めない旧composerへ部分切替しない。

Rollbackは新operation/DTO/receiptを読める互換版へ戻す。新添付送信の停止は可能だが、既存token/history/result lookupと保留証拠を保持する。選択即送信・独立message INSERTの旧経路は再開しない。operation/manifest/receipt/issued markerを削除せず、token大量再発行や本文/添付の再送を復旧手段にしない。停止方法は適用済み実装と配備計画を確認したうえで別途選び、存在しないflagを本草案で指定しない。

Quick isolated checkは、staff/client各側で選択→ファイル取消→本文保持を確認し、本文＋添付を一回送信、応答前中断/reload→同じreceipt・必要時同じfile再選択→同じID再試行でmessage/file/通知が増えないことを確認する。続いて履歴GET/署名URL/list取得を隔離故障させ、保存済み内容と資料存在が残り、再取得で回復することを確認する。3B・通知連携済みの旧messageの通知だけretryは新message/files/accessを追加しない。未連携旧staff messageの初回retryは上記の一回限りのnotice/access固定を別に確認する。実メールは送らない。

受入済み3Aをbaseに3Bを統合・通常commit/push・依存Draft PR・上記隔離gate・独立レビューの結果を記録し、その後5/6A/6B/7へ進む。準備済み後続phaseや全Phase 7完了を宣言しない。

## 統合後のcommit直前記録

codex/natori-phase-3bへ7層37対象を適用し、全37ファイルがレビュー済みcombined graphと一致した。既存の参考画像見出しの単位「件」を維持するproduct/test各一文字の修正と、7ファイルの末尾空白だけの修正を追加した。旧InquiryDetailPanelの25ケースとassertion本文は変更していない。

実3A binderを新しいphase3b-after-notice-versions-rebasedで実行済み。元artifactのversions.txt、26/9結果、実workflow CI receipt、57 commit source/38 raw guard、tested mergeとheadの同一treeを確認した。旧d5f078 sealedパックは変更していない。実artifact11209335157、run36963306132、base110f3f9484f2698f9efdb5358d615d941286c08b。

統合済みコードのlocal unitは162ファイル／1,382件、全成功・失敗0・skip0。strict TypeScript、31対象lint、baseline29 active／55 archived、3B bundleとSQL fixture、4 Node／2 Bash構文、canonical SQL／whitespace確認が成功した。最初のfull unitで検出した見出し一件の失敗証跡はtaskに保持する。

3Bの実隔離DB30／ブラウザ13と全前Phase回帰は、これから作成するDraft PRのexact headで実行する。実CIのhead/tested tree／artifact／source digestの照合と親の独立レビューを受入条件とする。commit/hash/PR/実CI結果の確定記録はDraft PRとtask checkpointに保存する。Phase5以降の準備テストは3Bまたは後続統合の受入へ読み替えない。

## 独立レビュー修正と再検証

初回head `f179af91ff8c0d554581893ffbd7fb638814efd8` のCI36967084931は、過去15レポート300件が成功し、3B DB29/30、ブラウザ10成功・1失敗・11/13実行で失敗した。失敗artifact11209699845とv4診断を保持し、初回実行を3B成功と扱わない。

復元lookupの古い結果は、現在のactor/mode・operation世代・pending ID/hash・durable cacheの一致を満たす場合だけ本文・添付・送信記録を退役させる。新しい入力や操作への遅延応答は無効化する。全GET経路がactor/read versionに応じてloading/error/historyを所有し、保存済みlookup後のGETが古い初回GETを待たずに操作を解放する。cancel/再試行/新しいfreezeも別のdurable記録を上書きしない。

通知projectionは最新attemptのINSERT/UPDATEを反映し、pending/sendingはpending、unknown/failedはfailed、sentはsentにする。unknownの既存契約は維持する。messageを先にロックしてから別statementで最新attemptを再確認し、待機した古いcallbackによる上書きを防ぐ。送信停止設定は維持し、fixtureは停止中サービスの拒否・事実不変を確認した後、owner-scoped retry RPCを独立に検証する。実メール送信を有効化しない。

未commitの通知snapshotまたは必要accessが期限切れならnotice_expiredを返し、古いsnapshotを復号・再生成して宛先を変えない。同じ本文・manifest・operation ID/hashと予約証拠を保持し、確認済み取消後にだけ新IDへ移る。本文と選択済みFileは下書きに残す。再読込で復元できないFile bytesは再選択を案内する。committed receipt、cancel/cleanup/private issuer完了とmatching claim releaseは維持する。claim後の期限切れは対応claimをreleaseし、commit postlockと最終business更新後のfresh server clockで期限切れを書込拒否・40001 rollbackする。

今回のcanonical SQL LF SHA256は `124e7c46c0a8831b9b9346d4c5cd57adbc84ec2847f79fe07623001113b5d2c5`、Git blobは `767373dc433f089a8d52367842f8581afa837e49`。integration LF SHA256は `9eec10847359564d8c21da6b2925e5e07c9b123a50c1c60750506953d2ca5b3c`。baselineは3B checksum一件だけを更新し、3A SQL b9331388および他28 active/55 archived登録は維持する。原175 DBチェック式・全30 DB case identityと、ブラウザ21チェック・17 assertion・全13 case identityを保持して追加回帰を重ねる。

統合後の型・全unit・lint・baseline・bundle/fixture・構文をrootが検証し、通常commit/pushしたPR107のexact headで実隔離DB30/ブラウザ13と全過去300ケースを再実行する。成功artifactのCI/head/tested同一tree・source digestをv4で照合し、親の独立再レビュー修正を反映してから3Bを受入とする。新CIは本commit前には未実行であり、完了・未検証・exact headはPRとtask checkpointに記録する。

本番merge/deploy/DB/顧客操作と実メールを実施しない。実provider profile検証とiPhone/実メールの手動受入は未実施で、後者はPhase7後にユーザーと実施する。3B成功後は新しい受入head/source receiptに結合して5→6A→6B→7へ継続する。


### Follow-up isolated fixture verification after CI36972608297

The four product review repairs were committed normally in `abb23a9d7d5f6579f9b50fb3e9fe28a881526f30`. That exact CI executed all 343 cases: all 300 prior cases and 13 browser cases passed; 28 of 30 DB cases passed. The client/staff text cases both failed `NOTICE_CANCEL_RETAINS_FROZEN_ORIGINAL`. The original artifact and strict failure receipt remain preserved; this result does not establish Phase3B acceptance.

Cancellation only changes status, claim and lease. The new assertion had compared PostgreSQL JSONB object-key serialization against submitted JS object-key order. The scoped fixture correction separately checks the strict complete original request, canonical body/file values and full request hash, and the exact previously persisted frozen manifest and encrypted snapshot. All original 175 assertions and 30 DB/13 browser case identities remain; the reviewed expiry fixture assertion count increases from 224 to 225. Product SQL, UI, service, baseline and unit sources remain identical to the product repair commit.

The task-only reconstructed DB-shaped key-order proof reproduces the old assertion failure and passes the corrected checks. Mutation controls reject changed or missing file properties, extra properties, descriptor count/order, IDs, body, request hash, status and encrypted snapshot. These controls, scoped strict types, lint and real integration bundle passed. Actual DB/browser acceptance still requires a fresh completed exact-head CI artifact, all 343 cases passing with no skip, strict source/tree verification and independent review. No actual mail/provider/customer action is part of this fixture change.

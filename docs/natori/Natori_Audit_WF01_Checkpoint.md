# WF-01: ラフOK後の対応見落とし

## 変更と現在地

main `9abcd1310aba049d512221c2786119af06b12e35`から独立した`codex/audit-wf01-rough-followup`の変更。#162/#163/#164/#165のDraft差分を含めていない。実装とローカル検証を完了した保存点であり、GitHubのnative/HTTP受入結果は同じHEADのPRとartifactを参照する。本番未反映。

6.1 Sol・極高でアプリ/SQL/テストを実装し、認証・DB・通知境界をAstra・極高で独立レビューした。現在のsourceレビューでブロッカーなし。最終受入には固定commitとnative/Phase4の実行証拠の対応確認も必要である。

旧経路はOKの直接UPDATE後にメールをbest-effortで送信し、OKだけでは最新senderがstaffのまま「依頼者の返信待ち」だった。今回は現在のcapability/owner/project/rough/messageの境界を保ち、新OK・immutable event・一つの論理通知を同じDB transactionへ移した。メールの失敗や中断でOKを失わず、保存済みのjobを既存outboxから回復できる。

管理overviewはv2へ移し、未確認のOKを「ラフOK・次の対応待ち」と表示する。取得不能はunknownとして要確認に残す。確認待ちは返信・メール成功・支払案内・通常status変更で消えず、ownerが対象ラフだけを確認する操作で消える。複数ラフ・新しいOK・同時確認は独立し、案件statusを自動で進めない。

staff画面には元のmessage/fileへ結び付くラフ別表示、確認、メールだけの再試行を追加した。確認のrefreshで本文/添付の下書きを失わず、別staffの確認もprobeで検出する。通知停止時でも確認状況とpending jobを見せる。汎用acceptance UIのflag契約は変更しない。

closedの未対応OK/取得不能は一覧とホームの要確認に残る。確認操作は終了状態を変えない。closedで確実に未対応OKが0と分かった場合は従来の履歴のみへ戻る。deletedの新操作は拒否する。導入前OKは確認待ちとして読み、通知のbackfill/架空の送信済み扱いは行わない。

deletedは`deleted_at`によるsoft deletionの範囲。事実の直接編集/削除は拒否するが、既存project/messageの物理削除cascadeは保持しており、その後の保存を保証しない。本番で物理削除を提案・実行していない。

## ローカル検証

- 元コードで追加テスト2件が失敗し、OKだけの返信待ち誤表示とdurable RPC不使用を再現した。20件は対象filter外のskip。
- 修正後、関連29ファイル/267件成功。最終UI3ファイル/10件も成功。Astra独立実行11ファイル/165件、fixture guard4件成功。
- rootの最終全unitは240ファイル/2,366件成功、fail/skip0。型とLintも成功。既存AnnouncementCardのimg/alt警告とJSDOM navigation未実装の出力は残る。
- 全unitの初回は旧readonlyテストの期待RPC名がv1だったため1件失敗。v2へ更新し、owner/active/archive/no-writeのassertionsを保って同じ全suiteを再確認した。
- staticは32 active/55 archived、失敗0。凍結baseline pair `d395d0735ab8e25826a2654f9d38f4c3e7688f08f47405e861ba6bd2956d980a`は不変。reader builder4件、Phase6A source preflight、Python/shell/Node syntax、diff check成功。
- 新SQL SHA-256: `e54f41607ad0241dd4ee66c89d4097a2f38172d762323637e4135ab757db6c97`。CLIの`migration new`が実際に生成したファイルを使う。生成後のtelemetry shutdown timeoutはschema適用失敗ではなく、生成成功後の終了エラーだった。

## 隔離受入の設計と判定範囲

`Natori WF01` workflowはofficial PostgreSQL17.11の固定digest、network none・Unix socket・使い捨てDBで実transactionを動かす。Auth/Storage platform schemaは合成stand-in、providerは使わない。12個の指定既存SQLと新forwardだけを適用し、全active replayの成功とは扱わない。

実Lock waitを観測した同時OK/確認/新OK、失敗時の全rollback、capabilityの期限/変更/queue待ち、owner変更、browser ACL/RLS/trigger/body/purpose drift拒否、歴史的OKの無通知、失敗対unknownの再試行を検証する。旧直接service UPDATEとRPCのlock順序にはretryable deadlockがあり得るが、一つの事実/論理jobと再試行可能性を検証する。prodのservice role自体は信頼境界である。

中断試験はCOMMIT後のpsql backendを終了する。Next workerの実process終了ではない。worker例外/再開・固定payload/provider key・5xx/timeoutは注入transport/RPCのunit試験で扱う。

Phase4は既存17件を保持し、実Next API→PostgREST→DB→隔離メールcapture→staff画面の6件を追加した。合計23件を要求し、同時OK、失敗通知/replay/再試行、未対応の独立性、draft、closed/unknown/deletedを確認する。providerの実配達・受信箱、Google OAuth、iPhone Safari実機の受入ではない。

現行管理sourceが早期のPhaseN/standalone0B試験でもv2を読むため、exact named reader schemaを一度だけ先行適用する。後の3Bでは既存fault helpersを保持してpurpose集合だけを復元する。歴史的migrationを書き換えず、存在を装うmock RPCを追加しない。Phase6Bのrendered inventoryに新しいcomponent/pure lib/consultation typeの3パスを追加し、既存の検査を保持した。

最初のPhase4 CIは20件成功/3件失敗。追加した普通の返信fixtureがtext-onlyでも必要なprepareを省略して直接commitしたため拒否され、後続の個別確認試験も前提不足で失敗した。実composerのprepare→commitを使うよう試験を修正した。製品コード/SQLを変更せず、元17件と追加6件のassertionsを保持して最終HEADで再検証する。最初の失敗を未知エラーの再実行だけで解消とは扱わない。

## 本番適用の条件と残作業

[Deployment Runbook](./Natori_Audit_WF01_Deployment_Runbook.md)にmetadata確認、停止条件、影響、事後検証と障害時の扱いを記載した。旧OK endpoint/workerと通知送信をquiesceしてschema→対応アプリ→受付/通知再開の順とする。旧直接Resend版と新outboxの同時稼働は重複送信につながる。

マージ、本番DB/権限/Storage変更、本番deploy、顧客行の読取/修復/削除、実メール/決済を行っていない。現時点のproduction catalogも今回新たには確認していない。#162のPhase6B初回終了エラーの原因未確定という制限は変わらない。

GitHubの最終HEADで必須workflow/jobs、native checksとsource hashes、Phase4の23件とcheckout treeを確認した結果をPR/引き継ぎ報告へ記録する。production適用と顧客受入は承認後の別工程である。次の監査項目はPAY-02で、今回のWF-01に含めていない。

# Natori Phase 7 Runbook（適用前の手順案）

この文書は原本Plan Phase 7・UX U20–23に基づく再評価台帳。過去のHEAD `a8b5efeda97b8a3e0af503fefe60b34d06ed9106` / CI37032465563では、attempt1が既存Phase N browserの8成功・1失敗で終了し、attempt2は新6B bootstrap通過後の8ケース中7成功・1失敗（`AUTOPLAY_NOT_RUNNING`）だった。修正前の照合済みHEAD `563cddf018cb335782aa915fbb6d7cc00f9b85ae` / CI37039528065 / artifact11242356951は、21 reports・374件実行で373成功・1失敗（`MANUAL_RESUME_FAILED`）、必須原本PNG12枚を確認済みだが6B未受入。失敗照合receipt SHA `21e709881dc8b53f27a66a564d65c0c1a7c20a360ddd7d932f8605900b49b4ec` を保持する。再開後の時刻進行を分割したbrowser SHA `4f5dfb49045fad5496f34e387acfb0e4bf3c4b16192f90797a09d2de14caf394` は当時の独立レビュー済み修正sourceであり、sourceレビューだけでは成功CIや6B受入を意味しなかった。実受入6BのHEAD `dc27b4387ba119cbaa73193d989dcc8cff60c594`、CI `37042404421`、strict受入receipt SHA `75f0e45f81b66c413afd866872b287cb70c9f2a0f9bc1f512a204c2ca6c4279a`、親の受入binding SHA `74de32e8ad874738e177e5ec67f4dc06da10e1e310a69e1a4085971f0f84bd16`を原本と照合した。全374件と必須原本PNG12枚が成功し、親の独立レビューによって6Bは受け入れられた。この冒頭は初回 `0706488db6b89b9386f28e96f772dbcb358c6afc` 適用前の計画を記録したものです。当時はPhase7のHEAD／CI／artifact／画像の証拠がありませんでした。現在までの070／252の失敗記録と追加差分は下の追記を参照します。Phase7の実受入と画像確認は未完了で、成功後に新しい実受入記録を追加します。

## 変更と採否

初回070のアプリ採用差分は EstimateJourney の `← 案件管理へ戻る` → `← ダッシュボードへ戻る` の1箇所で、href `/natori/dashboard` を維持し、専用workflowと本書を追加しました。当初の対象は以下の5パスで、この一覧は初回差分の履歴です。252までのPhase N browser追記を含む既存PR6パスに、今回のProjectCardとPhase7 prepare-browser追加を統合したPR全体の対象は8パスです。今回の追加差分自身は末尾に示す5パスで、管理主操作の共有CTA色と隔離検証fixture・手順書に限定します。DB migration・業務API・公開contentの変更を含めません。

- `src/features/natori/components/dashboard/EstimateJourney.tsx`：U21の戻り先caption。
- `scripts/natori-phase-7/browser.mjs`：タスク展開の実responsive初期状態を待ち、閉じている時だけ開いて既存assertion・画像を維持する。
- `scripts/natori-phase-7/seed-fixtures.mjs`：架空の3案件に`delivery_plan: 'normal'`を明示し、実管理readerの既存schemaを満たす。
- `.github/workflows/natori-phase-7.yml`：実受入済み6B workflowからexact blockで継承する全先行gate。
- `docs/natori/Natori_Phase_7_Runbook.md`：この新しい手順書。

| 原本 | 今回の判断 | 残る判断・比較 |
|---|---|---|
| U20 | 回転・影・テープと作品主役の作家性を維持する。 | 要素別の弱化はDeferred。合成作品だけで好みを決めず、所有者の意図と同一作品の比較を待つ。 |
| U21 | 戻り先captionを採用。先行Phaseで直した意味・金額・日付の区別を維持する。 | 全域の字体置換は据置。過去snapshot・原回答・送信履歴・合意本文を書き換えない。 |
| U22 | 分類・作品順・ID・URL・拡大導線を維持。`/natori/works`へ営業・相談CTAを増設しない。 | 分類再編・新参照payloadはDeferred。旧 `/natori/works/[slug]` の既存VGen／メール導線は別目的のため、追加・削除は所有者判断を待つ。 |
| U23 | 誰／状態→次作業→主操作→納期という実表示、全文と重要条件を維持。 | 補助時間の折りたたみ・本文の太字削減はDeferred。実画面と利用者観察で採否・残る影響を記録する。 |

希望予算／見積り総額／入金額、希望納期／確定納品日、用途／題材、未定／未確認、制作状態／相談返信待ちは別の事実として保持する。「ナトリの返信待ち」「依頼者の返信待ち」「返信状況を取得できません」を区別し、未知を「やり取りなし」へ置き換えない。

制作物・範囲・用途・商用・公開・総額／内訳・支払・キャンセル、AI学習禁止、通常ラフの無料リテイク2回、量産は原則リテイクなし、ラフ確定後の軽微な修正のみを省略しない。承諾時の支払条件と現在のリンク期限を分離し、再通知で期限が延びない説明を維持する。

native7適用前のsourceレビューで、1280pxではタスクが初期展開されるため無条件clickが閉じてしまうことと、架空案件のdelivery_plan未指定が実管理readerの必須string条件を満たさないことを確認した。上記2fixtureだけを修正し、実componentの640px境界・公開条件・業務処理は変更しない。18ケース・33新required PNG・45aggregate required PNGの既存assertionと採取を保持する。実Phase7受入は新しい隔離CIと画像確認後に記録する。

## 適用・通常commit／push・Draft PR

1. 実6B成功をwhole strict verifierで照合する。primary metadata、actual head／tested tree／base、全21report・374case、106source key／79通常source、12実PNG、owned process／compile／readiness、親の独立レビューと画像確認が揃ってから受入bindingを作る。観測HEADや準備sealを受入に代用しない。
2. 封印済み `phase7-final-resume-qualified-consumer-prepared`（manifest `59a5f8db977fb2f3f873138e27f8d173d70b4d4f86cade23a98ae032f2c901cd`、FROZEN `e659d9ca7e5eb8b4dc24979750e2a192121941a3fdbebd24cff700ff871f3949`）へ実6B bindingと承認済みwhole verifier／contract／sealを渡し、新しいmode7 generationを作る。古い準備資料を変更せず、実受入HEADのraw preimageと新規workflow／runbookの不在を確認する。caption exact blockとworkflow derivationが変わっていれば新しい差分レビューを行う。
3. 実受入6Bから専用branchを作り、5パスだけをguarded applyする。protected source、stash、index、直接parentを確認し、型・scoped lint・既存unitの意味を保った全件検証・baseline/schema・builder/fixture/bundle/syntax・差分空白・exact source guardを実施する。検証記録はTaskに保存する。
4. 通常commit／pushし、実受入6B branchをbaseとするDraft PRを作る。強制push・本番merge・deployをしない。7 workflowは全11 Phase flag、全先行隔離gate、40分の上限、artifact命名を継承する。fontsは全builder後に1回だけ構築し、execution収集をその後に行う。

## 隔離評価・画像と最終台帳

native7は6画面×1280／360／390pxの18ケース。33個の新しい物理PNGを採取し、Phase5・6A・6Bの既存12個を保持して45個とする。全chainは22 report／392 case。最終Phase7 source inventoryは実Git・承認済みbuilderから導出し、件数を推測しない。

| 対象 | 新PNG数 | 読み取る内容 |
|---|---:|---|
| Gallery一覧・拡大・詳細 | 9 | 作家性、作品主役、カテゴリ／件数、44px操作、Escape／フォーカス復帰。 |
| Works showcase一覧・拡大 | 6 | 営業／相談CTA増設なし、関連リンクが作品鑑賞へ混入しないこと。 |
| 申込確認・編集保持 | 6 | 本文最終行、商用／公開・金額・日付・連絡先、修正操作と保持、横はみ出し。 |
| 正式見積り全文 | 3 | 全契約条件と承諾時条件／現在期限の区別、再通知の説明。 |
| 見積り戻り先・確認 | 3 | caption／href、実認証による過去draft読取と編集不可、既存確認導線。 |
| 最新管理カード・タスク展開 | 6 | 架空依頼者、ラフ、具体的次作業、11月15日、線画への操作と読み順。 |

実artifactをwhole strict producerで照合し、18case・33新PNG・45aggregate required PNGの実在／raw hash、全先行report、actual source／execution、owned Next終了／IPv4 port閉鎖、compile guardを確認する。rootは33新画像を実際に開き、読取・はみ出し・条件欠落の所見を新しい最終台帳に残す。Nextのconfigured hostnameはlocalhost、記録されたdefault DNS解決は127.0.0.1／IPv4 family4。API owner `/api/fixture-visual-owner`とfree／closed probeはliteral127.0.0.1、browser originはlocalhost／DNS ipv4firstを維持する。このDNS／到達性記録を直接のsocket待受address観測と同一視しない。canonical `/fixture-session`はAccept-Language:ja・cookieなし・redirect:errorで、HTTP200と実Sign inフォームを確認する。初回owner、session、最終owner再確認はspawn前から同じ120秒、各要求／本文は2秒または残り時間を上限とする。sessionページの接続拒否とtimeoutだけを再試行し、nonce／PID／ancestry／期限／redirect拒否を維持する。timeout・unknownをfree扱いしない。

native7の管理固定ケースは全返信待ち状態の比較ではない。申込は確認・編集描画で送信を行わず、実POST→保存→管理reader一致の実証は受入済みPhase5を別に参照する。DB前後hashは架空projects／quotes／project_tasks／portfolio_contentだけが対象で、全productionテーブル・全状態の無変更を証明したとは書かない。

## raw bytes・checkout比較の範囲

Phase6B手順書の「Git stores LF with core.autocrlf=true」は全repoへの規則として用いない。確認済みproposal raw SHAから、個別に記録された最初の3 harness RAW→Git移行だけで、レビュー済みCRLF→LFを行った。他のGit blobはCRLFを含み得る。checkoutとGitのEOL比較も認証済み実raw bytes同士のLF↔CRLF差だけに限定し、一般的な空白・BOMを正規化しない。実Git raw、source model／runtime receipt、report、artifact ZIP、PNGのhashは常に実byte列を使い、正規化しない。本書は過大な一般化の適用範囲を訂正するもので、6B既存文書や保存済み証拠を変更しない。

## 未実施・rollback・所有者判断

U20／U22／U23のDeferredは問題解消の宣言ではない。初回依頼者の架空タスクで条件の読み違い・立ち止まり・次行動の説明を観察する判断は残る。合成作品とChromium画像だけで嗜好・理解・完了率・売上・離脱改善を測定したとはしない。

実メールとiPhone Safari実機の手動受入はPhase7後に利用者とまとめて実施する。実Stripe test専用profileは未構成で、mock／隔離DB成功を実provider検証済みとしない。新規credential設定、本番DB／実顧客操作、実メール送信は含めない。

rollbackは採用したcaption・workflow・新runbookの個別revert。ID・URL/token・原回答・合意・quote／payment／delivery／consultation／status・公開revisionの書換えを前提にしない。


## Phase N の初回通知読み取り証跡を追加（Phase7受入は未完了）

修正前の Phase7 head `0706488db6b89b9386f28e96f772dbcb358c6afc` / CI `37048793525` / artifact `11245339298` は、隔離基盤と Phase N DB 23件が成功し、Phase N browser が8件成功・1件失敗しました。失敗は `shared-key-home-shows-failed-notices-without-email-data` の `ASSERTION_FAILED` だけで、元の記録には goto・見出し・再試行ボタン件数のどこで失敗したかがありません。後続の管理者再試行とモバイル表示は成功しました。過去の a8b attempt1 でも同名ケースが失敗し、ソース変更のない attempt2 では成功していますが、これを原因特定や今回の受入とは扱いません。

見出しは取得成功時にも取得エラー時にも表示されます。取得成功時の見出しと行は同じ React commit で表示されるため、単純な「見出しが先、行が後」の原因は確認されていません。failed 通知の lease と retry_after は SQL で解除されるので、unknown の1分待機も今回の原因と断定できません。

今回の変更は Phase N の隔離ブラウザ fixture とこの追記だけです。画面遷移前に、実際の同一 origin・GET・`/api/natori/admin/notifications?offset=0` の初回 response を監視し、HTTP200、機密項目の不在、同じ synthetic 案件の3件の failed・再試行可能な通知を確認します。初回 response/body の待機は従来の見出し待機と同じ60秒上限で、listener・timer と途中失敗時の promise を処理します。既存の見出し60秒、再試行ボタン3件の既定待機、独立API privacy確認、後続の管理者再試行と全9件のケース名・assertionを維持します。待機時間を増やした修正や product の変更ではありません。

追加の `sharedKeyHomeReadiness` は固定 stage、HTTP status、件数、真偽値だけです。URL、鍵、token、通知ID、顧客本文、DOM、error message、response body は出力しません。元の失敗原因は未確定のまま保存し、新しい exact-head CI の結果を確認するまで Phase7 の受入を宣言しません。実メール・iPhone・Stripe 検証と Deferred の判断は既存の記録を維持します。


## Phase7 の下書き作成順・実表示検証・管理主操作のcontrastを修正（受入は未完了）

head `252cf3d166edb1f7723eb7ee015413dd36d4ca61` / CI `37052325824` / artifact `11247591214` は、全先行21report・374件が成功した後、Phase7 の架空データ作成で `DRAFT_FIXTURE` となり、専用 Next と18ケースの実ブラウザは開始していません。元の記録には DB の SQLSTATE・message がないため、実行時に `23514` が記録されたとは扱いません。

source では、架空見積り案件を `awaiting_payment`・承諾日時ありへ更新した後で revision1 の下書きを INSERT していました。既存 Phase2B の BEFORE INSERT／UPDATE guard はこの両条件で拒否します。同じ下書き INSERT を案件作成直後の `inquiry`・未承諾・未入金へ移し、下書き・合意条件・items・保存メール本文の値と、その後の quote／承諾／支払リンク作成・最終承諾済み状態を保持します。guard・migration・業務APIを変更しません。

accepted active quote の実復元後は、EstimateJourney が発行済みの要約と編集不可の表示へ落ち着きます。旧 fixture の一時的な送信前プレビュー・発行済み見出し0件という期待を、実認証による案件別 draft／structured-quote GET、保存された合意条件・明細・合計12,000円・メール本文の全値照合、revision1／editable:false、実復元version1と発行済み・編集不可の表示に置き換えます。この画面で合意全文を描画したとは主張せず、依頼者向け見積り全文の別ケースと既存重要条件assertionを維持します。戻り先caption／href、送信・新版作成の不在、横はみ出しと同じ画像採取を確認します。

管理カードの納期は実componentと同じ ja-JP の数値月日・曜日・ローカル日付構築で照合します。親の追加指示により、ProjectCard の進行／入金確認主操作の色だけを既存の共有CTAclassへ合わせ、ラベル・icon・handler・disabled意味・寸法と配置を維持します。実表示順は依頼者／状態→次作業→主操作→納期です。通常・hover・keyboard focus の実描画contrast4.5以上を、同じ所有者の実管理readerで読んだ制作中と入金待ちの2架空案件について各3幅で確認し、固定寸法／action／state・RGBA・contrast・真偽値だけの18観測を保存します。クリックによる進行・入金操作を行わず、同じ管理画面の既存画像に両カードを含めます。TASK_FIXTURE の必須項目と正当な rough stage を保持し、coherent task の実読み取りを使用します。

この追加差分は ProjectCard、Phase7 browser、管理fixtureを構築する prepare-browser、seed-fixtures、本書の5パスです。全18ケースのID・33新required PNGのID・45aggregate required PNGを維持します。source／構文／独立レビューに加え、product差分の型・lint・既存全unitをrootで実施し、新しいexact-head隔離CI・原本画像とwhole verifierで検証するまでPhase7を受け入れません。実メール・iPhone・StripeとDeferredの判断は既存の記録を維持します。

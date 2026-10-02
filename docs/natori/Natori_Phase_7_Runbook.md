# Natori Phase 7 Runbook（適用前の手順案）

この文書は原本Plan Phase 7・UX U20–23に基づく再評価台帳。過去のHEAD `a8b5efeda97b8a3e0af503fefe60b34d06ed9106` / CI37032465563では、attempt1が既存Phase N browserの8成功・1失敗で終了し、attempt2は新6B bootstrap通過後の8ケース中7成功・1失敗（`AUTOPLAY_NOT_RUNNING`）だった。修正前の照合済みHEAD `563cddf018cb335782aa915fbb6d7cc00f9b85ae` / CI37039528065 / artifact11242356951は、21 reports・374件実行で373成功・1失敗（`MANUAL_RESUME_FAILED`）、必須原本PNG12枚を確認済みだが6B未受入。失敗照合receipt SHA `21e709881dc8b53f27a66a564d65c0c1a7c20a360ddd7d932f8605900b49b4ec` を保持する。再開後の時刻進行を分割したbrowser SHA `4f5dfb49045fad5496f34e387acfb0e4bf3c4b16192f90797a09d2de14caf394` は当時の独立レビュー済み修正sourceであり、sourceレビューだけでは成功CIや6B受入を意味しなかった。実受入6BのHEAD `dc27b4387ba119cbaa73193d989dcc8cff60c594`、CI `37042404421`、strict受入receipt SHA `75f0e45f81b66c413afd866872b287cb70c9f2a0f9bc1f512a204c2ca6c4279a`、親の受入binding SHA `74de32e8ad874738e177e5ec67f4dc06da10e1e310a69e1a4085971f0f84bd16`を原本と照合した。全374件と必須原本PNG12枚が成功し、親の独立レビューによって6Bは受け入れられた。この冒頭は初回 `0706488db6b89b9386f28e96f772dbcb358c6afc` 適用前の計画を記録したものです。当時はPhase7のHEAD／CI／artifact／画像の証拠がありませんでした。現在までの070／252の失敗記録と追加差分は下の追記を参照します。Phase7の実受入と画像確認は未完了で、成功後の実受入記録はTaskとPRに保存し、検証済みheadへ紐づけます。

## 変更と採否

初回070のアプリ採用差分は EstimateJourney の `← 案件管理へ戻る` → `← ダッシュボードへ戻る` の1箇所で、href `/natori/dashboard` を維持し、専用workflowと本書を追加しました。以下の5パス一覧は初回差分の履歴です。252までのPhase N browser追記と2700の管理主操作contrast・fixture修正を含む既存PR8パスに、今回の見積り主操作とeditable fixture検証を加えたPR全体は11パスです。今回の追加差分自身は末尾に示す8パスに限定します。DB migration・業務API・公開content・合意・金銭操作の変更を含めません。

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

native7適用前のsourceレビューで、1280pxではタスクが初期展開されるため無条件clickが閉じてしまうことと、架空案件のdelivery_plan未指定が実管理readerの必須string条件を満たさないことを確認した。上記2fixtureだけを修正し、実componentの640px境界・公開条件・業務処理は変更しない。初回fixture段階は18ケース・33新required PNG・45aggregate required PNGでした。この件数は履歴で、現在の見積りeditable検証追加後の件数は下の隔離評価・末尾追記に示します。実Phase7受入は新しい隔離CIと画像確認後に記録する。

## 適用・通常commit／push・Draft PR

1. 実6B成功をwhole strict verifierで照合する。primary metadata、actual head／tested tree／base、全21report・374case、106source key／79通常source、12実PNG、owned process／compile／readiness、親の独立レビューと画像確認が揃ってから受入bindingを作る。観測HEADや準備sealを受入に代用しない。
2. 封印済み `phase7-final-resume-qualified-consumer-prepared`（manifest `59a5f8db977fb2f3f873138e27f8d173d70b4d4f86cade23a98ae032f2c901cd`、FROZEN `e659d9ca7e5eb8b4dc24979750e2a192121941a3fdbebd24cff700ff871f3949`）へ実6B bindingと承認済みwhole verifier／contract／sealを渡し、新しいmode7 generationを作る。古い準備資料を変更せず、実受入HEADのraw preimageと新規workflow／runbookの不在を確認する。caption exact blockとworkflow derivationが変わっていれば新しい差分レビューを行う。
3. 初回は実受入6Bから専用branchを作り、5パスだけをguarded applyした。後続差分はその直前の実headをbaseに、個別に認証された対象パスだけを適用する。protected source、stash、index、直接parentを確認し、型・scoped lint・既存unitの意味を保った全件検証・baseline/schema・builder/fixture/bundle/syntax・差分空白・exact source guardを実施する。検証記録はTaskに保存する。
4. 通常commit／pushし、実受入6B branchをbaseとするDraft PRを作る。強制push・本番merge・deployをしない。7 workflowは全11 Phase flag、全先行隔離gate、40分の上限、artifact命名を継承する。fontsは全builder後に1回だけ構築し、execution収集をその後に行う。

## 隔離評価・画像と最終台帳

native7は6画面×1280／360／390pxの18ケースを維持する。元の33個に、実認証のeditable見積り3段階×3幅の9個を追加し、新しい物理PNGは42個となる。Phase5・6A・6Bの既存12個と合わせて54個とする。全chainは22 report／392 caseを維持する。既存画面も主操作の色で画像byteが変わり得るため、以前のhashや画像所見を今回の確認へ代用しない。最終Phase7 source inventoryは実Git・承認済みbuilderから導出し、件数を推測しない。

| 対象 | 新PNG数 | 読み取る内容 |
|---|---:|---|
| Gallery一覧・拡大・詳細 | 9 | 作家性、作品主役、カテゴリ／件数、44px操作、Escape／フォーカス復帰。 |
| Works showcase一覧・拡大 | 6 | 営業／相談CTA増設なし、関連リンクが作品鑑賞へ混入しないこと。 |
| 申込確認・編集保持 | 6 | 本文最終行、商用／公開・金額・日付・連絡先、修正操作と保持、横はみ出し。 |
| 正式見積り全文 | 3 | 全契約条件と承諾時条件／現在期限の区別、再通知の説明。 |
| 見積り戻り先・確認 | 3 | caption／href、実認証による過去draft読取と編集不可、既存確認導線。 |
| 最新管理カード・タスク展開 | 6 | 架空依頼者、ラフと入金待ち、DBに残った次作業、実formatterの納期、進行／入金確認主操作と読み順。 |
| editable見積りの条件・金額・送信確認 | 9 | 実owner readerの同じ未承諾draft、各段階のselected手順と主操作、条件／明細／メール保持。発行・再通知・支払操作を行わない。 |

実artifactをwhole strict producerで照合し、18case・42新PNG・54aggregate required PNGの実在／raw hash、全先行report、actual source／execution、owned Next終了／IPv4 port閉鎖、compile guardを確認する。rootは42新画像を実際に開き、保持する12枚も含めた54枚の読取・はみ出し・条件欠落の所見を新しい最終台帳に残す。Nextのconfigured hostnameはlocalhost、記録されたdefault DNS解決は127.0.0.1／IPv4 family4。API owner `/api/fixture-visual-owner`とfree／closed probeはliteral127.0.0.1、browser originはlocalhost／DNS ipv4firstを維持する。このDNS／到達性記録を直接のsocket待受address観測と同一視しない。canonical `/fixture-session`はAccept-Language:ja・cookieなし・redirect:errorで、HTTP200と実Sign inフォームを確認する。初回owner、session、最終owner再確認はspawn前から同じ120秒、各要求／本文は2秒または残り時間を上限とする。sessionページの接続拒否とtimeoutだけを再試行し、nonce／PID／ancestry／期限／redirect拒否を維持する。timeout・unknownをfree扱いしない。

native7の管理固定ケースは全返信待ち状態の比較ではない。申込は確認・編集描画で送信を行わず、実POST→保存→管理reader一致の実証は受入済みPhase5を別に参照する。DB前後hashは架空projects／quotes／project_tasks／portfolio_content／estimate_draftsだけが対象で、全productionテーブル・全状態の無変更を証明したとは書かない。

## raw bytes・checkout比較の範囲

Phase6B手順書の「Git stores LF with core.autocrlf=true」は全repoへの規則として用いない。確認済みproposal raw SHAから、個別に記録された最初の3 harness RAW→Git移行だけで、レビュー済みCRLF→LFを行った。他のGit blobはCRLFを含み得る。checkoutとGitのEOL比較も認証済み実raw bytes同士のLF↔CRLF差だけに限定し、一般的な空白・BOMを正規化しない。実Git raw、source model／runtime receipt、report、artifact ZIP、PNGのhashは常に実byte列を使い、正規化しない。本書は過大な一般化の適用範囲を訂正するもので、6B既存文書や保存済み証拠を変更しない。

## 未実施・rollback・所有者判断

U20／U22／U23のDeferredは問題解消の宣言ではない。初回依頼者の架空タスクで条件の読み違い・立ち止まり・次行動の説明を観察する判断は残る。合成作品とChromium画像だけで嗜好・理解・完了率・売上・離脱改善を測定したとはしない。

実メールとiPhone Safari実機の手動受入はPhase7後に利用者とまとめて実施する。実Stripe test専用profileは未構成で、mock／隔離DB成功を実provider検証済みとしない。新規credential設定、本番DB／実顧客操作、実メール送信は含めない。

rollbackは採用したcaption・主操作class・fixture／workflow・runbook差分の個別revert。ID・URL/token・原回答・合意・quote／payment／delivery／consultation／status・公開revisionの書換えを前提にしない。


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

2700までのこの追加差分は ProjectCard、Phase7 browser、管理fixtureを構築する prepare-browser、seed-fixtures、本書の5パスでした。当時の全18ケースのID・33新required PNGのID・45aggregate required PNGを維持しました。この件数は2700段階の履歴で、以下の見積りeditable検証追加後は42新／54aggregateです。source／構文／独立レビューに加え、product差分の型・lint・既存全unitをrootで実施し、新しいexact-head隔離CI・原本画像とwhole verifierで検証するまでPhase7を受け入れません。実メール・iPhone・StripeとDeferredの判断は既存の記録を維持します。


## 見積りの選択段階と主操作のcontrast・editable実表示を追加（受入は未完了）

2700段階では管理カードの2主操作を直しましたが、EstimateJourney の選択中手順と3つの条件保存／明細保存／正式発行主操作には白文字と旧pink500が残っていました。親の追加指示により、既存の共有CTAclassをこの4箇所へ適用します。label・handler・busy／recovery／acknowledgementのdisabled gate・寸法・配置・原回答・合意条件・明細・メール本文・金額・過去snapshotを維持します。全CTAや全画面のaccessibilityが解決したとは主張しません。

管理画面の架空入金待ち案件は、quote INSERT の既存lifecycleによってnext_actionが「見積りの承諾待ち」へ更新され、その後の架空承諾UPDATEではこの値を変更していません。検証を初期seedの文言でなく、実owner readerが返すDBの保存値へ合わせます。実案件のnext_actionや状態を更新する修正ではありません。

editable見積りは実所有者の未承諾・未入金の架空案件とrevision1の保存済み条件・明細を使用します。この新規fixtureのmail_draftはnullで、送信確認へ進んだ時に実componentが生成する未送信のメール下書きを確認します。過去案件の保存済みメールと同じ値だとは扱いません。実componentのdirty=falseによる前進を使い、条件保存→金額→送信確認へ移動し、発行をクリックしません。通常・hover・keyboard focusの実描画contrast4.5以上を、選択中手順3箇所と主操作3箇所×3状態×3幅の54観測で確認します。既存管理2主操作の18観測も別に保持します。固定幅・action／state・色／contrast・真偽値だけを記録し、機密値や任意DOMを出力しません。実隔離DBの確認対象の前後hashと禁止業務requestの検出を保持します。

今回の対象は EstimateJourney、Phase7 browser、prepare-browser、seed-fixtures、visual-server、collect-execution、Phase T run.sh、本書の8パスです。元の18case ID・33新PNG IDを保持し、editable各段階の9枚を追加して42新／54aggregateとなります。rootの型・scoped lint・全1586unit・baseline／schema／fixture／bundle／構文／exact source確認と、新しいexact-head隔離CI・全画像・whole verifierの確認を経て受入を記録します。実head2700／CI37060090142／artifact11251031386は18ケース中15成功・管理カード3幅がtoContainText／ASSERTION_FAILEDとなりました。managementContrastは空で、管理required画像6枚は欠落しています。実360pxのfailed-current原本画像にはDBの保存値「見積りの承諾待ち」が表示され、quote lifecycle／readerのsourceと一致しています。これは失敗時の補助画像で、required画像や成功受入には代用しません。さらに同artifactのexecution記録はtracked_source_dirty:trueで、579 copied source hashの一致だけではこのflagを無視できません。旧2700の実変更pathは記録されておらず、当時の原因は未確定です。whole verifierはallow-failure時もdirty:trueを拒否する既存判定を維持します。Nextの実owner readinessとowned cleanupは成功し、browserexit1、compileErrorsなしでした。これらの部分証拠から全392件やPhase7受入を宣言しません。実メール・iPhone・StripeとDeferred判断は従来の範囲を維持します。


固定されたSupabase CLI v2.118.0の公式sourceは、`--version`で更新確認を実行し、supabaseディレクトリがあれば`supabase/.temp/cli-latest`へ書き込む経路を持ちます。これは2700のdirty flagのsourceから支持される候補で、過去の実cache変更を確認したとは扱いません。[公式CLI root.go](https://github.com/supabase/cli/blob/v2.118.0/apps/cli-go/cmd/root.go)と[utils misc.go](https://github.com/supabase/cli/blob/v2.118.0/apps/cli-go/internal/utils/misc.go)のraw byteとGit blob identityを照合しています。Phase T runnerで、最初のversion確認より前に既存telemetry停止設定と`SUPABASE_NO_UPDATE_NOTIFIER=1`をexportします。固定versionとbinary digest、以降の隔離処理は保持します。cacheを削除・上書きする修正ではありません。

collectorは元のtracked_source_dirty算出を保持し、既存checksumと固定public source pathだけについて、NUL区切りGit status・mode・raw SHAのbounded診断を追加します。その他のpathは名称・内容を出さずredacted件数にし、`.temp`はmetadata用cli-latestだけを許可します。最大64行・16 file inspectionで、Git／worktreeのraw byteを正規化しません。dirty時はowned結果directoryへ公開可能なreceiptを保存した後、固定codeでfail-fastします。次の受入ではdirty:falseと観測済み診断の件数0・entries空・redacted0・omitted0を確認します。今回の対処によって元flagをfalseへ置き換えたとは扱いません。

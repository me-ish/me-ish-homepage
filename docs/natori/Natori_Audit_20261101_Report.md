# ナトリ 横断監査レポート（2026-11-01）

> このファイルは 2026-11-01 の横断監査レポートの原本です。`shots/` のスクリーンショットは監査セッションの一時領域にあり、ここには含まれていません。どこまで対応済みかは `Natori_Audit_20261101_Handoff.md` を見てください。

対象: me-ish/me-ish-homepage main（3983bfe, PR #224 まで）。公開側 /natori/portfolio, /contact, /consult, /quote, /delivery, /links, /legal、管理側 /natori/dashboard 配下と /api/natori/*、middleware、Supabase migrations、docs/、PR #168〜#225。

## 前提と確認できなかったこと

- 本番 https://www.me-ish.art はこのセッションのネットワーク制限（プロキシが 403）で直接は開けません。代わりに Vercel 連携経由で本番の HTML（/natori/portfolio, /contact, /links, /works/NatoriArt001）と CSS を取得し、ローカルで描画して PC 幅と iPhone 幅を確認しました（shots/prod-*.png）。作品画像と Web フォント（Zen Maru Gothic）は取得できないため、画像は淡いピンクの枠、書体は代替ゴシックです。
- 本番デプロイ（dpl_2JGdd6UCMXex8xWVkHWPBV2pJinQ）は main の 3983bfe（#224）と一致しています。最初に見たデモページは同じコードですが、受付フォームがデモだけ旧版になるため、その点は下で訂正しています。
- 画像込みの実物スクリーンショットが必要なら、環境の Network access で `www.me-ish.art` と `lvnfspyainrxtztjytbo.supabase.co` を Allowed domains に追加してください。
- 管理画面はコード読解のみです。依頼者データを読まない方針なので、本番ログインは求めていません。
- 環境変数の値は読んでいません。フラグに依存する指摘は「本番で〜なら」と書き、確認方法を添えています。
- 既知の前提（旧方式決済で返金追跡不可、共有鍵／パスキー、匿名化ジョブ、トークからの見積・納品送信、AIアシスタント #203）は再提案する場合に明記しています。

## 指摘一覧（優先度順）

### 高

**1. 相談リンクの再発行メールが、現行の本番設定では必ず失敗する（依頼者が自力で復帰できない）**
- どこ: `src/features/natori/server/consultationService.ts` renewClientConsultationLink（`assertCaseSystemAdmission("legacy-sender")`）、`src/features/natori/server/caseSystemHold.ts` 49行（legacy-sender は `NATORI_CASE_RELEASE_ENABLED=1` で常に CaseSystemHeld）。同じ経路: `paymentLinkExpiryService.ts` 120行（`NATORI_CASE_BOOTSTRAP_PHASE` が managed でないとき）、`deliveryCompletionMailService.ts` 78行（outbox 無効時のみ）。
- 何が問題か: 案件ワークスペースが本番で動いている（README・PR #208〜#224）＝ release フラグが 1 のはず。その状態では、期限切れ相談ページの「新しいリンクをメールで受け取る」が、新トークンの INSERT と renewed_at の更新を終えた後にメール送信で止まり、依頼者には「メールを送れませんでした」、再試行は 10 分ロックされます。支払いリンクの期限停止 cron も managed でなければ同じ門で失敗し、期限切れリンクが有効なまま残り得ます。
- なぜ大事か: 相談リンク（30日）が切れた依頼者の唯一の復帰手段で、ここが死ぬと相談が途切れ、ナトリへメールで頼むしかなくなります。cron 側は「支払期限 7 日」の約束が守れません。
- 直し方の案: 相談返信と同じ通知ジョブ経路（sealDeliveryNotification → natori_notification_jobs → dispatchAcceptanceNotification）に載せ替える。順序も「送れる見込みの確認 → DB 書込」に直す。cron は current flow 用の claim（natori_case_current_expiry_v1）を managed でない場合にも使うか、"sender" 種別で admission を取る。
- 優先度: 高
- 確認方法: コードは上記 3 箇所。公開ページ: 期限切れの /natori/consult/<token> を開いてボタンを押す。Vercel ログで `[natori-consultation] renewal email failed` と `[natori-payment-expiry] Stripe deactivation failed` を検索。

**2. 「受け取りました」が押されないまま期限切れになった納品を完了にできない（#225 の「30日でみなし完了」と仕組みが矛盾）**
- どこ: DB 側 PAY-01 ガード（`docs/natori/Natori_Audit_PAY01_Checkpoint.md`: release acceptance の無い completion を拒否）、`src/features/natori/lib/caseSteps.ts`（受取は delivery_accepted_at のみ）、`src/features/natori/lib/results.ts` 61行（実績は completed のみ集計）、`src/features/natori/lib/caseWorkspacePresentation.ts` の delivery_access_expired、PR #225 の F。
- 何が問題か: 依頼者が受取ボタンを押さず 30 日過ぎると、案件は delivered のまま永久に「納品ページの期限切れ。延長するか決める」が残り、実績ページにも売上として載りません。管理側に「受取済みとみなして完了」する操作が無く、#225 の文面だけが先行します。
- なぜ大事か: 売上集計と規約の整合。依頼者の多くはダウンロードしてボタンを押さないので、常態化します。
- 直し方の案: 管理画面の「制作・納品」段に「期限切れを受取済みとみなして完了にする」を追加し、新 RPC（release が存在・expires 経過・未受取を条件に completed_at と操作者・理由を記録）で PAY-01 の意図を保つ。または日次 cron で自動完了。#225 の F はこの実装後にマージ。
- 優先度: 高
- 確認方法: 管理画面で「納品済み・期限切れ・未受取」の案件を開き、次にやることに延長しか出ないこと。

**3. 【訂正】本番の受付フォームは構造化版（V2）が有効。旧フォームはデモと CI だけに残り、本番と別物になっている**
- 当初「本番が旧フォーム」と書きましたが誤りでした。本番 HTML には V2 の radio（まず相談したい／見積もりを希望）、4 行の内容欄、折りたたみの「詳しい条件を追加する」があり、`NATORI_PUBLIC_INTAKE_V2` は本番で有効です。
- どこ: `src/app/[locale]/etorie/demo/app/portfolio/contact/page.tsx`（`?structured=1` が無いと旧版）、`PortfolioCommissionForm.tsx` の旧フォーム本体（本番では到達不能）。
- 何が問題か: デモ・e2e・採点で見ている受付と本番の受付が違い、今回のように誤判定の元になります。旧フォームのコード（約 500 行）も本番で使われていません。
- 直し方の案: デモの既定を構造化版にし、旧フォームは削除（指摘 10 の整理に含める）。
- 優先度: 低
- 確認方法: 本番 /natori/portfolio/contact の 1 画面目に「ご希望」の radio が出ること（shots/prod-contact-mobile.png）。

**3b. 相談フォームの冒頭に「つなぐからのご依頼も受付中です」が自社フォームより上に出る**
- どこ: `PortfolioCommissionForm.tsx`（tsunaguLink が commissionOpen のとき見出し直下に表示）。本番で確認。
- 何が問題か: 相談ページを開いた瞬間、最初のリンクが外部プラットフォームへの導線になっています。手数料のかかる外部へ送る導線が、自社の入口のいちばん目立つ位置にあります。
- 直し方の案: フッターか「ご依頼前にご確認ください」へ移し、相談ページの 1 画面目は自社フォームだけにする。意図的に併記するなら、フォームの下に小さく。
- 優先度: 中（売れる導線）
- 確認方法: 本番 /natori/portfolio/contact をスマホで開く。

**3c. 「制作過程」の縦長動画が作品と料金の間で画面 1 つ分を占め、スマホで料金まで遠い**
- どこ: `PortfolioLanding.tsx` の配置（Gallery → ProcessVideo → Pricing）、`PortfolioProcessVideo.tsx`（9:16 の枠）。
- 何が問題か: 本番ではスマホで動画枠が約 1 画面分あり、作品を見た人が料金に着くまでに長いスクロールが挟まります。PC でも中央に大きな縦長ブロックが 1 つ置かれ、作品と料金の流れが途切れます。
- 直し方の案: 動画を「制作の流れ」の 4〜5 番の横に小さく置く、または料金の後へ移す。自動再生なしのサムネ＋再生ボタンのまま、スマホは幅の 60% 程度に。
- 優先度: 中（売れる導線）
- 確認方法: 本番 /natori/portfolio をスマホでスクロール（shots/prod-portfolio-mobile.png）。

**3d. ページ移動中の読み込み表示が旧ブランド色の青いスピナー**
- どこ: `src/app/loading.tsx`（`text-[#00a1e9]` の Loader2）。ナトリ配下に loading.tsx が無いため、ポートフォリオ→相談フォームなどの遷移でこれが出ます。本番の RSC にも含まれています。
- 何が問題か: 淡いピンクの世界の途中で me-ish 旧ブランドの青が一瞬出ます。
- 直し方の案: `src/app/[locale]/natori/loading.tsx` を追加し、ピンク 1 色の小さなスピナーか、何も出さない（null）にする。
- 優先度: 低
- 確認方法: 本番でポートフォリオの「相談・見積もり」を押した直後の表示。

**3e. 料金カード「胸上」に作例が無く「作例は準備中です」の空枠が出る**
- どこ: `PortfolioPricing.tsx`（hasPlanSamples が true のとき作例の無いプランにプレースホルダー）、本番の掲載内容。
- 直し方の案: 編集画面で胸上の作例を 1 枚選ぶ。選べない間はプレースホルダーを出さず高さだけ揃える。
- 優先度: 低（内容）
- 確認方法: 本番 /natori/portfolio#pricing を PC 幅で見る。

### 中

**4. Content-Security-Policy が無い（トークン URL 前提のページの最後の防壁）**
- どこ: `next.config.mjs` headers()（X-Frame-Options / HSTS / nosniff / Referrer-Policy はある）。
- 何が問題か: /natori/consult|quote|delivery/<token> はトークンが URL にあるため、XSS 1 件でトークンと署名 URL が流出します。react-markdown は rehype-sanitize 済みですが多層防御がありません。
- 直し方の案: middleware で Report-Only から導入: `default-src 'self'; img-src 'self' data: blob: https://<supabase-host>; media-src 同; frame-src https://www.youtube-nocookie.com; connect-src 'self' https://<supabase-host>; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com`。違反ログを見てから enforce。
- 優先度: 中
- 確認方法: `curl -I https://www.me-ish.art/natori/portfolio` の応答ヘッダー。

**5. レート制限が関数インスタンス内メモリ（Vercel では実効上限が緩む）**
- どこ: `src/lib/rateLimit.ts`（InMemoryRateLimitStore、コメントで限界を明記）。利用: 受付 3/10分、承諾・受取 10/10分、track 60/10分、通知再試行。
- 何が問題か: インスタンスごとに別カウント、コールドスタートで消える。受付スパム → Resend 送信と案件の自動起票が無制限に近い。
- 直し方の案: setRateLimitStore で Upstash Redis（固定窓 INCR/EXPIRE）へ。受付はメールアドレス単位の上限も追加。
- 優先度: 中
- 確認方法: コード。

**6. 共有鍵 Cookie をこのブラウザから消す手段が無い／鍵を URL クエリで渡す（保留中のパスキー移行とは別の最小対応）**
- どこ: `src/middleware.ts`（`?natori-key=` → 8 時間 Cookie）、`src/features/natori/server/requireNatoriAdmin.ts`、`CaseWorkspaceUtilities.tsx` のログアウト（Supabase の signOut のみ。Cookie 削除の経路は grep で見当たらず）。
- 何が問題か: 共用端末で「ログアウト」しても 8 時間は管理画面が開けます。鍵は URL に乗るため履歴・アクセスログに残ります（コードのコメントどおり）。
- 直し方の案: (1) 共有鍵 Cookie を削除する POST /api/natori/admin/logout と「このブラウザから出る」ボタン、(2) 鍵入力は /admin-login の POST フォームにして URL から外す、(3) 鍵ローテーション手順を docs に。パスキー移行は保留のままで良い。
- 優先度: 中
- 確認方法: コード。

**7. 旧 `/natori/works/[slug]` が別ブランドの姿で公開され続けている**
- どこ: `src/app/[locale]/natori/works/[slug]/page.tsx`、`src/features/natori/constants/works.ts`（静的 19 件）、`src/features/natori/components/Footer.tsx`。
- 何が問題か: 青基調（#00a1e9）の旧デザイン、「VGen で依頼」「直接相談する（mailto:hello@me-ish.art）」、noindex なし、作品データは DB の掲載内容と二重管理。特商法表記の連絡先（info@me-ish.art）とも不一致。
- なぜ大事か: 検索から入った人に旧サイトが見え、正規の相談導線へ戻れません。
- 直し方の案: 308 で /natori/portfolio へ転送し、page と works.ts、Footer.tsx を削除（cleanup-index に記録）。
- 優先度: 中
- 確認方法: 公開ページ https://www.me-ish.art/natori/works/NatoriArt001。

**8. 依頼者向けトーク画面の進み具合に「制作中」が無く、入金後〜納品まで止まって見える**
- どこ: `src/features/natori/lib/talkTimeline.ts` steps（見積もり承認 / お支払い / 納品）。
- 何が問題か: 通常約 1 か月の制作期間中、上部の 3 段は「納品」が現在地のまま動かず、ラフに OK しても段が進みません（ラフはカードとして出るだけ）。
- 直し方の案: 「制作中」段を追加し、facts.roughs（ラフ到着・OK）と delivery.exists で done を判定。表示は「ラフ確認 → 仕上げ中 → 納品」の 3 段でも可。
- 優先度: 中
- 確認方法: 入金済み案件の /natori/consult/<token> 上部。

**9. 管理画面（案件ワークスペース）の見た目が 3 系統混在で、Apple 風の統一感が部分的**
- どこ: `constants/workspaceLook.ts`（iOS 風）と `constants/adminUi.ts`（zinc＋ピンク）、`CaseWorkspaceSections.tsx`（look）、`CaseWorkPanel.tsx`（独自 card）、`CasePaymentPanel.tsx`（独自 `bg-pink-700` ボタン、rounded-xl）、`CaseIntakePanel.tsx`（zinc 枠）。
- 何が問題か: 同じ案件画面内で角丸・枠線・ボタン色（#BE185D と pink-700、丸と角丸）が違い、どれが主ボタンか一目で分かりません。
- 直し方の案: workspaceLook に primary/secondary ボタンと card/row を定義し、各パネルの独自クラスを置換。adminUi は旧ページ専用に残す。
- 優先度: 中
- 確認方法: 案件を開き「見積・支払い」と「制作・納品」を見比べる。

**10. 到達不能な旧経路と 38 種のフラグが残り、本番の組み合わせがコードから読めない**
- どこ: `NatoriDashboardLegacy` / `ProjectsBoard` / `InquiriesBoard` / `EstimateWorkspace`（約 3,000 行、mode off 時のみ）、`orderMailService.sendNatoriOrderMail` の payment/rough 経路、`portfolioContactService.ts`（呼び出し元なし）、`requireNatoriAdmin()`（呼び出し元なし）、`process.env.NATORI_*` 38 種。
- なぜ大事か: 指摘 1 のように「旧経路に残った依頼者向け機能」が静かに壊れる土壌。変更時の回帰リスクと監査コストが高い。
- 直し方の案: docs に「本番フラグ表（名前と on/off のみ、値は書かない）」を 1 枚作り、到達不能な経路を 1 PR ずつ削除。CLAUDE.md の「旧コードに機能を足さない」をナトリ内の旧経路にも適用。
- 優先度: 中
- 確認方法: `grep -rhoE "process\.env\.NATORI_[A-Z0-9_]+" src | sort -u`。

**11. 法務文面と機能の差（PR #225 マージ前に）**
- どこ: `src/app/[locale]/natori/legal/tokushoho/page.tsx`「納品方法」（再送しても期限は延長されません）vs PAY-04 の延長再送（`deliveryReleaseService.extendReadyDelivery`）。#225 の F は指摘 2 と矛盾。
- 直し方の案: 「保存期限はご相談により延長する場合があります」に揃え、F は指摘 2 の実装後に入れる。
- 優先度: 中
- 確認方法: 公開ページ /natori/legal/tokushoho と PR #225 差分。

**12. 公開ポートフォリオが「きれいな LP テンプレ」に見える（手描きの柔らかさが装飾の一部にしか出ていない）**
- どこ: `PortfolioStyles.tsx`（WORKS / PRICE / FLOW / PROFILE / FAQ の英字小見出し）、`PortfolioPricing.tsx`（白カード 4 枚＋枠線ボタン）、`PortfolioWorkflow.tsx`（番号丸の縦タイムライン）、`PortfolioGuidelines.tsx` / `PortfolioFaq.tsx`（白カード＋影の反復）。
- 何が問題か: 英字トラッキング見出し、白い角丸カード＋影、番号付きタイムラインは SaaS LP の定型で、作品より UI が前に出ます（PC スクショでは料金カード群が作品 1 枚より大きい）。手描き要素はマスキングテープと丸ゴシック、✧ の 3 点だけ。
- 直し方の案: 下の「見た目の抜本改善」参照。
- 優先度: 中（魅せ方）
- 確認方法: 公開ページ /natori/portfolio を PC 幅で通して見る。

**13. ギャラリーの先頭 1 枚だけ巨大化し、横長作品で段が崩れる**
- どこ: `PortfolioGallery.tsx` PortfolioWorkCard（pickup: `lg:col-span-4 lg:row-span-2`、landscape: `col-span-2`）、`PortfolioStyles.tsx`（3:4 枠に contain 上書き）。
- 何が問題か: PC で先頭だけ他の 4 倍の面積、横長作品は 2 列分で段がずれ、3:4 枠に contain で左右に余白が出ます。
- 直し方の案: 原寸比のメイソンリー（CSS columns または grid-auto-flow: dense ＋ aspect-ratio）にし、ピックアップは編集画面で指定した 1〜2 枚だけ。
- 優先度: 中
- 確認方法: 公開ページ #gallery。

### 低

**14. 1 画面目の目安が「SDキャラ 3,000円〜」で、何の数字か伝わりにくい**（`lib/portfolioHeroFacts.ts`。ラベルを「料金の目安」、値を「3,000円〜（SDキャラ）」に。公開ページ hero）

**15. 受付完了画面の「公開連絡先（X）」が出ない**（`PortfolioCommissionForm.tsx` 338行が `label === "X"` で判定。既定ラベルは "X (Twitter)"。`isPortfolioXLink` を使う。公開ページで送信後に確認）

**16. 相談ページ GET にレート制限が無く、開くたびに添付全件の署名 URL を発行する**（`consultationService.getMessages`。トークン保持者だけだが Storage 呼び出しの増幅になる。IP 上限と署名 URL の遅延生成。コード）

**17. 見積承諾・受取 API に同一オリジン検査が無い**（`checkSameOrigin` は受付のみ。多層防御として `quote/accept` `delivery/accept` にも追加。コード）

**18. track API が bot で膨らむ**（60/10分 × インスタンス数で natori_page_events に INSERT、集計は 5,000 行で打ち切り。日次で 90 日より古い行を削除する cron。コード）

**19. /natori/links と /admin-login の見た目が別世界**（`LinksLanding.tsx` は濃いピンクグラデーション＋紫のぼかし、`AdminLoginClient.tsx` は青ボタンの旧スタイル。公開ページの白地・淡色に揃える。公開ページ /natori/links）

**20. admin_emails のキャッシュが 5 分**（`src/lib/isAdmin.ts`。権限剥奪が最大 5 分遅れる。許容範囲だが docs に明記。コード）

**21. トークン 3 ページ（相談・見積・納品）の実機 e2e が無い**（e2e はデモ受付のみ。Supabase ブランチで fixture を作り、承諾 → 入金 webhook → 納品 → 受取を 1 本通す。`e2e/`）

**22. フォーム直前の「つなぐからのご依頼も受付中です」**（`PortfolioCommissionForm.tsx`。自サイトの入口で外部プラットフォームへ流す導線。意図的なら残す、そうでなければフッターへ。公開ページ）

**23. 旧方式決済の返金追跡**（既知・再提案ではない）。現状の `financialReview` は unsupported を警告扱いにしない（#223）ので、管理画面としては整合しています。

**問題なしと確認できた点（参考）**: トークンは 32 バイト乱数・SHA-256 のみ保存・GET 無副作用・no-referrer・解析除外（`analyticsPrivacy.ts`）。全 natori テーブルで RLS 有効、anon/authenticated へ REVOKE 済み、公開は portfolio/links の読み取りのみ。管理 API は `withNatoriManagement` ＋ CSRF ヘッダー＋ 緊急停止の admission。Stripe は署名検証・冪等キー・金額/見積 ID 照合・重複入金通知。Resend webhook も署名検証。受付はサイズ上限・MIME 再検証・WebP 変換・ハニーポット・操作 ID による再送安全。画像最適化経路への private 画像の持ち込み拒否（middleware）。

## 見た目の抜本改善の方向（提案）

目標は「作品が主役で、UI は画用紙と文房具」。今の構造（セクション順・DB 掲載内容・フォーム契約）は変えず、見せ方だけを入れ替える案です。

1. **1 画面目は作品だけ**。スライダーを画面幅いっぱいの 1 枚に（PC は左 60% を作品、右に屋号・一言・ボタン 2 つ）。料金・返事・納期の目安は作品の下に手書き風の付箋 1 枚で添える。
2. **ギャラリーは「貼った写真」ではなく「並べた原画」**。カードの白枠・影・テープを外し、原寸比のメイソンリーで画像だけを並べ、ホバー／タップで作品名を出す。テープはピックアップ 1 枚だけに残す。
3. **英字小見出しを全廃**し、日本語見出しの下にマーカーで引いた 1 本線（SVG、ピンク）だけにする。見出しごとの ✧ などの絵文字飾りも 1 箇所に絞る。
4. **料金は「お品書き」1 枚**。4 枚のカードではなく、作例サムネ付きの縦 1 列の表（SD / 胸上 / 膝〜腰上 / 全身）にし、行の右端に小さな「相談」リンク。量産とオプションはその下に折りたたみのまま。
5. **制作の流れは 5 コマ**。番号丸の縦タイムラインをやめ、横スクロールの小さな手描きアイコン＋ 1 行説明に（アイコンはナトリ本人の線画を使うと一気に「本人のサイト」になる）。
6. **色の役割を固定**。ピンク #EC4899 は主ボタンと現在地だけ。水色とオレンジは「罫線・付箋・マーカー」にしか使わない。背景は真っ白ではなく薄いクリームに軽い紙目テクスチャ（数 KB の SVG ノイズ）。
7. **カードの影を全部やめ、代わりに 1px の手描き風の枠（SVG filter の turbulence で線を少し揺らす）**を 1 種類だけ用意して共通化する。
8. **受付フォームは V2 を有効化**し、1 画面 1 問のステップにする（指摘 3）。
9. **管理画面は workspaceLook に一本化**。ボタンは主（ピンク塗り）と副（白）だけ、角丸は 2 種類、各パネルの独自色を廃止（指摘 9）。

## 上位 5 件の要約（本番確認後）

1. **相談リンク再発行と期限停止 cron が legacy-sender 封鎖で失敗する**（高）: 通知ジョブ経路へ載せ替え。まず本番で再発行ボタンを押して確認。
2. **期限切れ納品を完了にできず、#225 の「みなし完了」と矛盾**（高）: 管理側に「受取済みとみなして完了」操作と新 RPC。#225 の F は後回し。
3. **売れる導線の 2 点: 相談ページ冒頭の「つなぐ」リンクと、作品と料金の間の縦長動画**（中）: つなぐは下へ、動画は流れの横か料金の後へ。
4. **CSP 無し、インメモリのレート制限、共有鍵 Cookie が消せない**（中）: Report-Only CSP、Upstash への差し替え、ログアウトで Cookie 削除。
5. **見た目のテンプレ感と管理画面の 3 系統混在、旧 works ページ**（中）: 作品主役のメイソンリー、英字小見出し廃止、お品書き型料金、管理は workspaceLook に統一、旧ページは転送して削除。

# ナトリ 監査 2026-11-01 の残り改善 引継ぎ書

監査レポートの原本は `Natori_Audit_20261101_Report.md`。このファイルは「何が終わっていて、何が残っていて、どう進めるか」だけをまとめたもの。実装は 1 件ずつ別セッション（Opus）に頼む前提で書いている。

## 1. 今日までに終わったこと（main に入っている）

| PR | 内容 | 監査の番号 |
|---|---|---|
| #226 | 公開ポートフォリオの見た目刷新（英字小見出し廃止、画用紙色の背景、手描き枠、お品書き型の料金、流れの線）。管理画面の部品を `workspaceLook` に統一。旧 `/natori/works/[slug]` を `/natori/portfolio` へ転送して削除 | 7, 9, 12（13 以外） |
| #227 | 「つなぐ」リンクをフォーム下へ。ナトリ配下の読み込み表示を無し（青スピナー廃止）。`Content-Security-Policy-Report-Only` を配布。Upstash Redis のレート制限ストア（env があるときだけ有効）。共有鍵 Cookie を消すログアウト API | 3b, 3d, 4（Report-Only まで）, 5（コードまで）, 6 の (1) |
| #228 | 主ボタンを「貼った紙」ボタンに統一（1 画面目・スマホ固定・本文・ギャラリー・フォーム送信） | （見た目の追加対応） |

作家が決めたこと（蒸し返さない）:
- 制作過程の動画の位置と大きさは変えない（監査 3c は却下）。
- ボタンにこれ以上のアニメーションは付けない。
- 絵に貼るマスキングテープは全部の絵に残す。
- 画面上部ナビの小さい「相談・見積もり」は楕円のまま。

## 2. 残っている改善点

状態の凡例: **未着手** / **一部済み** / **要判断**（作家の判断や本番情報が先に要る）

### 高（仕組み。先にやる）

| # | 内容 | 状態 | 先に必要なこと |
|---|---|---|---|
| 1 | 相談リンクの再発行メールと支払い期限 cron が `legacy-sender` の門で止まる | 要判断 → 未着手 | 本番に `NATORI_CASE_RELEASE_ENABLED` と `NATORI_CASE_BOOTSTRAP_PHASE` が**設定されているか**（名前だけ。値は不要）。設定されているなら確実に壊れているので最優先 |
| 2 | 受取ボタンが押されないまま 30 日過ぎた納品を「受取済みとみなして完了」にできない | **済み（PR #232、2026-11-01）**: 新 RPC `natori_case_complete_v1`（external / deemed）と管理画面「制作」の「完了にする」「受け取り済みとみなして完了にする」。本番 DB へのマイグレーション適用は作家の作業 | 残りは 11（法務文面）と PR #225 の F の取り込みだけ |
| 11 | 特商法「再送しても期限は延長されません」が延長再送機能（PAY-04）と矛盾。#225 の F が 2 と矛盾 | 未着手 | 2 の方針。#225 は open のまま |

### 中

| # | 内容 | 状態 | 先に必要なこと |
|---|---|---|---|
| 4 | CSP を Report-Only から enforce へ | 一部済み | 本番で 1〜2 週間、ブラウザのコンソールに違反が出ないことの確認（Vercel ログには出ない。作家が本番を開いて DevTools の Console を見る） |
| 5 | レート制限を全インスタンス共通にする | 一部済み（コード済み） | Vercel に `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` を設定（Upstash の無料枠で可）。加えて受付にメールアドレス単位の上限を足す |
| 6 | 共有鍵を URL クエリで渡している。鍵のローテーション手順が無い | 一部済み（ログアウトのみ済み） | パスキー移行は保留のまま。鍵入力を `/admin-login` の POST フォームに変えるだけ |
| 8 | 依頼者向けトークの進み具合に「制作中」が無い | 未着手 | 段の名前（例: ラフ確認 → 仕上げ中 → 納品）を作家が選ぶ |
| 10 | 到達不能な旧経路（約 3,000 行）と 38 種のフラグ | 未着手 | 本番フラグ表（名前と on/off だけ）を作家が渡す |
| 3 | デモ受付の既定が旧フォームで本番（V2）と違う。旧フォーム本体（約 500 行）が本番で未使用 | 未着手 | 10 と同じ PR 群で |
| 13 | ギャラリーの先頭 1 枚だけ巨大化、横長作品で段が崩れる | 未着手 | 見た目なので案を 2〜3 個出して選ぶ（§4 参照） |
| 3e | 料金「胸上」の作例が無く空枠 | 要判断（作家の作業） | 編集画面で胸上の作例を 1 枚選ぶ。選べない間は空枠を出さない小修正だけコードでやる |

### 低（まとめて 1〜2 PR でよい）

| # | 内容 |
|---|---|
| 14 | 1 画面目の目安「SDキャラ 3,000円〜」をラベル「料金の目安」、値「3,000円〜（SDキャラ）」に |
| 15 | 受付完了画面の「公開連絡先（X）」が出ない（`label === "X"` 判定。既定ラベルは "X (Twitter)"） |
| 16 | 相談ページ GET にレート制限が無く、開くたびに添付全件の署名 URL を発行 |
| 17 | 見積承諾・受取 API に同一オリジン検査が無い |
| 18 | `natori_page_events` が bot で膨らむ。90 日より古い行を日次で削除 |
| 19 | `/natori/links` と `/admin-login` の見た目が別世界 |
| 20 | `admin_emails` キャッシュ 5 分を docs に明記（コード変更なし） |
| 21 | トークン 3 ページ（相談・見積・納品）の実機 e2e が無い |

## 3. 進め方

### 順番（おすすめ）

1. **1 → 11** の順で仕組みを直す（依頼者が困る順）。1 は本番で壊れている可能性が高い。2 は PR #232 で済み。
2. **5 の env 設定**（コード変更なし、Vercel の設定だけ）と **4 の違反確認**は並行して作家がやる。
3. **8 / 14 / 15 / 17** は小さいので間に挟む。
4. **10 + 3** は「削る」PR 群。1 PR で 1 経路ずつ。先にフラグ表が要る。
5. **13 / 19** は見た目。案を見てから。
6. **16 / 18 / 21** は余裕があるとき。

### 1 件 1 PR の型

- ブランチ名: `claude/natori-<短い英語>`（例: `claude/natori-renew-link-notice`）。
- PR 本文: 目的 / 変更 / 確認（何を手で見たか）。日本語。
- CI は PR ごとに約 17 分（Phase 7 の画面キャプチャが最長）。全部で 21〜24 件。**全部緑になってから** squash マージ。
- マージすると本番は Vercel の自動デプロイで切り替わる。本番 DB のマイグレーションは自動では当たらない（§3 の「マイグレーション」）。

### CI で引っかかりやすい所

- **source-string テスト**: `src/features/natori/constants/__tests__/portfolioDesignTokens.test.ts` などは「ソースにこの class 文字列が含まれる」で pin している。見た目を変えたらこのテストも同じ PR で直す（テストを消すのではなく、新しい方針に合わせる）。
- **Phase 7（`scripts/natori-phase-7/browser.mjs`）**: 画面キャプチャを撮りながら「カードの飾り」「閉じるボタン 44px」「管理画面のボタン色 `#BE185D` / hover `#9D174D`」「コントラスト 4.5 以上」などを検査する。失敗すると `VISUAL_BROWSER_FAILED` としか出ない（raw ログは出さない設計）。原因は `browser.mjs` の `check(...)` を読んで当たりを付ける。
- **Phase 6B（`scripts/natori-phase-6b/browser.mjs`）**: 1 画面目とスマホ固定の「相談・見積もり」を `getByRole('link', { name: '相談・見積もり', exact: true })` で探す。**ボタンの読み上げ名を変えない**（飾りは `aria-hidden`）。スマホ固定ボタンは `a.fixed` で探すので `fixed` class を残す。
- 管理画面の主ボタン色は Phase 7 が固定値で見るので、`natoriPrimaryAction` の色は変えない。

### ローカルで見た目を確かめる方法（Vercel のプレビューは使わない）

Vercel のプロジェクトルール「Audit 162-166 block legacy Natori hosts」が preview ホストを 403 にする。ルールを触らず、ローカルで描画する:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next dev -p 3100
# 別シェルで
node -e "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--headless']});const p=await (await b.newContext({viewport:{width:390,height:844},isMobile:true})).newPage();await p.goto('http://localhost:3100/etorie/demo/app/portfolio',{waitUntil:'networkidle'});await p.screenshot({path:'shot.png',fullPage:true});await b.close();})()"
```

- `/etorie/demo/app/portfolio` がポートフォリオのデモ。`/etorie/demo/app/portfolio/contact?structured=1` が本番と同じ V2 の受付。
- デモの作品には画像が無い（ボタンが disabled）。モーダルの確認はできないので、そこは CI の Phase 7 に任せる。
- 本番の実物を見るには、セッションの Network access に `www.me-ish.art` を許可する。

### マイグレーションが要る変更（2・16・18）

- `supabase/migrations/` に `YYYYMMDDHHMMSS_natori_<内容>.sql` を足し、`docs/supabase-tables-ja.md` を `npm run docs:supabase` で作り直す。
- 本番への適用は作家が Supabase で行う（Claude は本番 DB を触らない）。PR 本文に「本番に当てる SQL」と「当てる順番（コードより先か後か）」を書く。
- PAY-01（`Natori_Audit_PAY01_Checkpoint.md`）の意図「release acceptance の無い completion を DB で拒否」を壊さない。新しい完了経路は新 RPC で条件を明示する。

## 4. 各項目の実装メモ

### 1. 相談リンク再発行と期限 cron（高）

- どこ: `src/features/natori/server/consultationService.ts` `renewClientConsultationLink`（218 行で `assertCaseSystemAdmission("legacy-sender")`）。`src/features/natori/server/caseSystemHold.ts` 49 行（`legacy-sender` は `NATORI_CASE_RELEASE_ENABLED=1` で常に拒否）。`src/features/natori/server/paymentLinkExpiryService.ts` 119〜120 行（`NATORI_CASE_BOOTSTRAP_PHASE` が managed でないと同じ門）。`vercel.json` の cron `/api/cron/natori-payment-expiry`（毎日 0:20 UTC）。
- 直し方: 相談返信と同じ**通知ジョブ経路**（`natori_notification_jobs` に積み、`retryAcceptanceNotification` 系で送る。参考: `consultationService.ts` の `retryStaffConsultationNotification`、`structuredQuoteService.ts`、`deliveryReleaseService.ts`）に載せ替える。順序は「送れる見込みの確認 → 新トークンの INSERT と `renewed_at` 更新 → ジョブ積み」。cron は managed でなくても `natori_case_current_expiry_v1` の claim を使うか、`"sender"` 種別で admission を取る。
- 確認: `src/features/natori/server/__tests__/` に「release=1 でも再発行が ok を返し、ジョブが 1 件積まれる」テスト。本番では期限切れの `/natori/consult/<token>` を開いてボタンを押し、Vercel ログに `[natori-consultation] renewal email failed` が出ないこと。
- Opus に渡す情報: 本番の 2 フラグの有無。

### 2. 期限切れ納品の「受取済みとみなして完了」（高）

- どこ: `src/features/natori/server/deliveryReleaseService.ts`（受取は `natori_accept_delivery_ready_v1`、延長は `extendReadyDelivery` / `natori_case_delivery_v1`）、`src/features/natori/lib/caseWorkspacePresentation.ts` 76 行（`delivery_access_expired` の文言）、`src/features/natori/components/caseWorkspace/CaseWorkPanel.tsx`（制作・納品のボタン群）、`src/features/natori/lib/results.ts` 61 行（実績は `completed` のみ）。
- 直し方（手動案）: 新 RPC `natori_case_delivery_deemed_accept_v1`（条件: release が存在、`expires_at` 経過、未受取、operator が owner）。`completed_at`・操作者・理由（`deemed_accepted`）を記録し、`CaseWorkPanel` に「期限切れを受取済みとみなして完了にする」ボタン（確認ダイアログ付き）。
- 直し方（自動案）: 日次 cron で同じ RPC を全件に当てる。規約（#225 F）が「30 日で完了とみなす」なら自動が整合する。
- 確認: PAY-01 のテスト（`deliveryReleaseService.pay01.test.ts`）が通ること。実績ページに完了として載ること。
- 11 はこの PR と同時に: 特商法の「再送しても期限は延長されません」を「保存期限はご相談により延長する場合があります」に揃え、#225 の F を取り込む。

### 5. レート制限（中・一部済み）

- 済み: `src/lib/rateLimitUpstash.ts`（INCR + PEXPIRE NX、失敗時はメモリにフォールバック）。
- 残り: Vercel の env 設定（作家）。受付 `src/app/api/natori/portfolio/contact/route.ts` にメールアドレス単位の上限（例: 同一アドレス 3/時間）。キーは `email:` 接頭辞で小文字化。

### 6. 共有鍵の渡し方（中・一部済み）

- どこ: `src/middleware.ts` 81 行付近（`?natori-key=` → Cookie）、`src/app/admin-login/AdminLoginClient.tsx`。
- 直し方: `/admin-login` に鍵入力欄を置き、POST（CSRF 付き）で Cookie を発行。クエリ方式は一定期間併存させてから削除。`docs/natori/` に「鍵を変える手順（Vercel の env を変えて再デプロイ、全員の Cookie が無効になる）」を 1 枚。

### 8. トークの「制作中」段（中）

- どこ: `src/features/natori/lib/talkTimeline.ts`（steps の定義）。
- 直し方: facts.roughs（ラフ到着・OK）と delivery.exists で done を判定する段を足す。純関数なのでテストは `lib/__tests__/` に。
- Opus に渡す情報: 段の名前。

### 10 + 3. 旧経路とフラグの整理（中）

- 候補: `src/features/natori/components/dashboard/NatoriDashboardLegacy.tsx` / `ProjectsBoard.tsx` / `EstimateWorkspace.tsx`、`src/app/[locale]/natori/projects|estimate|inquiries/page.tsx`、`orderMailService.sendNatoriOrderMail` の payment/rough 経路、`portfolioContactService.ts`（呼び出し元なし）、`requireNatoriAdmin()`（呼び出し元なし）、`PortfolioCommissionForm.tsx` の旧フォーム本体（デモ `src/app/[locale]/etorie/demo/app/portfolio/contact/page.tsx` の既定を V2 に）。
- 進め方: まず `docs/natori/Natori_Production_Flags.md` に「フラグ名 / 本番 on・off / 何を切り替えるか」の表（値は書かない）。次に表で off 固定の経路を 1 PR ずつ削除し、`docs/cleanup-index.md` に行を足す。`src/features/etorie/` の `DemoBoards.tsx` が旧ボードを使っているので、デモ側の置き換えを先に。
- 注意: CI の Phase 系は旧経路のテストも回している。削除で落ちるテストは「その経路のテスト」なら一緒に消してよいが、共通部品のテストなら残す。

### 13. ギャラリーの並び（中・見た目）

- どこ: `src/features/natori/components/portfolio/PortfolioGallery.tsx` `PortfolioWorkCard`（`lg:col-span-4 lg:row-span-2` と横長の `col-span-2`）、`PortfolioStyles.tsx` の contain 上書き。
- 案を 2〜3 個（例: A 原寸比メイソンリーでピックアップ 1 枚だけ大きく / B 全部同じ高さの横並び / C 今のまま横長だけ 1 列幅に）を画像で出して選んでもらう。`PortfolioGallery.test.tsx` と Phase 7 の `#portfolio-gallery-results .pf-pin-card` の数の検査が pin なので、class 名は残す。

### 低の束

- 14: `src/features/natori/lib/portfolioHeroFacts.ts` 37 行。テストは `lib/__tests__/`。
- 15: `PortfolioCommissionForm.tsx` 320 行の `label === "X"` を `isPortfolioXLink`（`src/features/natori/constants/portfolioContent.ts` 329 行）に。
- 16: `consultationService.ts` `getMessages`（65 行）で署名 URL を遅延生成し、GET に IP 上限。
- 17: `checkSameOrigin`（`src/lib/auth/origin.ts`。使用例は `src/app/api/natori/portfolio/contact/route.ts`）を `quote/accept` と `delivery/accept` にも。
- 18: `natori_page_events` の削除 cron（`vercel.json` に追加、`src/app/api/cron/` に route）。マイグレーション不要。
- 19: `LinksLanding.tsx` と `AdminLoginClient.tsx` を公開ページの画用紙色・貼った紙ボタン（`.pf-btn`）に。
- 21: `e2e/natori-intake.spec.ts` を参考に、Supabase ブランチで fixture を作って承諾 → 入金 webhook → 納品 → 受取を 1 本。

## 5. Opus への頼み方

### 最初に渡すこと（毎セッション）

1. 「`AGENTS.md` と `CLAUDE.md` を読んで」。
2. 「`docs/natori/Natori_Audit_20261101_Handoff.md` の **項目 N** をやって」。
3. その項目の「先に必要なこと」の答え（フラグの有無、段の名前、方針）。
4. 制約: 「`.env` と secrets は読まない。本番 DB と本番設定は変えない。依頼者の個人情報は読まない。PR は作ってよいがマージは私が言うまでしない」。

### 書き方のコツ

- **1 セッション 1 項目**。2 つ以上頼むと PR が大きくなり、CI が落ちたとき原因が分かりにくい。
- **仕組みの修正**（1・2・5・6・8・16・17・18）は「原因を説明してから実装して」と書く。原因と正解がほぼ一つなので、案を出させる必要はない。
- **見た目**（13・19）は「案を 2〜3 個、画像で出して。選んでから実装」と書く。CLAUDE.md の方針どおり。
- **削除**（10・3）は「1 PR で 1 経路だけ。消す前に呼び出し元が無いことを grep で示して。`docs/cleanup-index.md` に行を足して」と書く。
- 終わりに「PR 本文に、手で何を確認したかと、本番で私が確認すべきことを書いて」と足す。
- CI が落ちたら「落ちたジョブのログを読んで、原因と直し方を説明してから直して。テストを消したり skip にしたりしない」。

### 頼み方の例

> AGENTS.md と CLAUDE.md を読んでから、docs/natori/Natori_Audit_20261101_Handoff.md の項目 1（相談リンク再発行と期限 cron）をお願いします。本番には NATORI_CASE_RELEASE_ENABLED が設定されていて、NATORI_CASE_BOOTSTRAP_PHASE は設定されていません。原因を説明してから、通知ジョブ経路に載せ替える形で直してください。.env と secrets は読まない、本番 DB と設定は変えない、依頼者の個人情報は読まない。PR は作っていいですが、マージは私が言うまでしないでください。

## 6. 作家が先にやること・決めること

- [ ] 本番の `NATORI_CASE_RELEASE_ENABLED` と `NATORI_CASE_BOOTSTRAP_PHASE` の有無（値は不要）→ 項目 1
- [x] 期限切れ納品の完了（手動ボタン方式で PR #232 済み）。本番 DB に `natori_case_complete_v1` のマイグレーションを当てる → 項目 11 へ
- [ ] Upstash を作り、Vercel に `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` を設定 → 項目 5
- [ ] 本番を数回開いて DevTools の Console に CSP の違反が出ないか見る → 項目 4
- [ ] トークの段の名前（例: ラフ確認 → 仕上げ中 → 納品）→ 項目 8
- [ ] 本番フラグ表（名前と on/off だけ）→ 項目 10
- [ ] 編集画面で「胸上」の作例を 1 枚選ぶ → 3e
- [ ] PR #225 は項目 2 と 11 が終わるまで open のまま

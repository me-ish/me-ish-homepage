# 受注フォーム（公開ポートフォリオ）ユーザビリティ改善 設計書

作成: 2026-11-01。対象: `src/features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx`（本番で有効な V2 構造化フォーム。約 1,640 行）と、それを包む `PortfolioCommissionForm.tsx` / `PortfolioContactPage.tsx`。

この設計書は、別セッション（Opus）が 1 PR ずつ実装するために書いている。読む順番は §1 → §2 → §8（PR 分割）→ 担当する PR の節。

モック画像: `images/intake-form-ux-mock-20261101.png`（左が今、右が目標の 1 画面目）。

---

## 1. 目的

依頼者が「何を書けばいいか分からない」「いくらになるか送るまで分からない」で止まるのを減らす。今のフォームは仕組み（再送安全・確認画面・エラー誘導・ステップ分割）は良く、弱いのは「書かせる設計」になっている点。

狙う変化:
- 見積もり希望の 1 画面目を「書く」より「選ぶ」中心にする（描く範囲を作例付きのカードで選ぶ、使いみちをチップで選ぶ）。
- 本文欄に書き出しの助け（項目を差し込むボタン）を付ける。
- 選んだ内容から料金の目安をその場で見せる。
- 途中で離れても入力が消えないようにする。
- 予算・納期の入力を 1 タップにする。

計測: 既存イベント `portfolio_form_start` → `portfolio_form_mode_select` → `portfolio_form_submit` の通過率（`natori_page_events`）。新しいイベント名は足さない（足すなら `src/features/natori/lib/pageEvents.ts` の allowlist とそのテストも更新）。

## 2. 変えないもの（必ず守る）

| 変えないもの | 理由 |
|---|---|
| `NatoriRequestDataV1`（`types/request.ts`）と `requestSchema.ts` のサーバー検証 | DB・メール・管理画面・見積提案（`pricingSuggestion.ts`）の契約。UI を変えても送る JSON は同じ |
| `PortfolioRequestFormState`（`lib/portfolioRequestForm.ts`）の形 | `restoreStructuredIntakeFields`（再送時の復元）、`validatePortfolioStep` / `validatePortfolioForm`、`pruneHiddenPortfolioRequestFields` がこの形に依存 |
| 操作 ID による再送安全（`intake.operation`）、確認画面（`portfolioConfirmationSections`、`送信前の確認` region、「◯◯を修正する」ボタン ≥ 44px） | Phase 3A / 5 / 7 の CI が検査 |
| 送信ボタンの文言「内容を確認する」「条件・連絡先へ」、モード radio「まず相談したい」「見積もりを希望」 | CI と単体テストが読み上げ名で探す |
| フィールド ID `#pf-name` `#pf-email` `#pf-message` `#pf-commercial` `#pf-publication` `#pf-publication-allowed-from` `#pf-budget-fixed` `#pf-deadline-date` と、ラベル「お名前」「メールアドレス」「ご相談・ご依頼の内容」「参考URL 1」 | 同上 |
| `pf-choice-control pf-cute-focus h-4 w-4 shrink-0`（チェックボックス・radio の class 文字列） | `portfolioDesignTokens.test.ts` が pin。チップ表示は `<label>` 側の見た目で作る |
| 送信ボタンの class `${natoriPrimaryActionClassName} pf-btn pf-cute-focus w-full py-3.5 text-base font-black` | 同上 |
| 料金は「目安」であり正式見積もりで確定する、という法務上の立て付け（`legal/tokushoho`、見積承諾の条件） | 目安表示は必ずその旨を添える |
| 見た目の世界観（画用紙色、手描き枠 `.pf-sketch`、貼った紙ボタン `.pf-btn`、飾りアニメーション無し） | `AGENTS.md` |

## 3. 画面設計

### 3.1 相談モード（「まず相談したい」）: 2 ステップのまま

1. 入力: ご希望 radio → **描くもの（任意・カード）** → 本文「ご相談・ご依頼の内容」（必須、書き出しチップ付き） → 「詳しく書く」折りたたみ 1 段（キャラ特徴・表情・構図・色・参考メモ・参考画像/URL） → 連絡先
2. 確認 → 送信

相談モードは今の軽さを守る。カードは「迷ったら未定のままで OK」と添え、必須にしない。目安表示はカードを選んだときだけ出す。

### 3.2 見積もりモード（「見積もりを希望」）: 3 ステップのまま

**ステップ 1「どんなイラストをご希望ですか？」**（上から順に）
1. 「ステップ 1 / 3・3分くらい」
2. 描くもの（カード 4 枚＋小さいチップ「立ち絵」「その他」「まだ決めていない」）
3. 使いみち（チップ、複数可。「わからない」を含む）
4. 描いてほしいこと（必須）: 書き出しチップ → textarea（`#pf-message`、4 行）→ 補助文「書き出しに迷ったら上のボタンで項目を足せます」
5. オプション（既存 `optionSelections` のチェックボックス。価格付き。チップ表示）
6. 料金の目安（カードを選んだら表示）
7. 「条件・連絡先へ →」

キャラ特徴・表情・構図・色・参考メモ・参考画像/URL は **ステップ 1 の末尾に「詳しく書く（任意）」折りたたみ 1 段**にまとめる（今は「選べる詳細項目」の中に「依頼の種類」「キャラクター・イメージの詳細」「参考画像・URL」がさらに折りたたみで入っている。入れ子をやめる）。

**ステップ 2「ご希望の条件と連絡先」**
1. 商用利用（既存 select `#pf-commercial` のまま）
2. 実績公開（既存 select `#pf-publication` のまま。delayed のとき日付）
3. ご予算（チップ。「金額を入力」を選ぶと `#pf-budget-fixed`）
4. 希望納期（チップ。「希望日あり」を選ぶと `#pf-deadline-date`、「お急ぎ」は日付任意＋補足）
5. 料金の目安（ステップ 1 と同じ部品。商用・お急ぎを反映）
6. お名前 / メールアドレス（打ち間違い提案付き）
7. 「内容を確認する」

ステップ 2 の 1〜4 は折りたたみにしない（今は「用途・条件」「予算・納期」が折りたたみ）。

**ステップ 3 確認**: 変更なし。

### 3.3 送信後

既存の「送信ありがとうございます!」の下に「次に起きること」を 4 コマで出す: ①2〜3日でメール → ②見積もり → ③お支払い → ④制作・納品。文言は `constants/portfolioContactCopy.ts` に追加し、`portfolioContent.ts` の「お見積もりのご案内」「お支払い」の本文と矛盾させない。

## 4. 部品の仕様

### 4.1 描くもの（PlanPicker）

- 置き場所: `components/portfolio/intake/PlanPicker.tsx`（新規）。
- DOM: `<fieldset>` + `<legend>描くもの</legend>`、中は `<input type="radio" name="pf-plan" class="pf-choice-control pf-cute-focus h-4 w-4 shrink-0 sr-only…">` を `<label>` で包んだカード。radio は視覚的に隠してよいが DOM から消さない（キーボード・読み上げ・CI の `getByRole('radio', { name })` のため）。
- 値と状態の対応（`applyPortfolioPlanSelection` を再利用し、追加分だけ新しい純関数 `lib/portfolioPlanPicker.ts` に置く）:

| カード / チップ | 値 | `requestType` | `commissionScope` | 備考 |
|---|---|---|---|---|
| SD | `sd` | `sd` | そのまま | 既存 `applyPortfolioPlanSelection(state, "sd")` |
| 胸上 | `bust_up` | そのまま（`undecided` なら `illustration` に） | `bust_up` | 既存関数＋ requestType 補完 |
| 膝〜腰上 | `waist_up` | 同上 | `waist_up` | 同上 |
| 全身 | `full_body` | 同上 | `full_body` | 同上 |
| 立ち絵（チップ） | `standing` | `standing` | そのまま | |
| その他（チップ） | `other` | `other` | そのまま | 選ぶと「ご依頼の種類（その他の内容）」入力（既存 `#pf-request-type-other`）を表示 |
| まだ決めていない（チップ） | `undecided` | `undecided` | `undecided` | 相談モードの既定 |

- 「requestType 補完」: 胸上/膝上/全身を選んだとき `requestType` が `undecided` なら `illustration` にする。`standing` や `sd` が入っているときは触らない（立ち絵の胸上、SD の全身はあり得る）。Phase 5 の「pricing origin」テストは `制作範囲` の値だけを見るので、この補完で壊れない。
- 細かい組み合わせ（例: 立ち絵×胸上）は、カードの下の「細かく選ぶ」リンクで既存の 2 つの select（`#pf-request-type`「ご依頼の種類」、`#pf-scope`「制作範囲」）を開いて選べるようにする。select は DOM に常に置き、`<details>` で閉じる。カード選択は select の値を変え、select の変更はカードの選択状態に反映する（状態は `PortfolioRequestFormState` 一つだけ。カードは派生表示）。
- カードの中身: 作例サムネ（`lib/portfolioPlanSamples.ts` の `portfolioPlanSample(plan, content.works)`。無ければ淡いピンクの枠にプラン名だけ）、プラン名、`plan.price`（例「5,000円〜」。文字列のまま表示）。
- 量産イラスト（`NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE`）はカードに出さない。料金表の「このプランで相談」リンク経由（`PLAN_SELECT_EVENT`）だけで今までどおり入る。
- 選択中の見た目: `.pf-btn` と同じ墨色の枠＋ `3px 3px 0` の影、塗り `portfolioColors.actionSoft`。未選択は `.pf-sketch-soft`。
- スマホ: 4 枚を 2×2 ではなく横 4 列（1 枚 約 80px）。幅 360px で文字が折れないことを確認。

### 4.2 使いみち（チップ化）

- 既存の checkbox（`NATORI_USAGE_TYPES_V1`、`original_character` 除外、ラベルは `NATORI_USAGE_TYPE_LABELS_V1`）を `<label>` の見た目だけチップにする。input の class は変えない。
- 「わからない」チップを追加するか: **追加しない**（状態に対応する値が無い。何も選ばなくても送れることを補助文「決まっていなければ空のままで OK」で伝える）。

### 4.3 書き出しチップ（WritingPrompts）

- 置き場所: `components/portfolio/intake/WritingPrompts.tsx`（新規）、文面は `constants/intakeWritingPrompts.ts`（新規）。
- ボタン 4 つ: 「＋ 誰を」「＋ 表情・ポーズ」「＋ 服・小物」「＋ 雰囲気」。押すと textarea（`#pf-message`）の末尾に `誰を：` のような見出し行を 1 行足し、カーソルをその行末に置く。同じ見出しが既にあれば足さず、その行へカーソルを移す。
- `type="button"`、`aria-controls="pf-message"`。差し込みは `state.message` の更新で行う（DOM を直接いじらない）。
- 相談モードでも出す（見出しは同じ）。
- 文面は作家が決める（§10）。

### 4.4 料金の目安（LiveEstimate）

- 計算は純関数 `lib/portfolioLiveEstimate.ts`（新規、テストは `lib/__tests__/portfolioLiveEstimate.test.ts`）。入力は `PortfolioRequestFormState`、`PortfolioContent`、`optionChoices`。出力は `{ base: number | null; options: number; commercial: number; rush: number; total: number | null; label: string }`。
- 規則:
  - base: 選んだプランの `plan.price` を `parseYenAmount`（`lib/portfolioPricing.ts` の private 関数。export するか、同じ正規化を `lib/portfolioLiveEstimate.ts` に写す）で数値化。SD は `plans.find(id === "sd")`、胸上/膝上/全身は `commissionScope` と同じ id。`standing` / `other` / `undecided` は base `null` → 目安を出さない。
  - options: `optionSelections` で選択中かつ `price` が数値化できるものの合計（数量を掛ける）。
  - commercial: `commercialUse === "yes"` のとき、`content.options` の `PORTFOLIO_OPTION_IDS.commercialUse`（`commercial_use`。フォーム 301 行の `commercialPrice` と同じ取り方）を数値化した額。無ければ 0 で「商用利用は見積もりで確定」を添える。
  - rush: `deadlineKind === "rush_consultation"` のとき `NATORI_RUSH_DELIVERY_AMOUNT`。
  - total = base + options + commercial + rush。
- 表示: 「この内容の目安：**5,000円〜**」。内訳があるときは「（基本 5,000円 ＋ オプション 1,000円）」。常に「背景・差分・商用の範囲は正式なお見積もりで確定します」を添える。`aria-live="polite"` で更新を読み上げる。
- 量産イラスト選択時は出さない（既存の受付停止の案内があるため）。
- 「目安」は request_data に保存しない（表示専用）。

### 4.5 予算チップ

既存 `budgetKind` select と range の min/max 入力を、radio チップ＋条件付き入力に置き換える。

| チップ | `budgetKind` | `budgetMin` | `budgetMax` |
|---|---|---|---|
| まだ決めていない | `undecided` | `""` | `""` |
| 〜5,000円 | `range` | `"0"` | `"5000"` |
| 5,000〜10,000円 | `range` | `"5000"` | `"10000"` |
| 10,000〜20,000円 | `range` | `"10000"` | `"20000"` |
| 20,000円〜 | `range` | `"20000"` | `""` |
| 金額を入力 | `fixed` | 入力値（`#pf-budget-fixed`） | 同じ値 |

- サーバーは `range.min` が 0 以上の整数で `max ≥ min` を要求（`requestSchema.ts`）。上の値はすべて通る。
- 復元（再送・下書き）で `range` の min/max がチップの組み合わせと一致しないときは「金額の範囲（下限・上限）」として既存の 2 入力（`#pf-budget-min` `#pf-budget-max`）を表示して値を見せる。チップはどれも選択なし。
- ラベル「ご予算」は `<legend>` に残す。

### 4.6 納期チップ

| チップ | `deadlineKind` | 追加入力 |
|---|---|---|
| 通常でOK（入金後 約1か月） | `standard` | なし |
| 希望日あり | `preferred_date` | `#pf-deadline-date`（必須） |
| お急ぎ（+2,000円／要相談） | `rush_consultation` | `#pf-deadline-date`（任意）＋ `#pf-deadline-note` |
| まだ決めていない | `undecided` | なし |

金額は `NATORI_RUSH_DELIVERY_AMOUNT` から出す（既存ラベル `NATORI_DEADLINE_KIND_LABELS_V1.rush_consultation` と同じ数字）。

### 4.7 入れ子の解消

- 見積もりモード: `FormSection` の `collapsible` を使わず、見出し付きの平らなセクションにする（`FormSection` の非 collapsible 分岐がそのまま使える）。「選べる詳細項目」の `<details>` は撤去。
- 相談モード: 「詳しく書く（任意）」の `<details>` 1 段だけ残す。中は 4.1 の「細かく選ぶ」、キャラ特徴・表情・構図・色・参考メモ、参考画像/URL。
- Phase 7 の `revealField` は閉じた `<details>` を自分で開くので、残る 1 段は問題ない。

### 4.8 下書き保存（Draft）

- 純関数 `lib/portfolioDraft.ts`（新規）: `serializePortfolioDraft(state): string`、`parsePortfolioDraft(raw: string | null): PortfolioRequestFormState | null`（形の検証をして不正なら null。`zod` の既存スキーマを流用せず、キーの有無と型だけ見る軽い検査でよい）。
- 保存は `components/portfolio/intake/useIntakeDraft.ts`（新規 hook。`localStorage` はここだけで触る。`lib/` には置かない）。
  - キー: `natori.portfolio.intake.draft.v1`。
  - 保存する: `PortfolioRequestFormState` 全体と `inquiryMode`、ステップ番号、保存時刻。
  - 保存しない: `clientName` / `clientEmail`（個人情報）、参考画像（File は保存できない。復元時に「参考画像は選び直してください」を出す）。
  - タイミング: 入力のたびに 500ms デバウンス。送信成功・「新しい依頼を始める」・「下書きを消す」で削除。保存から 7 日過ぎたものは読まずに削除。
  - 優先順位: `intake.operation` による再送復元があるときは下書きを読まない（再送が勝つ）。
  - 復元したら画面上部に「前回の下書きを復元しました。[下書きを消す]」を出す（`role="status"`）。
  - `localStorage` が使えない環境（プライベートモード等）では黙って無効にする（try/catch）。
- 「入力はこの端末に自動で保存されます（送信後に消えます）」を送信ボタンの下に小さく出す。

### 4.9 メール打ち間違い提案

- 純関数 `lib/emailTypoSuggestion.ts`（新規、テスト付き）: `suggestEmailDomain(email: string): string | null`。対象ドメイン: gmail.com / icloud.com / yahoo.co.jp / outlook.com / hotmail.com / docomo.ne.jp / ezweb.ne.jp / softbank.ne.jp。編集距離 1〜2 のときだけ提案。
- 表示: メール欄の blur 後に「もしかして ◯◯@gmail.com ですか？ [この住所にする]」。送信は止めない。`#pf-email` の値を書き換えるのはボタンを押したときだけ。

### 4.10 所要時間

ステップ表示を「ステップ 1 / 3・3分くらい」にする（相談モードは「2分くらい」）。`stepLabels` の横に文字を足すだけ。

## 5. ファイル構成（CLAUDE.md の責務に合わせる）

```
src/features/natori/
  components/portfolio/intake/
    PlanPicker.tsx            描くものカード（radio）
    ChoiceChips.tsx           radio / checkbox をチップ表示にする共通ラッパ
    WritingPrompts.tsx        書き出しボタン
    LiveEstimate.tsx          料金の目安の表示
    DraftBanner.tsx           下書き復元の案内
    useIntakeDraft.ts         localStorage を触る hook
  constants/
    intakeWritingPrompts.ts   書き出しの見出し文
    intakeBudgetChips.ts      予算チップの値表
  lib/
    portfolioPlanPicker.ts    カード値 ↔ state の対応（純関数）
    portfolioLiveEstimate.ts  目安の計算（純関数）
    portfolioDraft.ts         下書きの直列化・検証（純関数）
    emailTypoSuggestion.ts    打ち間違い提案（純関数）
    __tests__/ …              上の 4 つのテスト
```

- `PortfolioStructuredCommissionForm.tsx` は上の部品を組み立てる側に寄せ、行数を減らす方向で。ただし状態・検証・送信の流れは動かさない。
- `data/` と `server/` には触らない。

## 6. データ対応の確認（UI → state → 送信 JSON）

| UI | state | 送信（`NatoriRequestDataV1`） |
|---|---|---|
| 描くものカード | `requestType` / `commissionScope`（§4.1 の表） | そのまま |
| 使いみちチップ | `usageTypes[]` | そのまま |
| 書き出しチップ | `message` に行を追加 | `message` |
| オプションチップ | `optionSelections` | `options[]` |
| 予算チップ | `budgetKind` / `budgetMin` / `budgetMax`（§4.5） | `budget` |
| 納期チップ | `deadlineKind` / `deadlineDate` / `deadlineNote`（§4.6） | `deadline` |
| 料金の目安 | 無し（派生表示） | 送らない |
| 下書き | 無し（復元で state に戻す） | 送らない |

## 7. テストと CI の更新箇所

実装で壊れる既存テストは「新しい方針に合わせて書き換える」。消さない、skip にしない。CI の Phase 系はローカルで回せないので、PR を出して結果を見る（1 回約 17 分）。

### 7.1 単体テスト（vitest）
- `components/portfolio/__tests__/PortfolioStructuredCommissionForm.test.tsx`（77 件）: `getByLabelText("ご依頼の種類")` は jsdom では閉じた `<details>` の中でも取れるので、多くはそのまま通る。通らないものだけ「細かく選ぶ」を開いてから操作する形に変更。`getByLabelText("ご予算")` / `getByLabelText("希望納期")` の `selectOptions` は `getByRole("radio", { name: "金額を入力" })` / `getByRole("radio", { name: "希望日あり" })` の click に変更。確認画面の内容検査はそのまま通るはず。
- `constants/__tests__/portfolioDesignTokens.test.ts`: `pf-choice-control …` と送信ボタンの class 文字列が残っていれば変更不要。
- 新規: `lib/__tests__/portfolioPlanPicker.test.ts`、`portfolioLiveEstimate.test.ts`、`portfolioDraft.test.ts`、`emailTypoSuggestion.test.ts`。

### 7.2 CI スクリプト（`scripts/`）
| ファイル・行 | 今 | 変更後 |
|---|---|---|
| `natori-phase-7/browser.mjs` 226 | `revealField('#pf-request-type').selectOption('illustration')` / `#pf-scope` → `full_body` | `getByRole('radio', { name: /^全身/ }).check()`（requestType は補完で `illustration` になる） |
| 同 231 | `#pf-budget-kind` select → `fixed`、`#pf-budget-fixed` fill | `getByRole('radio', { name: '金額を入力' }).check()` → `#pf-budget-fixed` fill（そのまま） |
| 同 232 | `#pf-deadline-kind` select → `preferred_date` | `getByRole('radio', { name: '希望日あり' }).check()` → `#pf-deadline-date` fill（そのまま） |
| 同 230, 239 | `#pf-commercial` / `#pf-publication` select | 変更なし（select を残す） |
| `natori-phase-5/browser.mjs` 60–61 | `getByLabel('ご依頼の種類').selectOption('other')` / `制作範囲` → `other` | 「細かく選ぶ」を開く → 同じ selectOption（select は残る） |
| `natori-phase-5/browser-cases.mjs` 74, 114–122 | 同上 ＋ `option[value="icon"]` が無いこと | 同上。`icon` が無い検査はそのまま有効 |
| 同 149–150 | pricing origin: `制作範囲` / `ご依頼の種類` の select 値 | select を残すので変更なし。加えて対応するカード radio が checked であることを足す |
| `natori-phase-3a/browser-additions.mjs` 69–74, 119–122 | モード radio・ラベル・ボタン名 | 変更なし |
| `natori-phase-6b/browser.mjs` 168–170 | 「内容を確認する」の色・押下 | 変更なし |

### 7.3 e2e（`e2e/natori-intake.spec.ts`、CI の「E2E Tests」ジョブ。ローカルでも `npx playwright test e2e/natori-intake.spec.ts` で回せる）
- 69 行 `getByLabel("ご依頼の種類")).toBeVisible()`: select は「細かく選ぶ」の中に入るので、`getByRole("group", { name: "描くもの" })` が見えることに置き換える（PR 2）。
- 70 行・73 行 `getByLabel("ご予算")` の hidden / visible: 予算がチップ（fieldset＋legend）になるので `getByRole("group", { name: "ご予算" })` に置き換える（PR 2）。
- それ以外（モード radio、お名前・メール、本文、ボタン名、送信後の見出し）は変更なし。

## 8. PR の分け方と順番

| PR | 内容 | CI スクリプト変更 | 期待 |
|---|---|---|---|
| **1. 並びと助け** | §3 の順序変更（入れ子解消、ステップ 2 を平らに）、書き出しチップ（4.3）、所要時間（4.10）、送信後の 4 コマ（3.3）、使いみちのチップ表示（4.2。input はそのまま） | 不要（select とラベルは残る） | 体感が最も変わる。CI は Phase 7 の `revealField` が `<details>` 無しでも動くことを確認 |
| **2. 選ぶ部品** | 描くものカード（4.1）、予算チップ（4.5）、納期チップ（4.6）、料金の目安（4.4） | §7.2 を同じ PR で | 落ちたら `browser.mjs` の `check(...)` を読む。Phase 5 の `OTHER_GONE` / `SELECT_TYPE` チェックポイント名で当たりを付ける |
| **3. 小物** | 下書き保存（4.8）、メール提案（4.9） | 不要 | localStorage の try/catch と、再送復元との優先順位のテスト |

PR 1 と 3 は独立。PR 2 は PR 1 の後。

## 9. 受け入れ条件

- [ ] 見積もりモードのステップ 1 で、文章を書く前に「描くもの」と「使いみち」を選べる。
- [ ] 描くものを選ぶと、その場で「この内容の目安：◯円〜」と「正式なお見積もりで確定」が出る。未定・立ち絵・その他では出ない。
- [ ] 書き出しボタンで本文に見出し行が入り、二重に入らない。
- [ ] 予算・納期がチップで 1 タップ。「金額を入力」「希望日あり」で既存の入力欄が出る。
- [ ] 送信される JSON（`requestData`）は、同じ選択を旧 UI でしたときと同一（単体テストで比較）。
- [ ] 確認画面の「◯◯を修正する」で戻ると、カード・チップが選択済みの状態で表示される。
- [ ] 途中でページを閉じて開き直すと下書きが戻り、名前とメールは戻らない。送信後は消える。
- [ ] スマホ 360px / 390px で横はみ出し無し、カード 4 枚が 1 行、文字が折れない。
- [ ] 読み上げ: カードとチップは radio / checkbox として読まれ、Tab と矢印で選べる。目安の更新は `aria-live` で読まれる。
- [ ] `npx tsc --noEmit`、ESLint、`npx vitest run` 全体、CI 全件が緑。
- [ ] 旧 UI でしか選べなかった組み合わせ（立ち絵×胸上、SD×その他）が「細かく選ぶ」から選べる。

## 10. 作家が決めること（実装前に）

- [ ] 書き出しチップの見出し文（案: 誰を / 表情・ポーズ / 服・小物 / 雰囲気）。
- [ ] 予算チップの刻み（案: 〜5,000 / 5,000〜10,000 / 10,000〜20,000 / 20,000〜）。
- [ ] 料金の目安を出してよいか（出す場合、添える文言。案: 「背景・差分・商用の範囲は正式なお見積もりで確定します」）。
- [ ] 送信後の 4 コマの文言。
- [ ] 描くものカードに使う作例（編集画面でプランごとの `sampleWorkId` を設定。胸上が未設定）。

## 11. Opus への依頼文の例

> AGENTS.md と CLAUDE.md を読んでから、docs/natori/Natori_Intake_Form_UX_Design_20261101.md の **PR 1（並びと助け）** を実装してください。§2「変えないもの」を守り、§7 のテスト方針どおり既存テストは新方針に合わせて更新（削除・skip はしない）。書き出しチップの文言は「誰を / 表情・ポーズ / 服・小物 / 雰囲気」、所要時間は「3分くらい」で。実装前に、変更するファイルと順番を短く説明してください。ローカルで 360px / 390px / 1366px のスクリーンショットを撮って PR に添えてください。.env と secrets は読まない、本番 DB と設定は変えない。PR は作ってよいですが、マージは私が言うまでしないでください。

PR 2 を頼むときは「§7.2 の CI スクリプト更新を同じ PR に含める」と明記する。

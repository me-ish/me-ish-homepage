# ナトリ ポートフォリオ Research-driven Redesign 実装計画

作成日: 2026-08-09  
対象: `/natori/portfolio`（full）および互換確認対象 `/natori/works`（showcase）

本書は、ナトリのポートフォリオを「雰囲気でおしゃれにする」のではなく、研究・UX実証知見・アクセシビリティ基準・実測データを使って段階的に改善するための Codex 向け実装指図書である。

コード変更は必ず root の `AGENTS.md` と `CLAUDE.md` を先に読み、本書の1チケット単位でスコープを限定して行うこと。

---

## 0. ゴール

### 主ゴール

閲覧者が次の順序で迷わず進めるポートフォリオにする。

```text
第一印象
  ↓
作品を評価
  ↓
何を依頼できるか理解
  ↓
価格・納期・制作フローを理解
  ↓
依頼しても大丈夫そうだと判断
  ↓
相談 / 見積もりフォーム開始
  ↓
送信
```

### 成功条件

- 作品そのものがサイト装飾より視覚的に優先される。
- 「何を頼めるか」「価格感」「納期」「制作の流れ」が短時間で把握できる。
- 相談者は未定項目を無理に確定せず送信できる。
- 見積依頼者は必要情報を構造化して送れる。
- mobile / keyboard / screen reader を含め、フォーム操作を阻害しない。
- `/natori/works` の showcase 制約を破らない。
- 改善後に CTA / form funnel を実測できる。

---

## 1. 非ゴール

今回の redesign では原則として以下を行わない。

- `RequestData V1` のドメイン仕様変更
- `natori_projects` / quotes / Storage 等の DB 再設計
- `/api/natori/portfolio/contact` の受付契約変更
- 料金そのものの値上げ・値下げ判断
- エトリエ管理画面の全面 redesign
- natori feature 全体のディレクトリ再編
- AURA のデザイン言語をポートフォリオへ持ち込むこと
- 新しい UI ライブラリの導入
- 大規模 A/B testing 基盤の新設

フォームの情報設計を改善する場合も、既存 `PortfolioStructuredCommissionForm` と `RequestData V1` を真実源として使い、UI専用の別 payload を作らない。

---

## 2. 根拠レベル

本書では設計判断を3段階で区別する。

### A — Research / Standard

研究、複数回のユーザビリティテスト、またはアクセシビリティ標準から直接支持されるもの。

原則として採用する。

### B — Evidence-informed inference

研究結果そのものではないが、研究で確認された特性から今回のポートフォリオへ合理的に適用した設計判断。

実装して実測対象にする。

### C — Brand hypothesis

ナトリの作品・ブランドとの相性から決めるアートディレクション。

「研究で最適と証明済み」と扱わない。必要なら視覚レビューや実測で変更する。

---

## 3. 研究・基準の参照

### A-1. 視覚的複雑性と第一印象

Tuch et al. (2012) は Web サイトの perceived aesthetics に visual complexity と prototypicality が非常に短い提示時間から影響し、low visual complexity / high prototypicality が高く評価されたと報告している。

- Google Research: https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/
- DOI: 10.1016/j.ijhcs.2012.06.003

この知見は「装飾を全部消せ」という意味ではない。作品自体の視覚情報量が大きいポートフォリオでは、UI装飾の情報量を管理する根拠として使う。

### A-2. Colorfulness / complexity と個人差

Reinecke et al. (CHI 2013) は 450 website / 548 participants のデータから colorfulness と visual complexity が第一印象の aesthetics と関係し、年齢等の demographic variables も評価差に関係することを示した。

- https://www.eecs.harvard.edu/~kgajos/papers/2013/reinecke13predicting.shtml

よって「特定のピンクが科学的に最もCVする」「色数は必ず1色が最適」とは扱わない。

### A-3. Contrast / focus / accessibility

WCAG 2.2 を最低基準とする。

- https://www.w3.org/TR/WCAG22/

少なくとも以下を守る。

- 通常テキスト: contrast ratio 4.5:1 以上
- large text: 3:1 以上
- interactive component の識別に必要な非テキスト境界・状態は WCAG 1.4.11 を確認
- focus-visible を消さない
- 状態を色だけで伝えない

### A-4. Form structure

Baymard の複数ラウンドの usability testing では、広範な multi-column form は見落とし・入力順誤認・error が起きやすく、single-column を基本とする方が理解・確認しやすい。

- https://baymard.com/blog/avoid-multi-column-forms
- https://baymard.com/learn/form-design

W3C WAI Forms Tutorial では、必要な情報だけを求め、明示的 label、fieldset/legend、instructions、error feedback を提供することを推奨している。

- https://www.w3.org/WAI/tutorials/forms/
- https://www.w3.org/WAI/tutorials/forms/labels/
- https://www.w3.org/WAI/tutorials/forms/instructions/
- https://www.w3.org/WAI/tutorials/forms/validation/

---

## 4. 現行実装の確認済み事実

2026-08-09 時点で以下を前提とする。

### ページ構造

`PortfolioLanding.tsx` は現在、full variant で以下の順序。

```text
PortfolioHeader
PortfolioHero
PortfolioGallery
PortfolioAbout
PortfolioPricing
PortfolioGuidelines
PortfolioCommissionForm
PortfolioMobileCta
PortfolioFooter
```

### Design tokens

`portfolioContent.ts` の現行 palette は以下のような多色構成。

- pale purple background
- pink / deep pink
- mint / deep mint
- yellow
- peach
- white card
- tape color

### Hero

- main visual は現在非表示
- pink text / sparkle / mint-yellow decoration / rounded CTA / shadow を利用
- CTA は「作品を見る」「依頼してみる」

### Gallery

- masking tape
- card rotation
- card shadow
- colored tag pills
- filter pills
- hover lift
- 3:4 image
- modal enlargement
- `next/image`

を利用。

### Form

- legacy form と `PortfolioStructuredCommissionForm` が rollout guard で共存
- structured form は `consultation` / `quote` を分ける
- `RequestData V1` を利用
- 未定値を許容
- reference images / links を扱える
- fieldset / legend / labels / server field error が既に存在

### Analytics

現行 event:

- `portfolio_sns_click`
- `portfolio_plan_click`
- `portfolio_form_submit`
- `links_click`

`/api/natori/track` は server-side allowlist を持つため、新規 event は client type だけでなく `NATORI_PAGE_EVENTS` も同時更新が必要。

---

## 5. Target information architecture

### full variant

最初の redesign target は以下。

```text
Header
  ↓
Hero
  - 誰か
  - 何を制作するか
  - 代表作品
  - 作品を見る / 相談・見積もり
  ↓
Selected Works / Gallery
  - まず作品を評価できる
  ↓
Commission / Pricing
  - 頼める内容
  - 価格目安
  ↓
Workflow + Delivery
  - 依頼後に何が起きるか
  ↓
About / Trust
  - 作者情報
  - 対応内容
  ↓
Guidelines / FAQ
  - 不安・条件を解消
  ↓
Consultation / Quote Form
  ↓
Footer
```

### showcase variant

`/natori/works` は営業先プラットフォーム向け作品集という既存仕様を維持する。

禁止:

- 料金表示
- commission status
- SNS direct link
- contact form
- direct transaction CTA

showcase では Hero / Gallery / About の visual redesign のみ共有可能。

---

## 6. Initial visual direction

名称: **Warm Minimal Gallery**

これは C（brand hypothesis）であり、研究で特定色が最適と証明されたものではない。

### 初期 token 候補

```ts
page:         "#FAF8F5"
card:         "#FFFFFF"
subtle:       "#F4F0EC"
text:         "#242424"
textSoft:     "#6B625E"
borderSubtle: "#E4DED8"
borderStrong: "#8A817C"
accent:       "#A84F68"
accentHover:  "#8F455A"
accentSoft:   "#F4E6EA"
```

確認済み目安:

- `#A84F68` / white は WCAG AA 通常テキスト相当の contrast を満たす
- `#242424` / `#FAF8F5` は十分な contrast
- `#6B625E` / `#FAF8F5` は通常テキスト 4.5:1 を満たす
- `borderSubtle` は separator 用。input の唯一の識別境界としては使わない
- input 等の識別に border が必要な場合は `borderStrong` など 3:1 以上を検証して使う

### 色の役割

- artwork: 色の主役
- neutral surface: レイアウトの主役
- accent: CTA / selection / link / focus のみ
- semantic error/success: accent と分離

pink / mint / yellow / peach を装飾として同時使用する現行方式は廃止候補。

### Shape

初期候補:

- controls: radius 8–10px
- CTA: radius 10–12px
- content card: radius 12–16px
- pill は tag / status のように意味がある場合だけ

全要素を pill にしない。

### Shadow

- artwork grid: 原則 shadow なし
- surface separation が必要な card: border または非常に弱い shadow
- modal: shadow 使用可
- floating mobile CTA: 必要最小限

---

## 7. 推奨実施順

```text
PF-00 baseline / measurement
       ↓
PF-01 information architecture
       ↓
PF-02 visual tokens
       ↓
 ┌─────┼────────────┐
 ↓     ↓            ↓
PF-03 PF-04         PF-05
Hero  Gallery       Decision sections
 └─────┼────────────┘
       ↓
PF-06 form presentation
       ↓
PF-07 accessibility / mobile
       ↓
PF-08 performance / image
       ↓
PF-09 funnel analytics
       ↓
PF-10 regression / rollout
```

PF-00〜PF-02 は先行。PF-03〜PF-05 は同一 visual system 確定後なら分割実装可。

---

# 実装チケット

## PF-00 現状 baseline と評価軸固定

### 目的

redesign 前後を「好み」だけで比較しないための baseline を作る。

### 変更対象候補

- docs 本書への baseline 記録追記
- 必要なら screenshot artifact は repo 外でもよい
- 既存 analytics を確認

### 実装内容

1. `/natori/portfolio` desktop / mobile の現行 screenshot を保存。
2. `/natori/works` desktop / mobile も確認。
3. current event summary を確認できる場合は 30日 / 90日を記録。
4. Lighthouse / browser devtools で最低限以下を記録。
   - LCP
   - CLS
   - INP または interaction responsiveness
   - accessibility warnings
5. Hero → Gallery → Pricing → Form の目視距離と mobile scroll を確認。

### 受け入れ条件

- redesign 前 screenshot がある。
- 既存 event の種類と不足 event が明記されている。
- performance は絶対値保証ではなく baseline として記録される。

### リスク

traffic が少ない場合、30日 event 数から統計的な結論を出さない。

---

## PF-01 情報アーキテクチャ再配置

### 根拠

B。作品評価 → 発注条件 → trust → form という意思決定順を優先する設計仮説。

### 変更対象

- `src/features/natori/components/portfolio/PortfolioLanding.tsx`
- `src/features/natori/components/portfolio/PortfolioHeader.tsx`

### 実装内容

full variant の順序を原則以下へ変更。

```text
Hero
Gallery
Pricing
Guidelines(flow + delivery)
About
Guidelines(requests / FAQ相当)
Form
```

ただし `PortfolioGuidelines` が現状 workflow / delivery / requests を1 component に含むため、まず責務分割を検討する。

推奨:

- `PortfolioWorkflow.tsx`
- `PortfolioGuidelines.tsx` または `PortfolioFaq.tsx`

への小さな分割。

新規 FAQ content model を追加する場合は PF-05 で行い、PF-01 では無理に追加しない。

Header nav はユーザー語彙を優先。

初期候補:

- 作品
- 料金・ご依頼
- 制作の流れ
- プロフィール
- 相談・見積もり

### showcase

showcase の nav は作品 / プロフィールのみを維持。

### 受け入れ条件

- full variant に存在しない anchor を header が参照しない。
- showcase に販売・連絡導線が混入しない。
- semantic heading order が不自然にならない。

---

## PF-02 Design token 整理

### 根拠

A + B + C。

- A: visual complexity を管理する
- B: artwork が高情報量なので UI color/decor を抑える
- C: warm neutral + muted rose の具体色

### 変更対象

- `src/features/natori/constants/portfolioContent.ts`
- `src/features/natori/components/portfolio/PortfolioStyles.tsx`
- portfolio components using old token names

### 実装内容

1. semantic token 名へ変更する。
2. `pink`, `mint`, `yellow`, `peach`, `tape` のような「色名=用途」設計を段階的に廃止。
3. 少なくとも次の用途 token を持つ。
   - page
   - surface
   - surfaceSubtle
   - text
   - textSoft
   - borderSubtle
   - borderStrong
   - accent
   - accentHover
   - accentSoft
   - error
   - success
4. focus-visible は全 interactive element で明示。
5. `prefers-reduced-motion` を維持。
6. token migration 中に unrelated natori UI へ影響させない。

### 禁止

- `portfolioColors` を一気に全 feature 共通 theme へ昇格する。
- shadcn global theme を変更する。
- AURA の global tokens を流用する。

### 受け入れ条件

- body text contrast AA。
- CTA text contrast AA。
- input/control の視認に必要な境界が adjacent background と十分区別できる。
- color-only state がない。
- old decorative colors の用途が残る場合は理由が明記される。

---

## PF-03 Header / Hero redesign

### 根拠

A + B。

第一印象が短時間で形成されるため、Hero 内で「誰 / 何を制作 / 代表作 / 次の行動」を理解できる構成にする。

### 変更対象

- `PortfolioHeader.tsx`
- `PortfolioHero.tsx`
- 必要なら `portfolioContent.ts`

### Hero target

Desktop:

```text
[text / CTA] [representative artwork]
```

Mobile:

```text
text
CTA
artwork
```

### 表示内容

- artist name
- illustrator / specialty
- 1〜2行の concise description
- primary CTA: `相談・見積もり`
- secondary CTA: `作品を見る`
- representative artwork

### main visual

現行では `heroImage` が型・content に存在するが非表示。

初期方針:

1. `heroImage` がある場合は表示。
2. `heroImage` が null の場合、勝手に decorative character SVG を復活させない。
3. fallback を first work image にする場合は duplicate presentation の是非を screenshot review で判断する。

### 装飾

削減候補:

- multiple Sparkle
- yellow + mint decoration
- excessive pill CTA
- strong shadow

ブランド記号として残す装飾は1系統まで。

### CTA

`依頼してみる` より、行動結果が分かる `相談・見積もり` を初期候補とする。

CTA click は PF-09 で計測。

### 受け入れ条件

- 320px width で horizontal overflow なし。
- Hero だけでサイト用途が分かる。
- artwork が UI decoration より目立つ。
- showcase では direct transaction CTA を表示しない。

---

## PF-04 Gallery redesign

### 根拠

A + B。

作品自体が高い visual complexity を持つため、周辺装飾を減らし作品比較に集中させる。

### 変更対象

- `PortfolioGallery.tsx`
- `PortfolioStyles.tsx`
- `portfolioContent.ts` の placeholder/decor constants

### 維持

- `next/image`
- filter
- modal enlargement
- image alt
- keyboard close / Escape
- body scroll lock
- responsive grid

### 削減・変更

原則削除:

- masking tape
- per-card rotation
- hover rotation reset
- per-card decorative palette
- colored tag pill per artwork
- default strong card shadow

初期 target:

```text
image
work title
small neutral category text
```

### Grid

- mobile: 1 column または 2 column を実作品縦横比で visual review
- tablet: 2
- desktop: 3

作品画像が主に縦長 3:4 である現行仕様は維持候補。

### Modal accessibility

現行 `role="dialog"` / `aria-modal` / Escape は維持しつつ、以下を確認。

- open 時 focus を dialog 内へ移動
- close 後 trigger へ focus return
- Tab focus が背景へ抜けないこと

不足している場合は focus management を追加。

### 受け入れ条件

- 作品一覧の主な色が artwork 由来になる。
- filter selection は色以外でも識別可能。
- modal が keyboard だけで開閉できる。
- first image priority が LCP に本当に寄与する位置か PF-08 で再確認。

---

## PF-05 Pricing / Workflow / About / Guidelines の意思決定支援化

### 根拠

B。

「かわいいサイト」から「依頼条件が判断できる営業サイト」へ寄せる。

### 変更対象

- `PortfolioPricing.tsx`
- `PortfolioGuidelines.tsx`
- `PortfolioAbout.tsx`
- 必要なら新規 `PortfolioWorkflow.tsx`
- 必要なら新規 `PortfolioFaq.tsx`
- `types/portfolio.ts`
- `constants/portfolioContent.ts`
- `components/portfolio/edit/PortfolioEditor.tsx`
- portfolio content parse / compatibility code

### Pricing

維持:

- plan ID
- existing pricing value
- `PLAN_SELECT_EVENT`
- `portfolio_plan_click`
- 「このプランで相談」から form selection 連携

変更:

- decorative plan colors を廃止
- colored circle を意味のある icon/label にしない限り削除
- card shadow を弱める / border へ
- price / scope / included revisions を最優先 hierarchy にする

### Workflow

現在の workflow は有用なので削除しない。

視覚表現は「カードを6枚積む」より、番号付き timeline / simple list を優先候補とする。

### About

プロフィールは作品評価前の blocker にしない。

- image
- name
- role
- concise bio
- specialties / services
- X link（full のみ）

に情報 hierarchy を整理。

### Guidelines / FAQ

FAQ を追加する場合の初期項目候補:

- 納期未定でも相談可能か
- 予算未定でも相談可能か
- 商用利用
- 実績公開 / 非公開
- 修正回数
- 参考資料が揃っていない場合

FAQ は `requests` と同じものを二重管理しない。

新規 `faq` field を `PortfolioContent` に追加する場合:

- legacy content fallback を必須
- editor から編集可能
- unknown old JSON を壊さない

### 受け入れ条件

- pricing values / stable IDs が変更されない。
- plan select → structured form の連携が維持。
- showcase に Pricing / direct CTA / SNS が出ない。
- content JSON の旧保存データが parse 可能。

---

## PF-06 Structured form の presentation redesign

### 根拠

A + B。

既存 domain model は保持し、視認性・入力負荷・progressive disclosure の presentation を改善する。

### 変更対象

主対象:

- `PortfolioStructuredCommissionForm.tsx`
- `PortfolioCommissionForm.tsx`
- `PortfolioStyles.tsx`

必要時のみ:

- `lib/portfolioRequestForm.ts`

### 絶対条件

`RequestData V1` shape を UI 都合で変更しない。

### Layout

- form 全体は single primary column
- name/email のような関連 field も、原則 mobile/desktop 共通で1列を初期案とする
- 例外的に同一 entity の tightly coupled controls を横並びにする場合は理由を残す

### Step 1

`consultation` / `quote` の2つを最初に理解できる選択 card とする。

文言候補:

- まず相談したい
  - 内容や予算がまだ固まっていなくても送れます
- 見積もりを依頼したい
  - ある程度決まっている内容を入力します

選択 card は native radio semantics を維持。

### Progressive disclosure

consultation:

- minimum fields を先に表示
- optional details は閉じる

quote:

- request type / usage / budget 等を展開

既存 `pruneHiddenPortfolioRequestFields` の意味を壊さない。

### Field styling

- white surface
- clear visible border
- visible label
- optional / required を text で識別
- focus ring
- error text + `aria-describedby` 等の関連付け
- placeholder を唯一の label にしない

### Error

- error color のみで示さない
- field message を表示
- submit error 時、最初の invalid field への focus/scroll を検討

### Success

現行 success UI の celebratory decoration はブランド判断 C。

最低限:

- 送信完了
- 次に何が起きるか
- 返信目安
- auto reply の有無

を明確にする。

### 受け入れ条件

- consultation の最初の画面で不要な quote fields が視覚的に圧迫しない。
- quote では必要項目へ進める。
- payload snapshot / existing structured form tests が壊れない。
- keyboard only で全入力・送信可能。
- required / optional / error が色だけに依存しない。

---

## PF-07 Mobile / accessibility hardening

### 根拠

A。

### 変更対象

portfolio components 全般。ただし scope は redesign で触れた UI の regression に限定。

### 実装内容

- touch target を十分確保
- sticky header が focus target を隠さない
- mobile horizontal nav の usability を確認
- `PortfolioMobileCta` が content / browser UI と衝突しない
- form 表示中に mobile CTA を隠す既存 IntersectionObserver を維持
- `prefers-reduced-motion` 維持
- modal focus management
- heading hierarchy
- landmarks
- label / fieldset / legend
- semantic button / link の使い分け

### Mobile CTA

文言は Hero primary CTA と揃え、初期候補 `相談・見積もり`。

CTA クリック計測を追加。

### 受け入れ条件

- keyboard tab order が visual order と一致。
- sticky header / floating CTA が focused control を恒常的に隠さない。
- reduced motion で不要 animation が止まる。
- 320px / 375px / 768px / desktop で overflow なし。

---

## PF-08 Image / performance hardening

### 根拠

A + engineering best practice。

### 変更対象

- `PortfolioHero.tsx`
- `PortfolioGallery.tsx`
- image upload/render 関連は必要な範囲のみ

### 実装内容

- Hero main artwork が LCP candidate になる場合は適切に priority/preload を判断
- Gallery first image の `priority` は Hero image 復活後に再評価
- `sizes` を実 layout と一致させる
- explicit aspect ratio / dimensions で CLS を防止
- modal image は初期 page load を不必要に重くしない
- decorative asset を減らす

### 目標

field data で評価するのが理想だが、開発時の目安:

- LCP <= 2.5s
- CLS <= 0.1
- INP <= 200ms

絶対保証ではなく quality target として扱う。

### 受け入れ条件

- redesign によって画像転送量が不必要に増えていない。
- Hero/Gallery の画像で layout shift が起きない。
- mobile で巨大 desktop image を無条件配信しない。

---

## PF-09 Funnel analytics 拡張

### 目的

B/C の設計判断を実際の利用で検証できるようにする。

### 変更対象

- `src/features/natori/data/pageEvents.ts`
- `src/features/natori/server/pageEventsService.ts`
- event trigger を置く portfolio components
- 必要なら admin summary UI

### 新規 event 候補

```text
portfolio_primary_cta_click
portfolio_gallery_open
portfolio_form_start
portfolio_form_mode_select
portfolio_form_submit   // existing
```

label 例:

- primary CTA: `hero` / `mobile_sticky` / `pricing`
- gallery open: work id ではなく必要に応じ title/category。個人情報を入れない
- form mode: `consultation` / `quote`

### 定義

`portfolio_form_start` は単なる form viewport 表示ではなく、ユーザーが最初の interactive field を操作した時の一回だけとする候補。

同一 page session で連打記録しないため client-side ref を使ってよい。

### Server

`/api/natori/track` は allowlist 制なので `NATORI_PAGE_EVENTS` を必ず更新。

### Funnel

最低限確認可能にする。

```text
primary CTA
  ↓
form start
  ↓
mode select
  ↓
form submit
```

Gallery:

```text
page view（GA4等）
  ↓
gallery modal open
  ↓
primary CTA
```

### 注意

traffic が少ない間は小さな差を「有意な改善」と断定しない。

### 受け入れ条件

- client union と server allowlist が一致。
- demo `/etorie/*` は既存通り実 analytics へ混入しない。
- tracking failure で UI が失敗しない。
- form submit の既存計測を二重送信しない。

---

## PF-10 Regression / rollout

### 目的

visual redesign で既存受注機能・showcase 制約を壊さず公開する。

### 対象テスト

既存 test をまず検索し、以下を最低限守る。

- `PortfolioStructuredCommissionForm` tests
- portfolio content compatibility tests
- request form pure function tests
- plan selection behavior
- showcase rendering restrictions
- page events allowlist / tracking behavior

### 新規/更新テスト候補

1. full variant に pricing/form/CTA がある。
2. showcase variant に pricing/form/status/SNS/direct CTA がない。
3. plan click が `PLAN_SELECT_EVENT` を通して structured form selection を更新。
4. consultation/quote switching で hidden payload が prune される。
5. form submit event が成功時のみ記録される。
6. new analytics event が server allowlist と一致。

### Manual check

Desktop:

- Chrome current
- keyboard only

Mobile:

- 375px class viewport
- touch interaction
- sticky header / CTA overlap

確認フロー:

```text
open portfolio
→ Hero CTA
→ form consultation
→ back / change quote
→ pricing plan select
→ form auto selection
→ attach image / reference URL
→ validation error
→ successful demo submit
```

showcase:

```text
open /natori/works
→ inspect source-visible UI
→ no price
→ no commission status
→ no form
→ no X / tsunagu direct link
```

### Release gate

以下が完了するまで全 redesign を一括公開しない。

- PF-02 token contrast review
- PF-03〜PF-06 responsive review
- structured form existing tests pass
- showcase restriction review
- no TypeScript errors introduced
- targeted tests pass
- manual full + showcase path check

---

## 8. 実装上の優先順位

### Must

- visual complexity reduction
- Hero purpose clarity
- artwork-first Gallery
- Pricing / workflow hierarchy
- structured form presentation
- accessibility contrast/focus
- showcase non-commercial boundary preservation

### Should

- FAQ
- modal focus trap / return
- funnel event expansion
- Hero representative artwork

### Could

- stronger micro-interactions
- category-specific work detail
- artwork → prefilled inquiry context
- formal experiment framework

「Could」は Must/Should を完了する前に実装しない。

---

## 9. 変更しない既存 contract

以下を redesign の都合で壊さない。

- `PortfolioVariant = "full" | "showcase"`
- `PortfolioPlan.id` stable ID
- `PortfolioOption.id` stable ID
- `PLAN_SELECT_EVENT`
- `RequestData V1`
- contact API multipart behavior
- reference image limits
- reference link limits
- CSRF handling
- tracking fire-and-forget behavior
- demo `/etorie/*` analytics exclusion

---

## 10. Codex 作業ルール

Codex に各 ticket を依頼する際は次の手順を守る。

1. `AGENTS.md` を読む。
2. `CLAUDE.md` を読む。
3. 本書を読む。
4. 指定 ticket の最新対象ファイルを読む。
5. ticket 外の broad refactor をしない。
6. 既存 test / usage を検索してから編集する。
7. 新 dependency を追加する前に、既存 stack で達成できないか確認する。
8. 実装後、変更ファイルと acceptance criteria の対応を列挙する。
9. targeted tests / typecheck を実行する。
10. screenshot / browser verification が可能なら desktop + mobile を確認する。

### Codex への依頼例

```text
AGENTS.md、CLAUDE.md、docs/natori-portfolio-research-driven-redesign-plan.md を読んでください。
今回は PF-04 Gallery redesign だけを実装してください。
PF-04 の非対象までリファクタしないでください。
実装後、変更ファイル、受け入れ条件ごとの確認結果、実行したテストを報告してください。
```

---

## 11. 現時点の設計判断ログ

| ID | 判断 | Level | 状態 |
|---|---|---|---|
| D-01 | visual complexity を現行より下げる | A/B | 採用 |
| D-02 | artwork を装飾より視覚優先する | B | 採用 |
| D-03 | form は single primary column | A | 採用 |
| D-04 | Warm neutral + muted rose を初期 palette とする | C | 仮採用、visual review 対象 |
| D-05 | decorative pink/mint/yellow/peach 同時使用をやめる | B/C | 仮採用 |
| D-06 | Gallery の tape/rotation を削減する | B/C | 仮採用 |
| D-07 | Hero に代表 artwork を戻す | B | 仮採用 |
| D-08 | About を作品・依頼条件より後ろへ置く | B | 仮採用、analytics 対象 |
| D-09 | consultation / quote domain contract は維持 | existing architecture | 採用 |
| D-10 | showcase の直接取引導線禁止を維持 | existing product requirement | 採用 |

---

## 12. 最初に着手する ticket

**PF-00 → PF-01 → PF-02** の順。

いきなり Gallery や Form の CSS から変更しない。

理由:

- baseline がないと改善前後を比較できない
- section order を後から変えると Hero / CTA / spacing を二度作る
- token が未確定だと各 component に個別色が再発する

PF-02 終了時点で desktop / mobile screenshot を一度レビューし、D-04〜D-07 の C/B判断を確定してから PF-03 以降へ進む。

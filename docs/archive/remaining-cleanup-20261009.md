# 残る未参照候補の台帳（2026-10-09）

#143の途中head `6b060d7b` で追跡JS/TS 1,047件を解析し、Next自動entryとtest自身を
候補から除いた呼出元0のsrcは41件だった。import/re-export/literal dynamic import/require/
import typeの呼出元にはtests/scriptsも含め、configとreadFileSyncの非import参照を別途調べた。
このうち7件を#143の後続コミットで整理し、以下34件を保持する。
「呼出元0」は削除許可を意味しない。既存公開表示・運用・CSS・テストの境界に応じて分類した。

| # | Exact path | Decision | Evidence / next gate |
| ---: | --- | --- | --- |
| 1 | `src/app/[locale]/float/FloatPageClient.tsx` | Further evidence | Unused dynamic wrapper; the actual page uses `FloatGalleryClient`. Preserve public-gallery layout until CSS and actual 3D/2D browser comparison. Keep underlying FloatGallery. |
| 2 | `src/app/[locale]/white/WhitePageClient.tsx` | Further evidence | Unused dynamic wrapper; the actual page uses `WhiteGalleryClient`. Same public-gallery visual gate; keep underlying WhiteGallery. |
| 3 | `src/app/admin/_components/SyncDisplayReadyButton.tsx` | Further evidence | Unreferenced UI issues POST `/admin/api/entries/sync-display-ready`. Caller removal could be safe, but first document the paused admin writer boundary and compare CSS; keep API and pause policy. |
| 4 | `src/app/admin/users/AdminUsersClient.tsx` | Further evidence | Unreferenced list UI; no adjacent list `page.tsx` remains, while `[artist_name]` detail page is live. It reads `/admin/api/users` and exports CSV. Separate old-admin audit, CSS check and customer-support map before deletion. |
| 5 | `src/components/DesktopHome.tsx` | Further evidence | Orphan legacy home root with hooks/home/gallery dependencies and many CSS candidates. Avoid root/privacy/gallery changes; map whole closed subtree and compare public CSS before a future unit. |
| 6 | `src/components/MobileHome.tsx` | Further evidence | Same as DesktopHome; both must be considered together before classifying shared hooks as unused. |
| 7 | `src/components/aura/AuraDegreeSlider.tsx` | Further evidence | Zero runtime callers, but removing all four AURA candidates drops 39 selectors. Saved-theme class passthrough is a concrete remaining dependency risk; see below. |
| 8 | `src/components/aura/AuraIntroOverlay.tsx` | Further evidence | Zero callers; sessionStorage/listener/timer logic only runs if mounted. The CSS compatibility gate still applies. |
| 9 | `src/components/aura/AuraWorldviewSelector.tsx` | Further evidence | Zero callers; only type import is live `WorldviewBase`. The CSS compatibility gate applies; retain worldview presets. |
| 10 | `src/components/aura/sections/AuraHeroCentered.tsx` | Further evidence | Not in the actual RendererV1 path (HeroSwitcher uses HeroMinimal). Its classes nevertheless contribute to global CSS; saved-theme class gate applies. |
| 11 | `src/components/floatGallery/DayLight.tsx` | Further evidence | No imports; public-gallery lighting classification and rendered comparison remain outside this batch. |
| 12 | `src/components/floatGallery/FloatAvatarController.tsx` | Further evidence | No imports; depends on shared panel constants. Keep constants and actual avatar/controller path; compare 3D control behavior before removal. |
| 13 | `src/components/floatGallery/FloatOutsideWorld.tsx` | Further evidence | No imports; owns a potential closed branch with `floatOutside.constants.ts`. Public scenery/assets review required; no material/texture deletion inferred. |
| 14 | `src/components/floatGallery/FloatPanelsCenter.tsx` | Further evidence | No imports; thin wrapper imports retained `FloatPanels`. Gallery visual gate; do not remove underlying panels. |
| 15 | `src/components/floatGallery/FloatWalls.tsx` | Further evidence | No imports; sharedGeometry remains required by other rendering files. Gallery visual/material review first. |
| 16 | `src/components/floatGallery/GalleryLighting.tsx` | Further evidence | No imports; uses sharedGeometry, has coordination comments with FloatWalls. Review public lighting and preserve shared geometry. |
| 17 | `src/components/legal/LegalNotices.tsx` | Further evidence | No imports, but terms/refund/delivery text and legal links. Confirm archived operation/documentation scope separately; no legal-policy edit implied by cleanup. |
| 18 | `src/components/purchase/NormalPurchaseButton.tsx` | Further evidence | No imports; contains suspended new-Checkout request and disabled notice. Establish mapping to retained purchase fulfillment/return paths and compare CSS before removing this UI alone. |
| 19 | `src/components/shared/CookieConsent.tsx` | Keep this phase | Privacy/root area overlaps unresolved PR #133; no unilateral integration or removal. Zero imports does not settle the product/privacy decision. |
| 20 | `src/components/shared/Footer.tsx` | Keep this phase | Orphan footer with privacy/legal/admin links; root/privacy scope excluded. |
| 21 | `src/components/shared/GalleryWelcomeMessage.tsx` | Further evidence | Orphan public gallery guide UI with localStorage state. Preserve gallery behavior until visual/control review. |
| 22 | `src/components/shared/InstallPwaNotice.tsx` | Further evidence | Orphan user-agent-dependent PWA instruction UI; mobile/public appearance and CSS need separate verification. |
| 23 | `src/components/shared/VirtualJoystick.tsx` | Further evidence | Orphan joystick wrapper, including touchmove listener. Keep actual `JoystickInput`, react-nipple package/types and public gallery controls. |
| 24 | `src/components/ui/separator.tsx` | Further evidence | No imports; may permit later removal of `@radix-ui/react-separator`, but requires its own full source/class/lock closure check. Excluded from the proven six-file unit. |
| 25 | `src/features/natori/components/WorkCard.tsx` | Keep this phase | Natori protected scope; this file is distinct from the live nested `PortfolioWorkCard` and AURA/CARD WorkCard helpers. Feature-specific visual proof required. |
| 26 | `src/features/natori/components/dashboard/ScheduleSummary.tsx` | Keep this phase | Natori protected scope; stub returns null and imports scheduling types. Do not fold Natori cleanup into legacy cleanup. |
| 27 | `src/features/natori/components/dashboard/StructuredEstimateSuggestionPanel.tsx` | Keep this phase | Natori estimate/pricing boundary; no importer alone is insufficient for feature-specific retirement. Preserve schemas, pricing and quote workflow. |
| 28 | `src/features/natori/components/dashboard/StructuredPricingEditor.tsx` | Keep this phase | Natori pricing writer UI and shared pricing config/data imports; feature-specific retirement/Phase acceptance required. |
| 29 | `src/features/natori/components/dashboard/StructuredQuoteIssuePanel.tsx` | Keep — actual source-test consumer | `StructuredQuoteIssuePanelSource.test.ts` reads this exact file with readFileSync and asserts retry-lock semantics. Deletion would break mandatory tests; it is not unreferenced in the broader sense. |
| 30 | `src/features/natori/components/portfolio/Sparkle.tsx` | Keep this phase | Protected Natori visual scope and portfolio design tokens. No deletion without Natori visual verification. |
| 31 | `src/features/natori/constants/request.ts` | Keep this phase | Protected Natori request constants/types. Separate request-flow audit, not this legacy batch. |
| 32 | `src/i18n/request.ts` | Keep — framework entry | `next.config.mjs` passes this exact path to createNextIntlPlugin. It also performs the sole nonliteral locale-JSON import. |
| 33 | `src/test/mocks/publicCommissionAvailability.ts` | Keep — test alias entry | `vitest.config.ts` maps the production service import to this exact mock path. Static module imports deliberately do not point to it. |
| 34 | `src/types/react-nipple.d.ts` | Keep — ambient declaration until wrapper retirement | TypeScript includes this declaration automatically and still typechecks `VirtualJoystick.tsx`, the sole react-nipple importer. Live `JoystickInput` is a separate custom implementation without react-nipple. Retire wrapper+declaration+dependency together only after the dedicated gallery-controls review. |

新たにimport上孤立する `src/lib/design/tokens.ts` は22種類のCSS入力なので保持する。
DesktopHome/MobileHomeからのhooks、FloatOutsideWorldの定数も閉じた依存群として別途調べ、
ファイル単独のgrep結果から削除しない。src/i18n/request.tsのlocale JSON取得以外に
非literal module importは見つからなかった。

AURA4部品を除くと39 selectorが消える。公開aura/pは保存designをschemaで再検証せず渡し、
AuraHeroMinimalは`ai-portfolio-font-`で始まるfontPreset全体をclassとして返す。
例えば保存値に`md:px-4`を併記していると、孤立部品だけに残るCSSを現行公開Heroが使い得る。
これは可能な条件であり、本番にその値があったという報告ではない。公開データ/DOM確認か、
別単位での互換CSS保持と完全一致の証明を先に行う。#143自体の生成CSSは変更しない。

画像・フォント・DB・Storageはこのimport解析の削除候補に含めない。#133のprivacy/root、
#135の動画、Natoriの現役導線・料金・見積・案件管理は別担当/別単位の判断を維持する。

## 2026-10-10の判断更新

上表7〜10のAURA4部品は、休止済みStudio画面の整理と合わせて削除した。
削除で失われるCSS入力は`tailwind.config.js`の互換safelistへ残し、同条件で生成した
変更前後のCSSがバイト単位で完全一致することを確認した。保存済みテーマのclassも保護する。
正確な対象、固定SHA、原本ハッシュ、CSS検証は
[legacy-display-20261010.md](legacy-display-20261010.md)を参照。
この更新はほかの30候補の削除判断を変更しない。

/**
 * Look of the case workspace (案件・予定・トーク・ページ): calm, Apple-like grouped lists —
 * light grey ground, white rounded groups with hairline separators, large bold titles,
 * a segmented control for filters and one pink accent. Text uses the admin's system font.
 * Older admin pages keep `natoriAdminUi`.
 */
import { natoriAdminUi } from "./adminUi";

export const workspaceLook = {
  /** 主ボタン（ピンク塗り）と副ボタン（白）。案件画面のすべてのパネルはこの2種だけを使う。 */
  btnPrimary: natoriAdminUi.btnPrimary,
  btnSecondary: natoriAdminUi.btnSecondary,
  btnLink: natoriAdminUi.btnLink,
  /** 白い角丸の面。枠線や影は付けない（iOS のグループと同じ）。 */
  cardPadded: "rounded-2xl bg-white p-4 sm:p-5",
  /** 送る・保存する前の確認。淡いピンクの面にピンク1色の枠。 */
  confirm: "space-y-3 rounded-2xl border-2 border-pink-200 bg-pink-50 p-4",
  /** 面の中の薄い灰色の小さな区画（一覧の1件など）。 */
  inset: "rounded-xl bg-[#F2F2F7] p-3",
  page: "min-h-screen min-h-dvh bg-[#F2F2F7] text-[#1C1C1E]",
  header: "sticky top-0 z-20 border-b border-black/10 bg-[#F2F2F7]/85 backdrop-blur-xl backdrop-saturate-150 [@media(prefers-reduced-transparency:reduce)]:bg-[#F2F2F7] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
  brand: "text-[20px] font-bold tracking-[-0.02em]",
  title: "font-bold tracking-[-0.02em]",
  /** Large title at the top of a tab, as in iOS. */
  largeTitle: "text-[30px] font-bold leading-9 tracking-[-0.03em]",
  /** Small grey label above a group. */
  groupLabel: "px-4 text-[13px] font-normal text-[#6E6E73]",
  /** White rounded group whose rows are split by hairlines. */
  group: "overflow-hidden rounded-2xl bg-white divide-y divide-black/[0.08]",
  /** One tappable row inside a group. */
  groupRow: "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/[0.03] active:bg-black/[0.06]",
  card: "rounded-2xl bg-white p-4",
  row: "rounded-2xl bg-white",
  /** The open step's work area. */
  work: "rounded-2xl bg-white",
  /** Segmented control: grey track, the chosen segment is a raised white pill. */
  segments: "flex rounded-[10px] bg-[#767680]/[0.12] p-0.5",
  segmentOn: "bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]",
  segmentsLg: "lg:rounded-[10px] lg:bg-[#767680]/[0.12] lg:p-0.5",
  segmentOff: "text-[#3C3C43]",
  muted: "text-[#6E6E73]",
} as const;

/**
 * Look of the case workspace (案件・予定・トーク・ページ): calm, Apple-like grouped lists —
 * light grey ground, white rounded groups with hairline separators, large bold titles,
 * a segmented control for filters and one pink accent. Text uses the admin's system font.
 * Older admin pages keep `natoriAdminUi`.
 */
export const workspaceLook = {
  page: "min-h-screen bg-[#F2F2F7] text-[#1C1C1E]",
  header: "sticky top-0 z-20 border-b border-black/10 bg-[#F2F2F7]/85 backdrop-blur-xl",
  brand: "text-[20px] font-bold tracking-[-0.02em]",
  title: "font-bold tracking-[-0.02em]",
  /** Large title at the top of a tab, as in iOS. */
  largeTitle: "text-[30px] font-bold leading-9 tracking-[-0.03em]",
  /** Small grey label above a group. */
  groupLabel: "px-4 text-[13px] font-normal text-[#6E6E73]",
  /** White rounded group whose rows are split by hairlines. */
  group: "overflow-hidden rounded-2xl bg-white divide-y divide-black/[0.08]",
  /** One tappable row inside a group. */
  groupRow: "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] active:bg-black/[0.06]",
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

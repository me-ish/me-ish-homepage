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

  /*
   * 開いた段階の中身（案件詳細）の決まり。
   * 文字は 20（あなた：〜）／17（ブロックの見出し）／15（本文）／13（補足）の4段。入力欄だけは iPhone の拡大を防ぐため 16px。
   * 面は「白の中は灰、灰の中は線」。白い作業面の中の白いブロックには細い線を付けて境目を見せる。
   */
  /** ブロックの見出し（本文より大きく太い黒）。 */
  sectionTitle: "text-[17px] font-bold leading-6 text-[#1C1C1E]",
  /** 本文。 */
  body: "text-[15px] leading-7 text-[#1C1C1E]",
  /** 補足（日時・説明の一文など）。白と灰色の面の両方で 4.5:1 以上になる灰色。 */
  meta: "text-[13px] leading-5 text-[#636366]",
  /** 段階の名前の下の要約。補足より濃くする。 */
  stepSummary: "text-[13px] leading-5 text-[#3C3C43]",
  /** 「要確認」の札。色だけに頼らず、必ず「要確認」の文字を添える（CaseNeedsCheck）。 */
  needsCheck: "inline-flex max-w-full items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[13px] font-semibold leading-5 text-amber-950 ring-1 ring-amber-300",
  needsCheckTag: "shrink-0 rounded bg-amber-300 px-1.5 text-[12px] font-bold leading-5 text-amber-950",
  /** ラベルと値の行。スマホは左右に振り分け、広い画面ではラベルの幅をそろえて値をすぐ右に置く。 */
  fieldRow: "flex items-baseline justify-between gap-3 border-b border-black/[0.08] py-2.5 text-[15px] sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:justify-normal",
  fieldLabel: "shrink-0 text-[#636366]",
  fieldValue: "min-w-0 text-right font-semibold text-[#1C1C1E] sm:text-left",
  /** 開いた段階の中のパネル（白の中の白なので細い線で区切る）。 */
  panel: "rounded-2xl bg-white p-4 ring-1 ring-black/[0.12] sm:p-5",
  /** 「…の記録」の開閉。外は線の枠、中の1件ずつは灰色の面。 */
  records: "group rounded-2xl bg-white ring-1 ring-black/[0.12]",
  recordsSummary: "flex min-h-12 list-none gap-3 [&::-webkit-details-marker]:hidden cursor-pointer items-center rounded-2xl px-4 py-3 text-[15px] font-semibold text-[#1C1C1E]",
  recordBlock: "rounded-xl bg-[#F2F2F7] p-4",
  /** 灰色の面の中の区切り線。 */
  recordDivider: "border-t border-black/[0.1]",
  /** 開閉できる行の右端の「›」。開くと下を向く。 */
  disclosure: "ml-auto shrink-0 text-xl leading-none text-[#8E8E93] transition-transform group-open:rotate-90 motion-reduce:transition-none",
  /** 作業パネルで、いまこの案件で使うフォーム。 */
  workNow: "space-y-4 rounded-2xl bg-white p-4 ring-2 ring-pink-300 sm:p-5",
  workNowTag: "text-[13px] font-semibold leading-5 text-[#BE185D]",
  /** いまは使わないフォーム。1行に畳み、押すと開く。 */
  workFolded: "group rounded-2xl bg-white ring-1 ring-black/[0.12]",
  workFoldedSummary: "flex min-h-14 list-none [&::-webkit-details-marker]:hidden cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[#1C1C1E]",
} as const;

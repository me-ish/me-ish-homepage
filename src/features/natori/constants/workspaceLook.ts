/**
 * Look of the case workspace (案件・予定・通知・ページ): the public portfolio's soft hand-drawn feel —
 * warm paper ground, Zen Maru headings, slightly uneven ink outlines and the pink / light-blue / orange trio.
 * Older admin pages keep `natoriAdminUi`.
 */
// The site loads Zen Maru Gothic through next/font, which only exposes it as --font-zen.
const zen = "[font-family:var(--font-zen,'Zen_Maru_Gothic'),sans-serif]";

export const workspaceLook = {
  zen,
  page: "min-h-screen bg-[#FBF7F4] text-zinc-900",
  header: "border-b-2 border-dashed border-pink-200 bg-[#FBF7F4]",
  brand: `${zen} text-[22px] font-bold tracking-tight`,
  title: `${zen} font-bold tracking-tight`,
  /** Hand-drawn card: uneven corners, ink outline, a soft pink offset shadow. */
  card: "rounded-[18px_14px_20px_13px] border-[1.5px] border-[#3B2F33] bg-white p-4 shadow-[3px_3px_0_#FBCFE8]",
  cardHover: "transition-transform motion-safe:hover:-translate-y-px hover:shadow-[4px_4px_0_#F9A8D4]",
  /** Lighter outline for short rows and secondary boxes. */
  row: "rounded-[14px_11px_15px_10px] border-[1.5px] border-[#3B2F33]/25 bg-white",
  /** The open step's work area. */
  work: "rounded-[22px_16px_24px_15px] border-2 border-[#3B2F33] bg-white shadow-[4px_4px_0_#FBCFE8]",
  chipOn: "border-pink-700 bg-pink-700 text-white",
  chipOff: "border-[#3B2F33]/25 bg-white text-zinc-700 hover:border-pink-300",
  tab: zen,
} as const;

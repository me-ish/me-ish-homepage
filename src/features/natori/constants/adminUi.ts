import { natoriPrimaryActionClassName } from "./natoriPrimaryAction";

/**
 * Class recipes for the natori admin pages (dashboard / inquiries / projects /
 * estimate / results / portfolio edit / links edit).
 *
 * The public portfolio keeps its own tokens (`portfolioColors` /
 * `portfolioFormColors`); do not mix these into public pages.
 *
 * Look: neutral canvas, white surfaces with hairline borders and a very soft
 * shadow. The brand pink is kept for actions, the active place and accents.
 * The admin font (system gothic + palt) is applied in globals.css through
 * `[data-natori-admin]` on the page shell.
 *
 * Note: tailwind.config.js overrides `text-base` = 18px / `text-lg` = 20px /
 * `text-xl` = 24px. `text-sm` = 14px and `text-xs` = 12px are standard.
 */
const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]";
const btnBase = `inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors duration-150 sm:h-10 ${focus}`;
/** Hairline border + barely visible shadow shared by surfaces. */
const surface = "border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]";

export const natoriAdminUi = {
  page: "min-h-screen bg-[#F7F7F8] text-zinc-900",
  container: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  pageBody: "py-5 sm:py-8 space-y-4 sm:space-y-6",
  pageTitle: "text-xl font-bold leading-8 tracking-tight text-zinc-900", // 24px
  sectionTitle: "text-[16px] font-semibold leading-6 text-zinc-900",
  groupLabel: "text-xs font-semibold text-zinc-600",
  body: "text-sm leading-6 text-zinc-700",
  caption: "text-xs leading-5 text-zinc-600",
  surface,
  card: `rounded-2xl ${surface} p-4 sm:p-5`,
  cardInset: "rounded-xl border border-zinc-200/80 bg-zinc-50 p-3",
  /** Clickable card: lifts slightly on hover. */
  cardInteractive: "transition-[border-color,box-shadow,transform] duration-150 hover:border-zinc-300 hover:shadow-[0_4px_16px_-4px_rgba(24,24,27,0.10)] motion-safe:hover:-translate-y-px",
  /** Small rounded square that holds a section / card icon. */
  iconTile: "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-50 text-[#DB2777] ring-1 ring-inset ring-pink-500/10",
  /** Same tile for settings / records (not a main action). */
  iconTileNeutral: "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-500/10",
  btnPrimary: `${btnBase} border shadow-[0_1px_2px_rgba(131,24,67,0.18)] ${natoriPrimaryActionClassName}`,
  btnSecondary: `${btnBase} border border-zinc-200 bg-white text-zinc-800 shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 disabled:shadow-none`,
  btnDanger: `${btnBase} border border-red-200 bg-white text-red-700 shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 disabled:shadow-none`,
  btnDangerSolid: `${btnBase} border border-red-700 bg-red-700 text-white hover:bg-red-800`,
  btnLink: `inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#BE185D] underline-offset-4 hover:underline ${focus}`,
  btnIcon: `grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-[0_1px_2px_rgba(24,24,27,0.05)] transition-colors hover:border-zinc-300 hover:bg-zinc-50 sm:h-9 sm:w-9 ${focus}`,
  label: "mb-1.5 block text-xs font-semibold text-zinc-700",
  required: "ml-1 text-xs font-semibold text-[#BE185D]", // 表示文字「必須」
  input:
    "w-full rounded-xl border border-[#878287] bg-white px-3 py-2.5 text-[16px] font-normal leading-6 text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-colors placeholder:text-zinc-500 focus:border-[#BE185D] focus:outline-none focus:ring-4 focus:ring-[#BE185D]/15 disabled:bg-zinc-100 disabled:text-zinc-600",
  hint: "mt-1 text-xs leading-5 text-zinc-600",
  fieldError: "mt-1 text-xs font-semibold leading-5 text-red-700",
  checkbox: "h-5 w-5 shrink-0 accent-[#BE185D]",
  tableWrap: `overflow-x-auto rounded-2xl ${surface}`,
  th: "bg-zinc-50/80 px-3 py-2.5 text-left text-xs font-semibold text-zinc-600",
  td: "px-3 py-3 text-sm text-zinc-800",
  tr: "border-t border-zinc-100 transition-colors hover:bg-zinc-50/80",
  badge: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
  badgeTone: {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    info: "bg-sky-50 text-sky-800 ring-sky-600/20",
    warning: "bg-amber-50 text-amber-900 ring-amber-600/25",
    danger: "bg-red-50 text-red-800 ring-red-600/20",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  },
  alert: {
    info: "rounded-xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-inset ring-sky-600/15",
    warning: "rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20",
    error: "rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-inset ring-red-600/15",
    success: "rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/15",
  },
  chip: "inline-flex h-11 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm font-semibold transition-colors sm:h-8 sm:text-xs",
  chipOn: "border-[#BE185D] bg-[#BE185D] text-white shadow-[0_1px_2px_rgba(131,24,67,0.18)]",
  chipOff: "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
  /** Segmented control (two or three exclusive views). */
  segment: "inline-flex rounded-full bg-zinc-200/60 p-1",
  segmentItem: `inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors sm:h-8 sm:text-xs ${focus}`,
  segmentOn: "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.12)]",
  segmentOff: "text-zinc-600 hover:text-zinc-900",
} as const;

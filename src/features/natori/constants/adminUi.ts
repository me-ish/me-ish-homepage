import { natoriPrimaryActionClassName } from "./natoriPrimaryAction";

/**
 * Class recipes for the natori admin pages (dashboard / inquiries / projects /
 * estimate / results / portfolio edit / links edit).
 *
 * The public portfolio keeps its own tokens (`portfolioColors` /
 * `portfolioFormColors`); do not mix these into public pages.
 *
 * Note: tailwind.config.js overrides `text-base` = 18px / `text-lg` = 20px /
 * `text-xl` = 24px. `text-sm` = 14px and `text-xs` = 12px are standard.
 */
const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]";
const btnBase = `inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition sm:h-10 ${focus}`;

export const natoriAdminUi = {
  page: "min-h-screen bg-[#FFF8FA] text-gray-900",
  container: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
  pageBody: "py-4 sm:py-6 space-y-4 sm:space-y-6",
  pageTitle: "text-lg font-black leading-7 text-gray-900", // 20px
  sectionTitle: "text-[16px] font-bold leading-6 text-gray-900",
  groupLabel: "text-xs font-bold text-gray-600",
  body: "text-sm leading-6 text-gray-800",
  caption: "text-xs leading-5 text-gray-600",
  card: "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5",
  cardInset: "rounded-xl border border-gray-200 bg-gray-50 p-3",
  btnPrimary: `${btnBase} border ${natoriPrimaryActionClassName}`,
  btnSecondary: `${btnBase} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`,
  btnDanger: `${btnBase} border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`,
  btnDangerSolid: `${btnBase} border border-red-700 bg-red-700 text-white hover:bg-red-800`,
  btnLink: `inline-flex min-h-11 items-center text-sm font-bold text-[#BE185D] underline-offset-4 hover:underline ${focus}`,
  btnIcon: `grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 sm:h-9 sm:w-9 ${focus}`,
  label: "mb-1.5 block text-xs font-bold text-gray-700",
  required: "ml-1 text-xs font-bold text-[#BE185D]", // 表示文字「必須」
  input:
    "w-full rounded-lg border border-[#878287] bg-white px-3 py-2.5 text-[16px] leading-6 text-gray-900 placeholder:text-gray-500 focus:border-[#BE185D] focus:outline-none focus:ring-2 focus:ring-[#BE185D]/25 disabled:bg-gray-100 disabled:text-gray-600",
  hint: "mt-1 text-xs leading-5 text-gray-600",
  fieldError: "mt-1 text-xs font-bold leading-5 text-red-700",
  checkbox: "h-5 w-5 shrink-0 accent-[#BE185D]",
  tableWrap: "overflow-x-auto rounded-2xl border border-gray-200 bg-white",
  th: "bg-gray-50 px-3 py-2.5 text-left text-xs font-bold text-gray-600",
  td: "px-3 py-3 text-sm text-gray-800",
  tr: "border-t border-gray-100 hover:bg-[#FFF8FA]",
  badge: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold",
  badgeTone: {
    neutral: "border-gray-300 bg-gray-50 text-gray-700",
    info: "border-sky-300 bg-sky-50 text-sky-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-red-300 bg-red-50 text-red-800",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  alert: {
    info: "rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900",
    warning: "rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900",
    error: "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800",
    success: "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900",
  },
  chip: "inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-sm font-bold sm:h-9 sm:text-xs",
  chipOn: "border-[#BE185D] bg-[#BE185D] text-white",
  chipOff: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
} as const;

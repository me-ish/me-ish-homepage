import { natoriPrimaryActionClassName } from "./natoriPrimaryAction";

/**
 * Class recipes for the pages a client opens from Natori's mails:
 * quote acceptance, delivery, consultation and their notice states.
 *
 * Look: the public portfolio (`portfolioColors`) — warm white page, white
 * cards with a pale pink hairline, Zen Maru Gothic, the brand pink #EC4899 for
 * decoration and #BE185D for white-text actions and small pink text.
 *
 * Sizes are written in px on purpose: globals.css shrinks the root font to
 * 14px below 640px, and the client's reading text should not shrink with it.
 * Admin screens use `natoriAdminUi` instead; do not mix the two.
 */
const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#831843]";

export const natoriClientUi = {
  page: "min-h-screen bg-[#FFFEFE] bg-[linear-gradient(180deg,#FFF5F9_0px,#FFFEFE_360px)] text-[15px] leading-7 text-[#242027]",
  header: "border-b border-[#F2D9E0] bg-white",
  brand: "text-[15px] font-bold tracking-[0.06em]",
  brandAccent: "text-[#EC4899]",
  container: "mx-auto w-full max-w-2xl px-4 sm:px-6",
  title: "text-[24px] font-bold leading-snug tracking-[0.04em] text-balance [word-break:auto-phrase] md:text-[28px]",
  /** Wrap Japanese at phrase boundaries (Chrome); long phrases still break. */
  phrase: "break-words [word-break:auto-phrase]",
  card: "rounded-3xl border border-[#F2D9E0] bg-white p-5 shadow-[0_10px_22px_rgba(0,0,0,0.06)] sm:p-8",
  /** Pale pink panel inside a card (summary, consent, quoted text). */
  panel: "rounded-2xl bg-[#FFF8FA] ring-1 ring-inset ring-[#F7E1E9]",
  heading: "text-[18px] font-bold leading-7 text-balance [word-break:auto-phrase]",
  body: "text-[15px] leading-7",
  small: "text-[13px] leading-6",
  muted: "text-[#6B6470]",
  /** Field / row label: muted, small, bold. */
  label: "text-[13px] font-bold leading-6 text-[#6B6470]",
  /** Row separators inside a card. */
  divider: "divide-y divide-[#F6E3E9]",
  badge: "inline-flex items-center rounded-full bg-[#FFF0F6] px-3 py-1 text-[12px] font-bold leading-5 text-[#BE185D]",
  /**
   * Main CTA. No color transition on purpose: the contrast checks read the
   * colors right after a state change (checkbox → enabled, hover).
   */
  btnPrimary: `${natoriPrimaryActionClassName} inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[16px] font-bold leading-snug shadow-[0_6px_16px_-6px_rgba(190,24,93,0.45)] disabled:shadow-none sm:px-6`,
  btnSecondary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E3DDE0] bg-white px-4 text-[14px] font-bold text-[#242027] transition-colors hover:border-[#D8C4CC] hover:bg-[#FFF8FA] disabled:cursor-not-allowed disabled:bg-[#F6F4F5] disabled:text-[#6B6470] ${focus}`,
  link: `font-bold text-[#242027] underline decoration-[#EC4899] decoration-2 underline-offset-4 transition-colors hover:text-[#BE185D] ${focus}`,
  alertError: "rounded-2xl border border-[#F7C9C4] bg-[#FEF3F2] px-4 py-3 text-[14px] font-bold leading-6 text-[#B42318]",
  alertWarning: "rounded-2xl border border-[#F3D9AE] bg-[#FFF8EB] px-4 py-3 text-[14px] leading-6 text-[#8A4800]",
  alertSuccess: "rounded-2xl border border-[#BCE8DA] bg-[#E8FFF8] px-4 py-4 text-[15px] font-bold leading-7 text-[#00664F]",
  focus,
} as const;

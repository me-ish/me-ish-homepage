/** Shared important CTA colors. Brand decoration and input states stay independent. */
export const natoriPrimaryActionColors = {
  normal: { background: "#BE185D", foreground: "#FFFFFF" },
  hover: { background: "#9D174D", foreground: "#FFFFFF" },
  focus: { background: "#BE185D", foreground: "#FFFFFF" },
  disabled: { background: "#FBCFE8", foreground: "#242027" },
  focusRing: "#831843",
} as const;

// Explicit colors also remain readable when a surrounding app changes its theme.
// Disabled text is not faded; state is communicated by color and the native attribute.
export const natoriPrimaryActionClassName =
  "bg-[#BE185D] text-white border-[#9D174D] [&:not(:disabled):hover]:bg-[#9D174D] focus-visible:bg-[#BE185D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#831843] disabled:bg-[#FBCFE8] disabled:text-[#242027] disabled:opacity-100 disabled:cursor-not-allowed";

/**
 * ポートフォリオ（公開ページ）の入口 CTA 用。濃いマゼンタ塗りだと絵より目立ちすぎるので、
 * 淡いピンク塗り＋手描き線の墨色の縁＋濃い文字にする（「貼った紙」ボタン。厚みの影は .pf-btn が付ける）。
 * フォームの送信ボタンは natoriPrimaryAction のまま。
 */
export const natoriSoftActionColors = {
  normal: { background: "#FFD3E2", foreground: "#242027" },
  hover: { background: "#FFC6DE", foreground: "#242027" },
  border: "#3B2F33",
  focusRing: "#831843",
} as const;

export const natoriSoftActionClassName =
  "bg-[#FFD3E2] text-[#242027] border-[#3B2F33] hover:bg-[#FFC6DE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#831843]";

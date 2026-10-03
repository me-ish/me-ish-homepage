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

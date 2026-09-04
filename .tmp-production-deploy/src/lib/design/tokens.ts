/**
 * me-ish Design Tokens
 *
 * デザインの一貫性を保つための共通トークン定義。
 * Tailwind クラス名として直接使用できます。
 */

// ============================================
// Colors
// ============================================
export const COLORS = {
  // Primary (me-ish blue)
  primary: {
    DEFAULT: 'text-meish',
    bg: 'bg-meish',
    bgLight: 'bg-meish-50',
    bgMedium: 'bg-meish-100',
    border: 'border-meish',
    ring: 'ring-meish',
    hover: 'hover:bg-meish-600',
    gradient: 'bg-gradient-to-r from-meish to-meish-600',
    gradientHover: 'hover:from-meish-600 hover:to-meish-700',
  },

  // Text
  text: {
    heading: 'text-meish-text-heading',    // #002233
    body: 'text-meish-text-body',          // gray-700
    muted: 'text-meish-text-muted',        // gray-500
    subtle: 'text-meish-text-subtle',      // gray-400
  },

  // Semantic
  success: {
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  error: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  warning: {
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
} as const;

// ============================================
// Border Radius
// ============================================
export const RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-lg',       // 8px - small elements
  md: 'rounded-xl',       // 12px - inputs, small cards
  lg: 'rounded-2xl',      // 16px - cards, modals
  xl: 'rounded-3xl',      // 24px - large cards, sections
  full: 'rounded-full',   // pills, avatars, buttons
} as const;

// ============================================
// Shadows
// ============================================
export const SHADOW = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
  card: 'shadow-sm hover:shadow-lg',
  button: 'shadow-md hover:shadow-lg',
  modal: 'shadow-2xl',
} as const;

// ============================================
// Spacing (consistent padding/margin)
// ============================================
export const SPACING = {
  // Container padding
  container: {
    x: 'px-4 md:px-6',
    y: 'py-8 md:py-12',
  },
  // Section spacing
  section: {
    y: 'py-12 md:py-20',
    yCompact: 'py-8 md:py-12',
  },
  // Card padding
  card: {
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  },
  // Gap
  gap: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
} as const;

// ============================================
// Component Presets
// ============================================
export const COMPONENT = {
  // Card styles
  card: {
    base: `${RADIUS.lg} bg-white ring-1 ring-gray-100 ${SHADOW.card} transition-all duration-300`,
    glass: `${RADIUS.lg} bg-white/80 backdrop-blur-sm ring-1 ring-meish/10 ${SHADOW.lg}`,
    interactive: `${RADIUS.lg} bg-white ring-1 ring-gray-100 ${SHADOW.card} hover:-translate-y-1 transition-all duration-300`,
  },

  // Button styles (use with shadcn Button component)
  button: {
    primary: `${RADIUS.full} font-semibold ${SHADOW.button} transition-all`,
    secondary: `${RADIUS.full} border-2 border-meish text-meish hover:bg-meish hover:text-white transition-all`,
    ghost: `${RADIUS.full} hover:bg-meish-50 transition-colors`,
  },

  // Input styles
  input: {
    base: `${RADIUS.md} border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-meish/20 focus:border-meish transition-all`,
  },

  // Badge styles
  badge: {
    primary: `${RADIUS.full} bg-meish text-white px-3 py-1 text-xs font-semibold`,
    secondary: `${RADIUS.full} bg-meish-50 text-meish px-3 py-1 text-xs font-semibold`,
    outline: `${RADIUS.full} ring-1 ring-meish text-meish px-3 py-1 text-xs font-semibold`,
  },
} as const;

// ============================================
// Layout
// ============================================
export const LAYOUT = {
  // Max widths
  maxWidth: {
    xs: 'max-w-sm',        // 384px
    sm: 'max-w-md',        // 448px
    md: 'max-w-lg',        // 512px
    lg: 'max-w-2xl',       // 672px
    xl: 'max-w-4xl',       // 896px
    '2xl': 'max-w-6xl',    // 1152px
    full: 'max-w-[1200px]', // 1200px - main container
  },
  // Common container
  container: 'mx-auto w-full max-w-[1200px] px-4 md:px-6',
  containerNarrow: 'mx-auto w-full max-w-[700px] px-4 md:px-6',
} as const;

// ============================================
// Typography
// ============================================
export const TYPOGRAPHY = {
  // Headings
  h1: 'text-3xl md:text-4xl font-bold text-meish-text-heading',
  h2: 'text-2xl md:text-3xl font-bold text-meish-text-heading',
  h3: 'text-xl md:text-2xl font-semibold text-meish-text-heading',
  h4: 'text-lg font-semibold text-meish-text-heading',

  // Body
  body: 'text-base text-meish-text-body leading-relaxed',
  bodySmall: 'text-sm text-meish-text-body leading-relaxed',

  // Muted
  muted: 'text-sm text-meish-text-muted',
  subtle: 'text-xs text-meish-text-subtle',
} as const;

// ============================================
// Animation
// ============================================
export const ANIMATION = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  duration: {
    fast: 'duration-150',
    normal: 'duration-300',
    slow: 'duration-500',
  },
  ease: {
    default: 'ease-out',
    smooth: 'ease-[cubic-bezier(0.4,0,0.2,1)]',
  },
} as const;

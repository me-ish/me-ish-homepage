// Test-only font fixture. The product routes/proxy/DB are not replaced.
// Next 16 (Turbopack) reads NEXT_FONT_GOOGLE_MOCKED_RESPONSES as a plain object keyed by the exact
// Google CSS URL, so each next/font/google call in the app is listed (a Proxy is seen as empty).
// Keys: src/app/layout.tsx (Lilita One), src/styles/siteFonts.ts (Zen Maru Gothic),
// src/features/natori/components/portfolio/portfolioFonts.ts (Fredoka).
const face = "@font-face { font-family: 'SyntheticTestFont'; src: local('Arial'); font-style: normal; font-weight: 400; }";
module.exports = {
  'https://fonts.googleapis.com/css2?family=Lilita+One:wght@400&display=swap': face,
  'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap': face,
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap': face,
};

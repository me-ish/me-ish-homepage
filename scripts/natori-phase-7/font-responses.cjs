// Test-only Google Fonts CSS transport for the isolated browser app (NEXT_FONT_GOOGLE_MOCKED_RESPONSES).
// The product's next/font/google source, class names and family/weight choices stay unchanged.
//
// Next 16 builds with Turbopack, whose built-in next/font/google reads this file as a plain object:
// keys must be the exact CSS URLs Next requests (a Proxy that answers any key is seen as empty), and
// font files must be fetched over HTTP (local file paths are not accepted). The pinned TTFs that
// prepare-fonts.mjs copies to /app/public/phase7-fonts are therefore served by the app's own dev
// server on localhost:3000 (loopback only; no Google network at runtime).
const origin = 'http://localhost:3000';
const zen = [[400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']]
  .map(([weight, name]) => `/* latin */\n@font-face {font-family:'Zen Maru Gothic';font-style:normal;font-weight:${weight};font-display:swap;src: url(${origin}/phase7-fonts/zenmarugothic/ZenMaruGothic-${name}.ttf) format('truetype');}`).join('\n');
const fredoka = `/* latin */\n@font-face {font-family:'Fredoka';font-style:normal;font-weight:300 700;font-stretch:100%;font-display:swap;src: url(${origin}/phase7-fonts/fredoka/Fredoka-variable.ttf) format('truetype');}`;
// URLs as built by next/font/google for src/styles/siteFonts.ts (Zen Maru Gothic 400/700) and
// src/features/natori/components/portfolio/portfolioFonts.ts (Fredoka 400–700). A font call with
// other weights produces a different URL and fails loudly ("url not found"), as before.
module.exports = {
  'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700&display=swap': zen,
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap': fredoka,
};

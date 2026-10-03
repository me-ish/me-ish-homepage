// Installed Next.js supports this test-only CSS transport; the product's
// next/font/google source, class names and family/weight choices stay unchanged.
const zen = [[400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']]
  .map(([weight, name]) => `/* latin */\n@font-face {font-family:'Zen Maru Gothic';font-style:normal;font-weight:${weight};font-display:swap;src: url(/app/public/phase7-fonts/zenmarugothic/ZenMaruGothic-${name}.ttf) format('truetype');}`).join('\n');
const fredoka = `/* latin */\n@font-face {font-family:'Fredoka';font-style:normal;font-weight:300 700;font-stretch:100%;font-display:swap;src: url(/app/public/phase7-fonts/fredoka/Fredoka-variable.ttf) format('truetype');}`;
module.exports = new Proxy({}, { get: (_target, key) => {
  if (typeof key !== 'string' || !key.startsWith('https://fonts.googleapis.com/css2?')) return undefined;
  const url = new URL(key), family = url.searchParams.get('family')?.split(':')[0];
  if (family === 'Zen Maru Gothic') return zen;
  if (family === 'Fredoka') return fredoka;
  return undefined;
} });

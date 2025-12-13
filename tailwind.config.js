/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx,css}",
    "./src/app/globals.css",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],

  safelist: [
    // 汎用
    "max-w-[820px]",
    "mx-auto",
    "px-4",
    "w-full",
    "font-zen",
    "font-lilita",

    // =============================
    // aiPortfolio フォントプリセット（新）
    // =============================
    "ai-portfolio-font-cleanJa",
    "ai-portfolio-font-modernSans",
    "ai-portfolio-font-formalMincho",
    "ai-portfolio-font-cuteRound",
    "ai-portfolio-font-popBold",
    "ai-portfolio-font-techMono",
    "ai-portfolio-font-luxurySerif",
    "ai-portfolio-font-retroPixel",

    // =============================
    // 互換用（過去データとの整合）
    // =============================
    "ai-portfolio-font-cuteJa",
    "ai-portfolio-font-formalJa",
    "ai-portfolio-font-globalBold",
    "ai-portfolio-font-serifJa",
    "ai-portfolio-font-retroPop",
  ],

  theme: {
    extend: {
      // =============================
      // フォントファミリー
      // =============================
      fontFamily: {
        lilita: ['"Lilita One"', "cursive"],
        zen: ['"Zen Maru Gothic"', "sans-serif"],
      },

      // =============================
      // 基本フォントサイズ調整
      // =============================
      fontSize: {
        base: "18px",
        lg: "20px",
        xl: "24px",
      },

      // =============================
      // keyframes / animation
      // （ポートフォリオのハートアニメにも使用）
      // =============================
      keyframes: {
        burst: {
          "0%": {
            transform: "translate(-50%, -50%) scale(1)",
            opacity: "1",
          },
          "100%": {
            transform: "translate(-50%, -50%) scale(1.8)",
            opacity: "0",
          },
        },
      },
      animation: {
        burst: "burst 0.4s ease-out forwards",
      },

      // =============================
      // シャドウと色
      // =============================
      boxShadow: {
        "heart-glow": "0 0 6px rgba(255, 105, 180, 0.6)",
      },
      colors: {
        "heart-pink": "#f472b6",
        "heart-pink-light": "#fbcfe8",
      },
    },
  },

  plugins: [],
};

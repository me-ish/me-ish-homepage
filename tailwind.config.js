/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',            // App Router 関連
    './src/**/*.{js,ts,jsx,tsx,css}',        // src配下すべて
    './src/app/globals.css',                 // グローバルCSS明示
    './components/**/*.{js,ts,jsx,tsx}',     // componentsフォルダ（念のため）
  ],
  safelist: [
    'max-w-[820px]',   // 表示幅制限（本番でpurgeされないように）
    'mx-auto',         // 中央寄せ
    'px-4',            // 横padding
    'w-full',          // 幅指定
    'font-zen',        // フォントクラス（Zen Maru Gothic）
    'font-lilita',     // フォントクラス（Lilita One）
  ],
  theme: {
    extend: {
      fontFamily: {
        lilita: ['"Lilita One"', 'cursive'],
        zen: ['"Zen Maru Gothic"', 'sans-serif'],
      },
      keyframes: {
        burst: {
          '0%': {
            transform: 'translate(-50%, -50%) scale(1)',
            opacity: '1',
          },
          '100%': {
            transform: 'translate(-50%, -50%) scale(1.8)',
            opacity: '0',
          },
        },
      },
      animation: {
        burst: 'burst 0.4s ease-out forwards',
      },
      boxShadow: {
        'heart-glow': '0 0 6px rgba(255, 105, 180, 0.6)',
      },
      colors: {
        'heart-pink': '#f472b6',
        'heart-pink-light': '#fbcfe8',
      },
    },
  },
  plugins: [],
}

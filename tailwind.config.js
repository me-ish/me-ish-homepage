/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
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
};



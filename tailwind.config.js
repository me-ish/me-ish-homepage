/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
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
  		fontFamily: {
  			lilita: [
  				'Lilita One',
  				'cursive'
  			],
  			zen: [
  				'Zen Maru Gothic',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			base: '18px',
  			lg: '20px',
  			xl: '24px'
  		},
  		keyframes: {
  			burst: {
  				'0%': {
  					transform: 'translate(-50%, -50%) scale(1)',
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'translate(-50%, -50%) scale(1.8)',
  					opacity: '0'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			burst: 'burst 0.4s ease-out forwards',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		boxShadow: {
  			'heart-glow': '0 0 6px rgba(255, 105, 180, 0.6)'
  		},
  		colors: {
  			// me-ish Brand Colors
  			'meish': {
  				DEFAULT: '#00a1e9',
  				50: '#f0f9ff',
  				100: '#e0f4fe',
  				200: '#bae8fd',
  				300: '#7dd5fc',
  				400: '#38bdf8',
  				500: '#00a1e9',
  				600: '#0080c0',
  				700: '#0070a8',
  				800: '#005d8a',
  				900: '#004d72',
  			},
  			// Text colors
  			'meish-text': {
  				DEFAULT: '#1a1a2e',
  				heading: '#002233',
  				body: '#374151',
  				muted: '#6b7280',
  				subtle: '#9ca3af',
  			},
  			'heart-pink': '#f472b6',
  			'heart-pink-light': '#fbcfe8',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },

  plugins: [require("tailwindcss-animate")],
};

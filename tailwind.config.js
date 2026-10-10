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
    // aura フォントプリセット（新）
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

    // 旧ギャラリーの休止済みマイページ等を退避しても表示CSSを保持する。
    // 根拠: docs/archive/gallery-workspace-20261010.md
    "backdrop-blur-[1px]",
    "bg-[#00a1e9]/15",
    "bg-[#f1f5f9]",
    "bg-amber-400",
    "bg-amber-50/30",
    "bg-emerald-400",
    "bg-purple-50",
    "bg-red-50/30",
    "bg-yellow-100",
    "border-[#00a1e9]/25",
    "border-[#00a1e9]/30",
    "border-purple-100",
    "border-purple-200",
    "border-red-500",
    "border-rose-500",
    "border-yellow-300",
    "focus:border-[#00a1e9]/50",
    "focus:ring-[#00a1e9]/20",
    "focus:ring-red-500",
    "from-indigo-50",
    "from-indigo-500",
    "from-purple-50",
    "grayscale",
    "group-hover:bg-black/30",
    "group-hover:text-sky-500",
    "hover:bg-[#00a1e9]/20",
    "hover:bg-blue-50",
    "hover:bg-emerald-500",
    "hover:bg-gray-300",
    "hover:bg-red-500",
    "hover:bg-rose-500",
    "hover:bg-sky-50/50",
    "hover:border-sky-300",
    "hover:from-indigo-600",
    "hover:shadow",
    "hover:text-amber-900",
    "hover:text-gray-600",
    "hover:to-purple-600",
    "lg:grid-cols-7",
    "lg:self-start",
    "lg:sticky",
    "lg:top-8",
    "max-h-[400px]",
    "max-h-[calc(100svh-2rem)]",
    "md:pt-16",
    "min-h-[100svh]",
    "min-w-[2ch]",
    "my-2",
    "pb-0",
    "pb-[calc(env(safe-area-inset-bottom)+16px)]",
    "pt-12",
    "py-24",
    "ring-0",
    "ring-[#00a1e9]",
    "ring-[#00a1e9]/30",
    "ring-amber-300",
    "ring-emerald-300",
    "ring-red-300",
    "sm:gap-0",
    "sm:h-16",
    "sm:h-20",
    "sm:inline",
    "sm:max-h-[calc(100vh-4rem)]",
    "sm:max-w-md",
    "sm:w-20",
    "space-x-2",
    "text-[#007bb3]",
    "text-blue-500",
    "text-emerald-400",
    "text-green-500",
    "text-orange-500",
    "text-purple-500",
    "text-purple-700",
    "text-yellow-500",
    "text-yellow-700",
    "to-gray-300",
    "to-purple-500",
    "to-purple-600",
    "translate-x-5",
    "via-purple-50",
    "w-[150px]",
    "w-[200px]",

    // 休止画面の整理前と生成CSSを一致させる互換クラス。
    // 保存済みの表示設定も保護する。根拠: docs/archive/legacy-display-20261010.md
    "-bottom-10",
    "-left-1/4",
    "align-baseline",
    "backdrop-blur-[6px]",
    "bg-[#e8f4ff]",
    "bg-[#e8f7ff]",
    "bg-[#f0f9ff]",
    "bg-[#f8fbff]",
    "bg-[linear-gradient(90deg,#00a1e9,rgba(0,161,233,0.55))]",
    "bg-[linear-gradient(transparent_62%,rgba(0,161,233,0.18)_62%)]",
    "bg-emerald-300",
    "bg-gray-50/60",
    "bg-slate-950/70",
    "bg-yellow-400/50",
    "border-[#00a1e9]/10",
    "disabled:opacity-30",
    "disabled:text-gray-200",
    "divide-gray-100",
    "drop-shadow-[0_10px_22px_rgba(0,161,233,0.16)]",
    "duration-100",
    "flex-none",
    "focus:ring-[#00a1e9]/50",
    "focus:ring-offset-1",
    "group-hover:bg-white",
    "h-40",
    "h-[120px]",
    "h-[240px]",
    "h-[520px]",
    "h-[620px]",
    "hover:shadow-[0_10px_26px_rgba(15,23,42,0.18)]",
    "inset-x-2",
    "leading-[1.05]",
    "lg:flex-row",
    "lg:inset-auto",
    "lg:max-w-lg",
    "lg:relative",
    "lg:z-auto",
    "m-auto",
    "md:flex-auto",
    "md:flex-wrap",
    "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
    "md:h-[130px]",
    "md:overflow-visible",
    "md:pb-8",
    "md:pr-0",
    "md:px-4",
    "md:px-9",
    "md:text-[72px]",
    "md:w-[180px]",
    "mix-blend-overlay",
    "opacity-[0.16]",
    "rounded-[999px]",
    "scale-[1.03]",
    "shadow-[0_0_12px_rgba(56,189,248,0.45)]",
    "sm:grid-cols-5",
    "text-[#99a]",
    "text-[#9aa]",
    "text-[1rem]",
    "text-[56px]",
    "text-[clamp(1.9rem,4.2vw,3rem)]",
    "text-[clamp(2.1rem,4.6vw,3.2rem)]",
    "text-slate-300/70",
    "text-slate-50",
    "top-1/3",
    "top-14",
    "tracking-[0.35em]",
    "w-[120%]",
    "w-[170px]",
    "w-[320px]",
    "w-[520px]",
    "w-[620px]",
    "xl:max-w-xl",
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

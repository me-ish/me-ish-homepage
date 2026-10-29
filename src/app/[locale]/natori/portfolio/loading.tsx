// app/natori/portfolio/loading.tsx
// /natori/portfolio を開く途中に出す読み込み表示。全ページ共通の青いくるくるの代わりに、
// ページの形（ヘッダー・HERO・作品）に近い淡いピンクの下書きを出す。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export default function PortfolioLoading() {
  return (
    <main
      className="min-h-screen px-4 py-6 sm:px-8"
      style={{ backgroundColor: c.page }}
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        読み込み中です
      </p>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 motion-safe:animate-pulse" aria-hidden="true">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded-full" style={{ backgroundColor: c.actionSoft }} />
          <div className="h-11 w-32 rounded-full" style={{ backgroundColor: c.actionSoft }} />
        </div>
        <div className="aspect-[4/3] w-full rounded-3xl sm:aspect-[16/7]" style={{ backgroundColor: c.surfaceSubtle }} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl" style={{ backgroundColor: c.surfaceSubtle }} />
          ))}
        </div>
      </div>
    </main>
  );
}

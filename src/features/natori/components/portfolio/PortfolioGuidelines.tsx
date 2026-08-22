// features/natori/components/portfolio/PortfolioGuidelines.tsx
// 購入者へのお願い。FAQ content model の追加は PF-05 で扱う。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

const cardStyle = {
  background: c.surface,
  boxShadow: `0 10px 22px ${c.shadowSoft}`,
} as const;

export default function PortfolioGuidelines({ content }: { content: PortfolioContent }) {
  return (
    <section id="requests" className="py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto max-w-4xl px-5">
        <h2 className="mb-6 text-center text-2xl font-black md:text-3xl">購入者へのお願い</h2>
        <ul className="space-y-1.5 rounded-2xl p-6 text-sm md:p-8 md:text-base" style={cardStyle}>
          {content.requests.map((request, index) => (
            <li key={`${request}-${index}`} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: c.accent }}
                aria-hidden="true"
              />
              <span style={{ color: c.textSoft }}>{request}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

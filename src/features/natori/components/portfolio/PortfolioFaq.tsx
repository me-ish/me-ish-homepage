// features/natori/components/portfolio/PortfolioFaq.tsx
// よくある質問。質問だけを並べ、開くと答えを読める形にして、ご依頼フォームの直前に置く。
import { ChevronDown } from "lucide-react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioFaq({ content }: { content: PortfolioContent }) {
  // 書きかけの項目（質問か答えが空）は公開ページに出さない。
  const faqs = (content.faqs ?? []).filter(
    (faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0
  );
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 pt-14 md:pt-20">
      <h2 className="text-center text-2xl font-black md:text-3xl">よくある質問</h2>
      <div className="mt-6 space-y-3 md:mt-8">
        {faqs.map((faq, index) => (
          <details
            key={`${faq.question}-${index}`}
            className="group rounded-2xl"
            style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
          >
            <summary className="pf-cute-focus flex min-h-[52px] cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 font-bold md:px-5 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="shrink-0 text-lg" style={{ ...fontEnStyle, color: c.actionTextSmall }}>
                Q
              </span>
              {/* 本文の既定が大きいので、スマホは 15px に下げる（PC は 20px のまま） */}
              <span className="min-w-0 flex-1 text-[15px] leading-snug md:text-lg">{faq.question.trim()}</span>
              <ChevronDown
                aria-hidden="true"
                className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                style={{ color: c.textSoft }}
              />
            </summary>
            <p
              className="whitespace-pre-line px-4 pb-4 pl-10 text-[14px] leading-relaxed md:px-5 md:pl-11 md:text-base"
              style={{ color: c.textSoft }}
            >
              {faq.answer.trim()}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

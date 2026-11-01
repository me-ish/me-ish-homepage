// features/natori/components/portfolio/PortfolioFaq.tsx
// よくある質問。質問だけを並べ、開くと答えを読める形にして、ご依頼フォームの直前に置く。
import { ChevronDown } from "lucide-react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { publicFaqs } from "@/features/natori/lib/portfolioFaq";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { fontEnStyle } from "./portfolioFonts";

export default function PortfolioFaq({ content, embedded = false }: {
  content: PortfolioContent;
  /** 「ご依頼前にご確認ください」の区画の中に続けて置くとき。見出しを一段下げる */
  embedded?: boolean;
}) {
  const faqs = publicFaqs(content);
  if (faqs.length === 0) return null;

  return (
    <section
      id="faq"
      className={embedded ? "mt-10 md:mt-12" : "mx-auto max-w-3xl px-5 pt-14 md:pt-20"}
      aria-labelledby="faq-heading"
    >
      {embedded ? (
        <h3 id="faq-heading" className="text-center text-xl font-black md:text-2xl"><span className="pf-marker">よくある質問</span></h3>
      ) : (
        <h2 id="faq-heading" className="text-center text-2xl font-black md:text-3xl"><span className="pf-marker">よくある質問</span></h2>
      )}
      <div className={embedded ? "mt-4 space-y-3 md:mt-6" : "mt-6 space-y-3 md:mt-8"}>
        {faqs.map((faq, index) => (
          <details
            key={`${faq.question}-${index}`}
            className="group pf-sketch-soft"
          >
            <summary className="pf-cute-focus flex min-h-[52px] cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 font-bold md:px-5 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="shrink-0 text-lg" style={{ ...fontEnStyle, color: c.actionTextSmall }}>
                Q
              </span>
              {/* 本文の既定が大きいので、スマホは 15px に下げる（PC は 20px のまま） */}
              <span className="min-w-0 flex-1 text-base leading-snug md:text-lg">{faq.question.trim()}</span>
              <ChevronDown
                aria-hidden="true"
                className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                style={{ color: c.textSoft }}
              />
            </summary>
            <p
              className="whitespace-pre-line px-4 pb-4 pl-10 text-sm leading-relaxed md:px-5 md:pl-11 md:text-base"
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

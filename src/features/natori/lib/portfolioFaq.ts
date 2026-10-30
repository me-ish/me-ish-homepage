import type { PortfolioContent } from "../types/portfolio";

/** 書きかけの項目（質問か答えが空）は公開ページに出さない。 */
export function publicFaqs(content: PortfolioContent) {
  return (content.faqs ?? []).filter(
    (faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0
  );
}

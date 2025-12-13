// src/lib/aiPortfolio/aiPortfolio.sanitize.ts
import DOMPurify from "isomorphic-dompurify";

/**
 * 必要になったら dangerouslySetInnerHTML で使う用
 */
export const sanitizeHTML = (html: string | undefined | null) => {
  return {
    __html: DOMPurify.sanitize(html ?? ""),
  };
};

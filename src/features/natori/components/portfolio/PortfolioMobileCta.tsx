"use client";

// features/natori/components/portfolio/PortfolioMobileCta.tsx
// モバイル閲覧時のご依頼フォームへのフローティング導線。
// ヘッダーのナビは md 未満だと簡易表示になり、ページも縦に長いため、
// 常時見える「相談・見積もり」ボタンでフォームまで一足で飛べるようにする。
// Heroとフォーム自体が画面内にある間は既存導線や入力を覆わないよう自動で隠す。
import { useEffect, useState } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";

export default function PortfolioMobileCta() {
  const [guardedSectionVisible, setGuardedSectionVisible] = useState(true);

  useEffect(() => {
    const guardedSections = ["hero", "form"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (guardedSections.length === 0 || typeof IntersectionObserver === "undefined") {
      setGuardedSectionVisible(false);
      return;
    }

    // 初回通知が対象ごとに分かれても、全対象の可視状態が判明するまでは表示しない。
    const visibleSections = new Set<Element>(guardedSections);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      }
      setGuardedSectionVisible(visibleSections.size > 0);
    });
    for (const section of guardedSections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  if (guardedSectionVisible) return null;

  return (
    <a
      href="#form"
      onClick={() => trackNatoriPageEvent("portfolio_primary_cta_click", "mobile_sticky")}
      className="pf-cute-focus fixed right-5 z-40 inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-base font-black shadow-lg hover:brightness-105 md:hidden"
      style={{
        background: c.action,
        color: c.onAction,
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        boxShadow: `0 8px 20px ${c.shadowFloating}`,
      }}
    >
      相談・見積もり
    </a>
  );
}

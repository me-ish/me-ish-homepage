"use client";

// features/natori/components/portfolio/PortfolioMobileCta.tsx
// モバイル閲覧時のご依頼フォームへのフローティング導線。
// ヘッダーのナビは md 未満だと簡易表示になり、ページも縦に長いため、
// 常時見える「相談・見積もり」ボタンでフォームまで一足で飛べるようにする。
// フォーム自体が画面内にある間は重なって邪魔なので自動で隠す。
import { useEffect, useState } from "react";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export default function PortfolioMobileCta() {
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const form = document.getElementById("form");
    if (!form || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setFormVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  if (formVisible) return null;

  return (
    <a
      href="#form"
      className="pf-cute-focus fixed right-5 z-40 inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-sm font-bold shadow-lg hover:brightness-105 md:hidden"
      style={{
        background: c.action,
        color: c.onAction,
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        boxShadow: "0 8px 20px rgba(36,36,36,0.22)",
      }}
    >
      相談・見積もり
    </a>
  );
}

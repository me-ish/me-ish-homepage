"use client";

// features/natori/components/portfolio/PortfolioMobileCta.tsx
// モバイル閲覧時のご依頼フォームへのフローティング導線。
// ヘッダーのナビは md 未満だと簡易表示になり、ページも縦に長いため、
// 常時見える「依頼してみる」ボタンでフォームまで一足で飛べるようにする。
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
      className="pf-cute-focus fixed bottom-5 right-5 z-40 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg hover:brightness-105 md:hidden"
      style={{ background: c.pink, boxShadow: "0 8px 20px rgba(244,114,182,0.45)" }}
    >
      依頼してみる
    </a>
  );
}

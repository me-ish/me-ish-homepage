// features/natori/components/portfolio/PortfolioStyles.tsx
// /natori/portfolio 専用のキーフレーム・フォーカスリング。
// 他ページと衝突しないよう pf- プレフィックスを付けている。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

export default function PortfolioStyles() {
  return (
    <style>{`
      @keyframes pf-floaty { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      @keyframes pf-wobble { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
      .pf-floaty { animation: pf-floaty 4s ease-in-out infinite; }
      .pf-wobble { animation: pf-wobble 2.4s ease-in-out infinite; }
      .pf-pin-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
      .pf-pin-card:hover, .pf-pin-card:focus-within { transform: rotate(0deg) translateY(-6px) !important; box-shadow: 0 18px 30px rgba(36,36,36,0.16); }
      .pf-form-control { border-color: ${c.borderStrong}; }
      .pf-portfolio-root :where(#gallery, #pricing, #flow, #about, #requests, #form) { scroll-margin-top: 128px; }
      .pf-cute-focus:focus-visible,
      .pf-portfolio-root :where(a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])):focus-visible {
        outline: 3px solid ${c.accentHover};
        outline-offset: 3px;
      }
      @media (min-width: 768px) {
        .pf-portfolio-root :where(#gallery, #pricing, #flow, #about, #requests, #form) { scroll-margin-top: 88px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .pf-floaty, .pf-wobble { animation: none; }
        .pf-pin-card { transition: none; }
        .pf-pin-card:hover, .pf-pin-card:focus-within { transform: none !important; }
      }
    `}</style>
  );
}

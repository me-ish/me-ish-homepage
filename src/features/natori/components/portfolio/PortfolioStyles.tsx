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
      .pf-pin-card:hover, .pf-pin-card:focus-within { transform: rotate(0deg) translateY(-6px) !important; box-shadow: 0 18px 30px ${c.shadowHover}; }
      .pf-form-control { border-color: ${c.borderStrong}; }
      .pf-choice-control {
        appearance: none;
        border: 2px solid ${c.borderStrong};
        background-color: ${c.surface};
        background-position: center;
        background-repeat: no-repeat;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }
      .pf-choice-control[type="radio"] { border-radius: 9999px; }
      .pf-choice-control[type="checkbox"] { border-radius: 0.25rem; }
      .pf-choice-control:checked {
        border-color: ${c.accentDisplay};
        background-color: ${c.accentDisplay};
      }
      .pf-choice-control[type="radio"]:checked {
        background-image: radial-gradient(circle, ${c.surface} 0 30%, transparent 34%);
      }
      .pf-choice-control[type="checkbox"]:checked {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='m3.5 8.5 3 3 6-7' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      }
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
        .pf-choice-control { transition: none; }
      }
      @media (forced-colors: active) {
        .pf-choice-control {
          appearance: auto;
          background-image: none;
        }
      }
    `}</style>
  );
}

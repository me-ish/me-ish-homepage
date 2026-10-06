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
      .pf-pin-card:hover, .pf-pin-card:focus-within { transform: translateY(-6px) !important; box-shadow: 0 18px 30px ${c.shadowHover}; }
      .pf-portfolio-root #gallery .pf-pin-card > button > img[alt] {
        object-fit: contain !important;
        padding: clamp(0.25rem, 1.5vw, 0.5rem);
        background:
          radial-gradient(circle at 22% 18%, ${c.accentSoft} 0%, transparent 42%),
          linear-gradient(145deg, ${c.surfaceSubtle}, ${c.surface});
      }
      /* 1画面目の作品の額。スマホは相談ボタンまで1画面に入る高さ、PC は右列いっぱいの縦長（4:5）。
         幅は整数pxに切り捨てる（端数があるとスライドの位置が1px未満ずれる）。round() 非対応の環境は1つ前の指定を使う。 */
      .pf-hero-frame { margin-inline: auto; width: 100%; max-width: calc(48vh * 0.8 + 1rem); max-width: round(down, calc(48svh * 0.8 + 1rem), 1px); }
      @media (min-width: 768px) { .pf-hero-frame { width: min(42vw, calc(70vh * 0.8 + 1rem)); width: round(down, min(42vw, calc(70vh * 0.8 + 1rem)), 1px); max-width: none; } }
      @media (min-width: 1024px) { .pf-hero-frame { width: min(34rem, calc(70vh * 0.8 + 1rem)); width: round(down, min(34rem, calc(70vh * 0.8 + 1rem)), 1px); } }
      /* 見出しの上に添える英字の小見出し（飾り）。content の「/ ""」で読み上げには含めない。
         制作の流れ（PortfolioWorkflow.tsx）は CI が中身を固定しているため、すべてここで付ける。 */
      .pf-portfolio-root :is(#gallery, #pricing, #about, #faq) h2::before,
      .pf-portfolio-root #flow > div > div:first-child > h2::before {
        display: block;
        margin-bottom: 0.5rem;
        font-family: var(--pf-font-en);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.2em;
        line-height: 1.2;
        color: ${c.actionTextSmall};
      }
      .pf-portfolio-root #gallery h2::before { content: "WORKS" / ""; }
      .pf-portfolio-root #pricing h2::before { content: "PRICE" / ""; }
      .pf-portfolio-root #flow > div > div:first-child > h2::before { content: "FLOW" / ""; }
      .pf-portfolio-root #about h2::before { content: "PROFILE" / ""; }
      .pf-portfolio-root #faq h2::before { content: "FAQ" / ""; }
      .pf-form-control { border-color: ${c.formBorder}; }
      .pf-form-control::placeholder { font-size: 0.875rem; }
      .pf-choice-control {
        appearance: none;
        border: 2px solid ${c.formBorder};
        background-color: ${c.surface};
        background-position: center;
        background-repeat: no-repeat;
        transition: background-color 0.15s ease, border-color 0.15s ease;
      }
      .pf-choice-control[type="radio"] { border-radius: 9999px; }
      .pf-choice-control[type="checkbox"] { border-radius: 0.25rem; }
      .pf-choice-control:checked {
        border-color: ${c.formBorderActive};
        background-color: ${c.formBorderActive};
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
      .pf-portfolio-root :where(.pf-form-control, .pf-choice-control):focus-visible {
        border-color: ${c.formBorderActive};
        outline-color: ${c.formBorderActive};
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

// features/natori/components/portfolio/PortfolioStyles.tsx
// /natori/portfolio 専用のキーフレーム・フォーカスリング・手描き風の部品。
// 他ページと衝突しないよう pf- プレフィックスを付けている。
//
// 見た目の方針: 作品が主役。UI は「画用紙・マーカー・付箋」の役割だけを持つ。
// - 影は使わない。囲みが要るところは .pf-sketch（少し歪んだ手描きの枠線）1 種類。
// - 見出しの英字小見出しは出さず、日本語見出しの下にマーカー線（.pf-marker）だけ引く。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

/** 画用紙の紙目（軽い SVG ノイズ）。作品の上には重ねない。 */
const PAPER_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.36 0 0 0 0 0.3 0 0 0 0 0.32 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function PortfolioStyles() {
  return (
    <style>{`
      @keyframes pf-floaty { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      @keyframes pf-wobble { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
      .pf-floaty { animation: pf-floaty 4s ease-in-out infinite; }
      .pf-wobble { animation: pf-wobble 2.4s ease-in-out infinite; }
      /* 画用紙。背景色の上に薄い紙目を重ねる（画像や白いカードには掛からない）。 */
      .pf-portfolio-root { background-image: ${PAPER_GRAIN}; background-attachment: scroll; }
      /* 手描き風の枠。角の丸みを少しずつ変えて、定規で引いた線に見せない。影は使わない。 */
      .pf-sketch {
        border: 1.5px solid ${c.sketchLine};
        border-radius: 18px 14px 20px 13px / 14px 19px 13px 20px;
        background: ${c.surface};
      }
      .pf-sketch-soft {
        border: 1.5px solid ${c.borderSubtle};
        border-radius: 18px 14px 20px 13px / 14px 19px 13px 20px;
        background: ${c.surface};
      }
      /* 見出しの下のマーカー線。少し傾けて、蛍光ペンで引いた一本に見せる。 */
      .pf-marker { position: relative; display: inline-block; }
      .pf-marker::after {
        content: "";
        position: absolute;
        left: -0.15em;
        right: -0.15em;
        bottom: 0.08em;
        height: 0.42em;
        background: ${c.marker};
        border-radius: 999px 4px 999px 6px;
        transform: rotate(-1.2deg);
        z-index: -1;
      }
      .pf-marker { isolation: isolate; }
      .pf-pin-card { transition: transform 0.25s ease; }
      .pf-pin-card:hover, .pf-pin-card:focus-within { transform: translateY(-4px); }
      .pf-portfolio-root #gallery .pf-pin-card > button > img[alt] {
        object-fit: contain !important;
        padding: clamp(0.25rem, 1.5vw, 0.5rem);
        background:
          radial-gradient(circle at 22% 18%, ${c.accentSoft} 0%, transparent 42%),
          linear-gradient(145deg, ${c.surfaceSubtle}, ${c.surface});
      }
      /* 1画面目の作品の額。スマホは幅 20rem までの固定（画面の高さで決めると、X のアプリ内ブラウザ・Safari・ホーム画面のアプリで大きさが変わるため）。
         PC は右列いっぱいの縦長（4:5）。幅は整数pxに切り捨てる（端数があるとスライドの位置が1px未満ずれる）。round() 非対応の環境は1つ前の指定を使う。 */
      .pf-hero-frame { margin-inline: auto; width: 100%; max-width: 20rem; }
      @media (min-width: 768px) { .pf-hero-frame { width: min(42vw, calc(70vh * 0.8 + 1rem)); width: round(down, min(42vw, calc(70vh * 0.8 + 1rem)), 1px); max-width: none; } }
      @media (min-width: 1024px) { .pf-hero-frame { width: min(34rem, calc(70vh * 0.8 + 1rem)); width: round(down, min(34rem, calc(70vh * 0.8 + 1rem)), 1px); } }
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
      .pf-portfolio-root :where(#gallery, #pricing, #flow, #about, #requests, #faq, #form) { scroll-margin-top: 128px; }
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
        .pf-portfolio-root :where(#gallery, #pricing, #flow, #about, #requests, #faq, #form) { scroll-margin-top: 88px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .pf-floaty, .pf-wobble { animation: none; }
        .pf-pin-card { transition: none; }
        .pf-pin-card:hover, .pf-pin-card:focus-within { transform: none; }
        .pf-choice-control { transition: none; }
      }
      @media (forced-colors: active) {
        .pf-choice-control {
          appearance: auto;
          background-image: none;
        }
        .pf-marker::after { display: none; }
      }
    `}</style>
  );
}

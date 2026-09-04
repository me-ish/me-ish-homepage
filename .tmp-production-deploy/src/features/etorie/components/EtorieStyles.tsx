// features/etorie/components/EtorieStyles.tsx
// /etorie 系ページのスタイル。承認済みティザーモック（2026-07-14 Artifact）の
// デザイントークンをそのまま移植し、他ページに漏れないよう .etorie-page 配下に
// スコープしている。natori の PortfolioStyles と同じ「ページ専用 <style>」方式。
// 注意: React は <style> の子テキストを SSR でエスケープするため（引用符入り
// フォント名が hydration 不一致になる）、dangerouslySetInnerHTML で埋め込む。
const css = `
.etorie-page {
  --et-paper: #FAF7F2;
  --et-surface: #FFFFFF;
  --et-ink: #26222E;
  --et-mist: #6E6879;
  --et-line: #E5DED4;
  --et-accent: #C43A6E;
  --et-accent-soft: #F7E3EB;
  --et-brass: #A87F3C;
  --et-ok-bg: #E4F2EA; --et-ok-fg: #1F6B45;
  --et-warn-bg: #FBEEDC; --et-warn-fg: #8A5A16;
  --et-alert-bg: #FBE3E3; --et-alert-fg: #A03030;
  --et-shadow: 0 18px 40px rgba(38, 34, 46, 0.10);

  background: var(--et-paper);
  color: var(--et-ink);
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic Medium", "Yu Gothic", Meiryo, sans-serif;
  line-height: 1.85;
  font-size: 16px;
  min-height: 100vh;
  scroll-behavior: smooth;
}
.etorie-page .et-serif { font-family: Georgia, "Hiragino Mincho ProN", "Yu Mincho", "BIZ UDMincho", serif; }
.etorie-page .et-wrap { max-width: 1040px; margin: 0 auto; padding: 0 24px; }

/* ---------- header ---------- */
.etorie-page .et-header {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 16px;
  padding: 28px 0 0;
}
.etorie-page .et-logotype { display: flex; align-items: baseline; gap: 10px; }
.etorie-page .et-logotype .et-latin {
  font-family: Georgia, serif; font-style: italic; font-size: 26px; letter-spacing: 0.02em;
  white-space: nowrap;
}
.etorie-page .et-logotype .et-latin .et-e { color: var(--et-accent); }
.etorie-page .et-logotype .et-kana {
  font-size: 12.5px; letter-spacing: 0.32em; color: var(--et-mist); white-space: nowrap;
}
.etorie-page .et-byline { font-size: 12px; color: var(--et-mist); letter-spacing: 0.08em; }
.etorie-page .et-byline b { color: var(--et-ink); font-weight: 600; }

/* ---------- hero ---------- */
.etorie-page .et-hero {
  display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 48px; align-items: center;
  padding: 72px 0 84px;
}
@media (max-width: 820px) { .etorie-page .et-hero { grid-template-columns: 1fr; padding: 48px 0 56px; } }

.etorie-page .et-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 12px; letter-spacing: 0.28em; color: var(--et-brass); font-weight: 600;
}
.etorie-page .et-eyebrow::before { content: ""; width: 34px; height: 1px; background: var(--et-brass); }

.etorie-page h1 {
  font-family: "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif;
  font-size: clamp(34px, 5.2vw, 52px);
  line-height: 1.45; font-weight: 600; letter-spacing: 0.04em;
  margin: 18px 0 20px; text-wrap: balance;
}
.etorie-page h1 .et-u { position: relative; white-space: nowrap; }
.etorie-page h1 .et-u::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0.08em;
  height: 0.42em; background: var(--et-accent-soft); z-index: 0; border-radius: 2px;
}
.etorie-page h1 .et-u > span { position: relative; z-index: 1; }
.etorie-page .et-lede { max-width: 30em; color: var(--et-mist); margin: 0 0 32px; }
.etorie-page .et-lede b { color: var(--et-ink); font-weight: 600; }

.etorie-page .et-cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.etorie-page .et-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--et-accent); color: #fff; border: none; cursor: pointer;
  font: inherit; font-weight: 700; font-size: 15px;
  padding: 13px 30px; border-radius: 999px; text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(196, 58, 110, 0.30);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.etorie-page .et-btn:hover { transform: translateY(-1px); }
.etorie-page .et-btn:focus-visible { outline: 3px solid var(--et-accent-soft); outline-offset: 2px; }
.etorie-page .et-btn.et-btn-ghost {
  background: transparent; color: var(--et-accent);
  border: 2px solid var(--et-accent); box-shadow: none; padding: 11px 28px;
}
.etorie-page .et-cta-note { font-size: 12.5px; color: var(--et-mist); }

/* hero mock card */
.etorie-page .et-mock {
  background: var(--et-surface); border: 1px solid var(--et-line); border-radius: 14px;
  box-shadow: var(--et-shadow); overflow: hidden;
  transform: rotate(1.2deg);
}
.etorie-page .et-mock.et-mock-flat { transform: none; }
.etorie-page .et-mock-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--et-line);
}
.etorie-page .et-mock-bar .et-t { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; }
.etorie-page .et-mock-bar .et-badge {
  font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px;
  background: var(--et-accent); color: #fff;
}
.etorie-page .et-row { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-bottom: 1px solid var(--et-line); }
.etorie-page .et-row:last-child { border-bottom: none; }
.etorie-page .et-row .et-name { font-size: 13px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.etorie-page .et-row .et-sub { font-size: 11px; color: var(--et-mist); white-space: nowrap; }
.etorie-page .et-chip { font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; white-space: nowrap; margin-left: auto; }
.etorie-page .et-chip.ok { background: var(--et-ok-bg); color: var(--et-ok-fg); }
.etorie-page .et-chip.warn { background: var(--et-warn-bg); color: var(--et-warn-fg); }
.etorie-page .et-chip.alert { background: var(--et-alert-bg); color: var(--et-alert-fg); }
.etorie-page .et-mock-foot { padding: 10px 16px; font-size: 11px; color: var(--et-mist); background: #F5F0E9; }

/* ---------- sections ---------- */
.etorie-page .et-section { padding: 64px 0; border-top: 1px solid var(--et-line); }
.etorie-page .et-sec-head { margin-bottom: 36px; }
.etorie-page .et-sec-eyebrow { font-size: 11.5px; letter-spacing: 0.3em; color: var(--et-brass); font-weight: 700; }
.etorie-page h2 {
  font-family: "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif;
  font-size: clamp(24px, 3.4vw, 32px); font-weight: 600; letter-spacing: 0.03em;
  margin: 10px 0 0; text-wrap: balance;
}

/* pains */
.etorie-page .et-pains { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 28px; max-width: 760px; }
@media (max-width: 640px) { .etorie-page .et-pains { grid-template-columns: 1fr; } }
.etorie-page .et-pain { display: flex; gap: 12px; align-items: flex-start; color: var(--et-mist); font-size: 15px; }
.etorie-page .et-pain::before { content: "—"; color: var(--et-accent); font-weight: 700; flex: none; }
.etorie-page .et-pains-close { margin-top: 30px; font-size: 15.5px; }
.etorie-page .et-pains-close b { color: var(--et-accent); }

/* features */
.etorie-page .et-features { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
@media (max-width: 720px) { .etorie-page .et-features { grid-template-columns: 1fr; } }
.etorie-page .et-feature {
  background: var(--et-surface); border: 1px solid var(--et-line); border-radius: 14px;
  padding: 26px 26px 24px;
}
.etorie-page .et-feature .et-f-label { font-size: 11px; letter-spacing: 0.22em; color: var(--et-brass); font-weight: 700; }
.etorie-page .et-feature h3 { font-size: 18px; margin: 8px 0 8px; letter-spacing: 0.02em; }
.etorie-page .et-feature p { margin: 0; font-size: 14px; color: var(--et-mist); }

/* flow */
.etorie-page .et-flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; }
@media (max-width: 720px) { .etorie-page .et-flow { grid-template-columns: 1fr; } }
.etorie-page .et-step { position: relative; padding: 0 18px 0 0; }
.etorie-page .et-step + .et-step { padding-left: 18px; border-left: 1px solid var(--et-line); }
@media (max-width: 720px) {
  .etorie-page .et-step { padding: 14px 0; }
  .etorie-page .et-step + .et-step { padding-left: 0; border-left: none; border-top: 1px solid var(--et-line); }
}
.etorie-page .et-step .et-n { font-family: Georgia, serif; font-style: italic; font-size: 22px; color: var(--et-accent); }
.etorie-page .et-step h3 { font-size: 15px; margin: 6px 0 4px; }
.etorie-page .et-step p { margin: 0; font-size: 12.5px; color: var(--et-mist); line-height: 1.7; }
.etorie-page .et-auto {
  display: inline-block; margin-top: 8px; font-size: 10.5px; font-weight: 700;
  color: var(--et-ok-fg); background: var(--et-ok-bg); padding: 1px 8px; border-radius: 999px;
}

/* origin + pricing */
.etorie-page .et-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
@media (max-width: 720px) { .etorie-page .et-duo { grid-template-columns: 1fr; } }
.etorie-page .et-panel {
  border: 1px solid var(--et-line); border-radius: 14px; padding: 26px;
  background: #FCFAF6;
}
.etorie-page .et-panel h3 { font-size: 16px; margin: 0 0 8px; }
.etorie-page .et-panel p { margin: 0; font-size: 14px; color: var(--et-mist); }
.etorie-page .et-panel .et-price {
  font-family: Georgia, "Hiragino Mincho ProN", serif; font-size: 24px; color: var(--et-ink);
  display: block; margin-bottom: 6px;
}

/* register */
.etorie-page .et-register { text-align: center; padding: 76px 0 70px; }
.etorie-page .et-register h2 { margin-bottom: 12px; }
.etorie-page .et-register .et-sub { color: var(--et-mist); font-size: 15px; margin: 0 0 28px; }

.etorie-page .et-footer {
  border-top: 1px solid var(--et-line); padding: 26px 0 40px;
  display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; justify-content: space-between;
  font-size: 12px; color: var(--et-mist);
}

/* ---------- demo ---------- */
.etorie-page .et-demo-main { padding-top: 40px; padding-bottom: 80px; }
.etorie-page .et-stepper {
  display: flex; flex-wrap: wrap; gap: 8px; margin: 26px 0 30px;
}
.etorie-page .et-stepper button {
  font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 14px; border-radius: 999px;
  border: 1px solid var(--et-line); background: var(--et-surface); color: var(--et-mist);
}
.etorie-page .et-stepper button[aria-current="step"] {
  background: var(--et-accent); border-color: var(--et-accent); color: #fff;
}
.etorie-page .et-stepper button:focus-visible { outline: 3px solid var(--et-accent-soft); outline-offset: 2px; }
.etorie-page .et-scene { max-width: 720px; }
.etorie-page .et-scene-pain {
  color: var(--et-mist); font-size: 14px; margin: 14px 0 6px;
  padding-left: 14px; border-left: 3px solid var(--et-line);
}
.etorie-page .et-scene-change { font-size: 15px; margin: 0 0 26px; }
.etorie-page .et-scene-change b { color: var(--et-accent); }
.etorie-page .et-scene-visual { margin: 0 0 30px; }
.etorie-page .et-demo-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 6px; }
.etorie-page .et-demo-nav .et-count { font-size: 12.5px; color: var(--et-mist); margin-left: auto; }
.etorie-page .et-mail {
  background: var(--et-surface); border: 1px solid var(--et-line); border-radius: 14px;
  box-shadow: var(--et-shadow); overflow: hidden;
}
.etorie-page .et-mail-head { padding: 12px 18px; border-bottom: 1px solid var(--et-line); font-size: 12.5px; color: var(--et-mist); }
.etorie-page .et-mail-head b { color: var(--et-ink); }
.etorie-page .et-mail-body {
  margin: 0; padding: 16px 18px; font: 13px/1.9 inherit; white-space: pre-wrap;
  font-family: inherit; color: var(--et-ink);
}
.etorie-page .et-accept-btn {
  display: inline-block; margin: 4px 0 8px; padding: 10px 26px; border-radius: 999px;
  background: var(--et-accent); color: #fff; font-weight: 700; font-size: 14px;
  pointer-events: none;
}
.etorie-page .et-note { font-size: 12px; color: var(--et-mist); }
.etorie-page .et-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
@media (max-width: 640px) { .etorie-page .et-tiles { grid-template-columns: 1fr; } }
.etorie-page .et-tile {
  background: var(--et-surface); border: 1px solid var(--et-line); border-radius: 14px;
  padding: 16px 18px;
}
.etorie-page .et-tile .et-k { font-size: 11.5px; color: var(--et-brass); font-weight: 700; letter-spacing: 0.1em; }
.etorie-page .et-tile .et-v { font-family: Georgia, "Hiragino Mincho ProN", serif; font-size: 26px; }
.etorie-page .et-bars { display: flex; flex-direction: column; gap: 10px; }
.etorie-page .et-bar-row { display: grid; grid-template-columns: 72px 1fr 84px; gap: 10px; align-items: center; font-size: 12.5px; }
.etorie-page .et-bar-track { background: var(--et-accent-soft); border-radius: 999px; height: 10px; }
.etorie-page .et-bar-fill { background: var(--et-accent); border-radius: 999px; height: 10px; }
.etorie-page .et-bar-amount { text-align: right; color: var(--et-mist); }

/* デモ内に埋め込む natori 実UI（Tailwind ベース）の外枠 */
.etorie-page .et-embed {
  background: #FDF7FA; border: 1px solid var(--et-line); border-radius: 16px; padding: 16px;
  box-shadow: var(--et-shadow);
}
.etorie-page .et-embed-caption { margin: 10px 2px 0; font-size: 12px; color: var(--et-mist); }

/* motion */
@media (prefers-reduced-motion: no-preference) {
  .etorie-page .et-hero > * { animation: etRise 0.7s ease both; }
  .etorie-page .et-hero > *:nth-child(2) { animation-delay: 0.15s; }
  @keyframes etRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
}

/* ---------- 幅の狭いスマホ向けの調整 ---------- */
@media (max-width: 480px) {
  .etorie-page .et-logotype .et-latin { font-size: 22px; }
  .etorie-page .et-byline { font-size: 11px; }
  .etorie-page .et-btn { padding: 11px 20px; font-size: 14px; }
  .etorie-page .et-btn.et-btn-ghost { padding: 9px 18px; }
  .etorie-page .et-stepper { gap: 6px; }
  .etorie-page .et-stepper button { padding: 5px 10px; font-size: 11px; }
  .etorie-page .et-demo-nav { gap: 8px; }
}
`;

export default function EtorieStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

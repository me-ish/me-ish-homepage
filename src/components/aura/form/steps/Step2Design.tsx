// src/components/aura/form/steps/Step2Design.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { WorldviewBase } from "@/lib/aura/aura.worldviewPresets";
import { getWorldviewPreset } from "@/lib/aura/aura.worldviewPresets";
import type { AuraFormData } from "../auraFormTypes";

/* =========================================================
 * 定数
 * ========================================================= */
const WORLDVIEWS: WorldviewBase[] = [
  "minimal", "modern", "business", "cute", "pop",
  "dark", "cyber", "natural", "luxury", "retro",
];

const WORLDVIEW_META: Record<WorldviewBase, {
  label: string;
  desc: string;
  colors: { primary: string; accent: string; bg: string };
}> = {
  minimal:  { label: "Minimal",  desc: "シンプル＆洗練",       colors: { primary: "#111827", accent: "#6B7280", bg: "#F9FAFB" } },
  modern:   { label: "Modern",   desc: "先進的＆クール",       colors: { primary: "#38BDF8", accent: "#94A3B8", bg: "#020617" } },
  business: { label: "Business", desc: "信頼感＆プロ",         colors: { primary: "#2563EB", accent: "#0F172A", bg: "#EFF6FF" } },
  cute:     { label: "Cute",     desc: "かわいい＆親しみ",     colors: { primary: "#FB7185", accent: "#FDBA74", bg: "#FEF2F2" } },
  pop:      { label: "Pop",      desc: "元気＆カラフル",       colors: { primary: "#F97316", accent: "#EC4899", bg: "#FEF3C7" } },
  dark:     { label: "Dark",     desc: "クール＆神秘的",       colors: { primary: "#F97316", accent: "#E5E7EB", bg: "#020617" } },
  cyber:    { label: "Cyber",    desc: "未来的＆ネオン",       colors: { primary: "#22D3EE", accent: "#A855F7", bg: "#020617" } },
  natural:  { label: "Natural",  desc: "自然＆温かみ",         colors: { primary: "#22C55E", accent: "#A3E635", bg: "#ECFDF3" } },
  luxury:   { label: "Luxury",   desc: "高級＆エレガント",     colors: { primary: "#FACC15", accent: "#FEFCE8", bg: "#020617" } },
  retro:    { label: "Retro",    desc: "レトロ＆ノスタルジック", colors: { primary: "#D97706", accent: "#78350F", bg: "#FFFBEB" } },
};

/** フォーム全体で使う固定ニュートラルスタイル */
const UI = {
  panelBg:        "#F9FAFB",
  borderColor:    "#E5E7EB",
  selectedBorder: "#6366F1",
  selectedBg:     "#EEF2FF",
  textColor:      "#111827",
  mutedColor:     "#6B7280",
  accentColor:    "#6366F1",
  radius:         "10px",
  cardBg:         "white",
  unselectedBg:   "rgba(0,0,0,0.02)",
};

/** パレット候補（18色 × 3行） */
const COLOR_PALETTE: string[] = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
  "#14B8A6", "#06B6D4", "#38BDF8", "#3B82F6", "#6366F1", "#8B5CF6",
  "#A855F7", "#EC4899", "#F43F5E", "#FACC15", "#64748B", "#111827",
];

const FONT_PRESETS = [
  { id: "cleanJa",      label: "クリーン",   desc: "読みやすい",  sampleClass: "ai-portfolio-font-cleanJa" },
  { id: "modernSans",   label: "モダン",     desc: "スタイリッシュ", sampleClass: "ai-portfolio-font-modernSans" },
  { id: "formalMincho", label: "明朝体",     desc: "格調・信頼",  sampleClass: "ai-portfolio-font-formalMincho" },
  { id: "cuteRound",    label: "丸ゴシック", desc: "やわらか",    sampleClass: "ai-portfolio-font-cuteRound" },
  { id: "popBold",      label: "ポップ",     desc: "インパクト",  sampleClass: "ai-portfolio-font-popBold" },
  { id: "techMono",     label: "等幅 Tech",  desc: "未来感",      sampleClass: "ai-portfolio-font-techMono" },
  { id: "luxurySerif",  label: "セリフ",     desc: "エレガント",  sampleClass: "ai-portfolio-font-luxurySerif" },
  { id: "retroPixel",   label: "レトロ",     desc: "個性派",      sampleClass: "ai-portfolio-font-retroPixel" },
];

const ABOUT_LAYOUTS: { id: AuraFormData["aboutLayout"]; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "center",
    label: "センター",
    desc: "中央揃え",
    icon: (
      <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
        <circle cx="20" cy="8" r="5" fill="currentColor" opacity="0.6" />
        <rect x="8" y="16" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.4" />
        <rect x="10" y="22" width="20" height="2.5" rx="1.25" fill="currentColor" opacity="0.25" />
      </svg>
    ),
  },
  {
    id: "splitTextLeft",
    label: "テキスト左",
    desc: "文章左・アバター右",
    icon: (
      <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
        <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
        <rect x="3" y="12" width="18" height="2.5" rx="1.25" fill="currentColor" opacity="0.4" />
        <rect x="3" y="18" width="14" height="2.5" rx="1.25" fill="currentColor" opacity="0.3" />
        <circle cx="31" cy="14" r="6" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "splitTextRight",
    label: "テキスト右",
    desc: "アバター左・文章右",
    icon: (
      <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
        <circle cx="9" cy="14" r="6" fill="currentColor" opacity="0.5" />
        <rect x="19" y="6" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.7" />
        <rect x="19" y="12" width="18" height="2.5" rx="1.25" fill="currentColor" opacity="0.4" />
        <rect x="19" y="18" width="14" height="2.5" rx="1.25" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
];

const SURFACE_STYLES = [
  { id: "simple", label: "シンプル", desc: "枠なし" },
  { id: "card",   label: "カード",   desc: "白カード" },
  { id: "glass",  label: "グラス",   desc: "透明感" },
  { id: "paper",  label: "ペーパー", desc: "紙質感" },
  { id: "neon",   label: "ネオン",   desc: "光る縁" },
  { id: "dark",   label: "ダーク",   desc: "暗背景" },
];

const SHOWCASE_STYLES = [
  { id: "gallery",  label: "グリッド",   desc: "整列配置",   icon: "⊞" },
  { id: "masonry",  label: "マソンリー", desc: "高さ不揃い", icon: "⊟" },
  { id: "card",     label: "カード",     desc: "横並び",     icon: "☰" },
  { id: "textRich", label: "テキスト",   desc: "文章重視",   icon: "≡" },
];

const AVATAR_SHAPES: { id: AuraFormData["avatarShape"]; label: string }[] = [
  { id: "circle",  label: "円形" },
  { id: "rounded", label: "角丸" },
  { id: "square",  label: "四角" },
];

const AVATAR_SIZES: { id: AuraFormData["avatarSize"]; label: string; desc: string }[] = [
  { id: "sm", label: "S", desc: "小" },
  { id: "md", label: "M", desc: "標準" },
  { id: "lg", label: "L", desc: "大" },
];

/* =========================================================
 * Sub-components
 * ========================================================= */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: UI.mutedColor }}>
      {children}
    </p>
  );
}

/* =========================================================
 * Main
 * ========================================================= */
type Props = {
  data: AuraFormData;
  onChange: (updates: Partial<AuraFormData>) => void;
};

export function Step2Design({ data, onChange }: Props) {
  const [studioOpen, setStudioOpen] = useState(false);

  const handleWorldviewSelect = (wv: WorldviewBase) => {
    const preset = getWorldviewPreset(wv);
    onChange({
      worldviewBase: wv,
      patternBase: preset.patternBase,
      surfaceStyle: preset.surfaceStyle,
      showcaseStyle: preset.showcaseStyle,
      layoutPref: preset.layoutPref,
      languageMode: preset.languageMode,
      fontPreset: preset.fontPreset,
    });
  };

  const strengthLabel = useMemo(() => {
    const s = data.aiSwing;
    if (s <= 20) return "あなたの指定を忠実に反映";
    if (s <= 60) return "世界観に沿ってバランス調整";
    if (s < 100) return "世界観を活かしつつ自由にアレンジ";
    return "フル自動でおまかせ";
  }, [data.aiSwing]);

  const avatarShapePreview = (shape: AuraFormData["avatarShape"], size = 32) => {
    const radius = shape === "circle" ? "50%" : shape === "rounded" ? "6px" : "2px";
    const bg = WORLDVIEW_META[data.worldviewBase].colors.primary;
    return (
      <span style={{ width: size, height: size, borderRadius: radius, background: bg, display: "inline-block", flexShrink: 0 }} />
    );
  };

  return (
    <div className="space-y-6" style={{ color: UI.textColor, minHeight: 0 }}>
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-xl font-semibold md:text-2xl" style={{ color: UI.textColor }}>世界観を選ぶ</h2>
        <p className="mt-2 text-sm" style={{ color: UI.mutedColor }}>
          あなたの作風に合うテンプレートを選んでください
        </p>
      </div>

      {/* 世界観グリッド */}
      <div className="mx-auto max-w-2xl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {WORLDVIEWS.map((wv) => {
            const meta = WORLDVIEW_META[wv];
            const isSelected = data.worldviewBase === wv;
            return (
              <button
                key={wv}
                type="button"
                onClick={() => handleWorldviewSelect(wv)}
                className={[
                  "group relative flex flex-col overflow-hidden border-2 p-3 text-left transition-all",
                  isSelected ? "shadow-lg" : "hover:shadow-md",
                ].join(" ")}
                style={{
                  borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                  background: isSelected ? UI.selectedBg : UI.cardBg,
                  borderRadius: "16px",
                }}
              >
                <div
                  className="mb-2 h-12 w-full rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${meta.colors.bg} 0%, ${meta.colors.primary}22 100%)` }}
                >
                  <div className="flex h-full items-center justify-center gap-1.5">
                    <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: meta.colors.primary }} />
                    <span className="h-3 w-3 rounded-full shadow-sm" style={{ backgroundColor: meta.colors.accent }} />
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: isSelected ? UI.selectedBorder : UI.textColor }}>
                  {meta.label}
                </span>
                <span className="text-[10px]" style={{ color: UI.mutedColor }}>{meta.desc}</span>
                {isSelected && (
                  <div
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
                    style={{ background: UI.accentColor }}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 調整度スライダー */}
      <div
        className="mx-auto max-w-md border p-5"
        style={{ background: UI.panelBg, borderColor: UI.borderColor, color: UI.textColor, borderRadius: UI.radius }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: UI.textColor }}>調整度</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: `${UI.accentColor}22`, color: UI.accentColor }}
          >
            {data.aiSwing}%
          </span>
        </div>
        <input
          type="range" min={0} max={100} value={data.aiSwing}
          onChange={(e) => onChange({ aiSwing: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{ accentColor: UI.accentColor, background: "rgba(0,0,0,0.1)" }}
        />
        <div className="mt-2 flex justify-between text-[10px]" style={{ color: UI.mutedColor }}>
          <span>指定通り</span>
          <span>おまかせ</span>
        </div>
        <p
          className="mt-3 rounded-lg px-3 py-2 text-center text-xs"
          style={{ background: "rgba(0,0,0,0.05)", color: UI.textColor }}
        >
          {strengthLabel}
        </p>
      </div>

      {/* ── スタジオ詳細 ── */}
      <div className="mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => setStudioOpen((v) => !v)}
          className="flex w-full items-center justify-between border px-4 py-3 text-sm font-medium transition-colors"
          style={{ background: UI.panelBg, borderColor: UI.borderColor, color: UI.textColor, borderRadius: UI.radius }}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            スタイル詳細
          </span>
          <ChevronDown
            className={["h-4 w-4 transition-transform duration-200", studioOpen ? "rotate-180" : ""].join(" ")}
            style={{ color: UI.mutedColor }}
          />
        </button>

        {studioOpen && (
          <div
            className="mt-2 space-y-6 border px-5 py-5"
            style={{ background: UI.panelBg, borderColor: UI.borderColor, borderRadius: UI.radius }}
          >

            {/* ── フォント ── */}
            <div>
              <SectionLabel>フォント</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {FONT_PRESETS.map((f) => {
                  const isSelected = data.fontPreset === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onChange({ fontPreset: f.id })}
                      className="flex flex-col items-center gap-1 border-2 px-2 py-2.5 text-center transition-all"
                      style={{
                        borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                        background: isSelected ? UI.selectedBg : UI.unselectedBg,
                        borderRadius: UI.radius,
                        color: UI.textColor,
                      }}
                    >
                      <span className={`${f.sampleClass} text-base leading-none font-bold`}>あAg</span>
                      <span className="text-[10px] font-medium leading-none" style={{ color: UI.textColor }}>{f.label}</span>
                      <span className="text-[9px] leading-none" style={{ color: UI.mutedColor }}>{f.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── About配置 ── */}
            <div>
              <SectionLabel>About配置</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {ABOUT_LAYOUTS.map((al) => {
                  const isSelected = data.aboutLayout === al.id;
                  return (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => onChange({ aboutLayout: al.id })}
                      className="flex flex-col items-center gap-2 border-2 px-2 py-3 transition-all"
                      style={{
                        borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                        background: isSelected ? UI.selectedBg : UI.unselectedBg,
                        borderRadius: UI.radius,
                        color: UI.textColor,
                      }}
                    >
                      <span style={{ color: isSelected ? UI.accentColor : UI.mutedColor }}>
                        {al.icon}
                      </span>
                      <div className="text-center">
                        <div className="text-xs font-semibold" style={{ color: UI.textColor }}>{al.label}</div>
                        <div className="text-[10px]" style={{ color: UI.mutedColor }}>{al.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── カードスタイル ── */}
            <div>
              <SectionLabel>カードスタイル</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {SURFACE_STYLES.map((s) => {
                  const isSelected = data.surfaceStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChange({ surfaceStyle: s.id })}
                      className="border-2 px-2 py-2.5 text-center transition-all"
                      style={{
                        borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                        background: isSelected ? UI.selectedBg : UI.unselectedBg,
                        borderRadius: UI.radius,
                      }}
                    >
                      <div className="text-xs font-semibold" style={{ color: UI.textColor }}>{s.label}</div>
                      <div className="text-[10px]" style={{ color: UI.mutedColor }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── ギャラリースタイル ── */}
            <div>
              <SectionLabel>ギャラリースタイル</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {SHOWCASE_STYLES.map((s) => {
                  const isSelected = data.showcaseStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChange({ showcaseStyle: s.id })}
                      className="flex flex-col items-center gap-1 border-2 px-2 py-2.5 text-center transition-all"
                      style={{
                        borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                        background: isSelected ? UI.selectedBg : UI.unselectedBg,
                        borderRadius: UI.radius,
                      }}
                    >
                      <span className="text-base leading-none">{s.icon}</span>
                      <span className="text-[10px] font-semibold leading-none" style={{ color: UI.textColor }}>{s.label}</span>
                      <span className="text-[9px] leading-none" style={{ color: UI.mutedColor }}>{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── アバター ── */}
            <div>
              <SectionLabel>アバター</SectionLabel>
              <div className="space-y-3">
                {/* 形状 */}
                <div>
                  <p className="mb-1.5 text-[11px]" style={{ color: UI.mutedColor }}>形状</p>
                  <div className="flex gap-2">
                    {AVATAR_SHAPES.map((s) => {
                      const isSelected = data.avatarShape === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onChange({ avatarShape: s.id })}
                          className="flex flex-1 flex-col items-center gap-2 border-2 py-3 transition-all"
                          style={{
                            borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                            background: isSelected ? UI.selectedBg : UI.unselectedBg,
                            borderRadius: UI.radius,
                          }}
                        >
                          {avatarShapePreview(s.id, 28)}
                          <span className="text-[10px] font-medium" style={{ color: UI.textColor }}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* サイズ */}
                <div>
                  <p className="mb-1.5 text-[11px]" style={{ color: UI.mutedColor }}>サイズ</p>
                  <div className="flex gap-2">
                    {AVATAR_SIZES.map((s) => {
                      const isSelected = data.avatarSize === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onChange({ avatarSize: s.id })}
                          className="flex flex-1 flex-col items-center gap-1 border-2 py-2.5 transition-all"
                          style={{
                            borderColor: isSelected ? UI.selectedBorder : UI.borderColor,
                            background: isSelected ? UI.selectedBg : UI.unselectedBg,
                            borderRadius: UI.radius,
                          }}
                        >
                          <span className="text-sm font-bold" style={{ color: UI.textColor }}>{s.label}</span>
                          <span className="text-[10px]" style={{ color: UI.mutedColor }}>{s.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 差し色 ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>差し色</SectionLabel>
                {data.color && (
                  <button
                    type="button"
                    onClick={() => onChange({ color: "" })}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors"
                    style={{ background: "rgba(0,0,0,0.07)", color: UI.textColor }}
                  >
                    テーマ準拠に戻す
                  </button>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2 min-h-[24px]">
                {data.color ? (
                  <>
                    <span className="h-5 w-5 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: data.color, borderColor: UI.borderColor }} />
                    <span className="font-mono text-xs" style={{ color: UI.textColor }}>{data.color}</span>
                  </>
                ) : (
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ borderColor: UI.borderColor, background: `${UI.accentColor}15`, color: UI.accentColor }}
                  >
                    テーマ準拠
                  </span>
                )}
              </div>

              {(() => {
                const tc = WORLDVIEW_META[data.worldviewBase].colors;
                return (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: UI.mutedColor }}>テーマカラー</p>
                    <div className="flex gap-2">
                      {([{ hex: tc.primary, label: "プライマリ" }, { hex: tc.accent, label: "アクセント" }] as { hex: string; label: string }[]).map(({ hex, label }) => (
                        <button key={hex} type="button" onClick={() => onChange({ color: hex })} title={`${label}: ${hex}`}
                          className={["h-7 w-7 rounded-full border-2 shadow-sm transition-all hover:scale-110", data.color === hex ? "scale-110" : ""].join(" ")}
                          style={{ backgroundColor: hex, borderColor: data.color === hex ? UI.selectedBorder : UI.borderColor }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: UI.mutedColor }}>カスタムカラー</p>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => onChange({ color: c })} title={c}
                    className={["h-7 w-7 rounded-full border-2 shadow-sm transition-all hover:scale-110", data.color === c ? "scale-110" : ""].join(" ")}
                    style={{ backgroundColor: c, borderColor: data.color === c ? UI.selectedBorder : "rgba(128,128,128,0.4)" }}
                  />
                ))}
              </div>
            </div>

            {/* ── 文章トーン ── */}
            <label className="block">
              <SectionLabel>文章トーン</SectionLabel>
              <p className="mb-2 text-[11px]" style={{ color: UI.mutedColor }}>AIが生成するコピーの語調</p>
              <select
                value={data.tone}
                onChange={(e) => onChange({ tone: e.target.value as AuraFormData["tone"] })}
                className="w-full border px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  background: UI.panelBg,
                  borderColor: UI.borderColor,
                  color: UI.textColor,
                  borderRadius: UI.radius,
                }}
              >
                <option value="ですます">丁寧（ですます）</option>
                <option value="フレンドリー">フレンドリー</option>
              </select>
            </label>

          </div>
        )}
      </div>
    </div>
  );
}

// src/lib/aura/studio/designPresets.ts

// ── フォントプリセット ────────────────────────────────────
export type FontPresetId = 'cleanJa' | 'serifJa' | 'rounded' | 'mono' | 'display';

export type FontPreset = {
  id: FontPresetId;
  label: string;
  description: string;
  fontFamily: string;
  /** Google Fonts の @import URL（null = システムフォントのみ） */
  googleFontUrl: string | null;
  /** プレビュー用サンプルテキスト */
  sample: string;
};

export const FONT_PRESETS: Record<FontPresetId, FontPreset> = {
  cleanJa: {
    id: 'cleanJa',
    label: 'クリーン',
    description: 'すっきり読みやすいゴシック',
    fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap',
    sample: 'Aa あいう',
  },
  serifJa: {
    id: 'serifJa',
    label: '明朝体',
    description: '品格のある明朝系',
    fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap',
    sample: 'Aa あいう',
  },
  rounded: {
    id: 'rounded',
    label: '丸ゴシック',
    description: '親しみやすくやわらか',
    fontFamily: '"M PLUS Rounded 1c", "BIZ UDGothic", sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700&display=swap',
    sample: 'Aa あいう',
  },
  mono: {
    id: 'mono',
    label: 'モノスペース',
    description: 'クールでテック系',
    fontFamily: '"JetBrains Mono", "Source Code Pro", monospace',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap',
    sample: 'Aa abc',
  },
  display: {
    id: 'display',
    label: 'ディスプレイ',
    description: '洗練されたエレガント',
    fontFamily: '"Cormorant Garamond", "Times New Roman", serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=swap',
    sample: 'Aa Portfolio',
  },
};

export const FONT_PRESET_LIST = Object.values(FONT_PRESETS);

export function getFontPreset(id: string): FontPreset {
  return FONT_PRESETS[id as FontPresetId] ?? FONT_PRESETS.cleanJa;
}

// ── アクセントカラープリセット ─────────────────────────────
export type AccentColorPreset = { color: string; label: string };

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  { color: '#00a1e9', label: 'スカイブルー' },
  { color: '#6366f1', label: 'インディゴ' },
  { color: '#8b5cf6', label: 'パープル' },
  { color: '#ec4899', label: 'ピンク' },
  { color: '#ef4444', label: 'レッド' },
  { color: '#f97316', label: 'オレンジ' },
  { color: '#f59e0b', label: 'アンバー' },
  { color: '#10b981', label: 'エメラルド' },
  { color: '#14b8a6', label: 'ティール' },
  { color: '#64748b', label: 'スレート' },
  { color: '#1a1a2e', label: 'ネイビー' },
  { color: '#1a1a1a', label: 'チャコール' },
];

// ── ヘッダーレイアウト ──────────────────────────────────────
export const LAYOUT_PREF_OPTIONS = [
  { value: 'center',     label: '中央縦',   description: 'アバター・テキストを縦に中央揃え' },
  { value: 'left',       label: '左縦',     description: 'アバター・テキストを縦に左揃え' },
  { value: 'side-left',  label: '横（左）', description: 'アバター左・テキスト右の横並び' },
  { value: 'side-right', label: '横（右）', description: 'テキスト左・アバター右の横並び' },
  { value: 'banner',     label: 'バナー',   description: 'テキスト上・アバターが下からはみ出す' },
] as const;

export type LayoutPref = 'center' | 'left' | 'side-left' | 'side-right' | 'banner' | '';

// ── アバター形状 ──────────────────────────────────────────
export type AvatarShape = 'circle' | 'rounded' | 'square';

export const AVATAR_SHAPE_OPTIONS: { value: AvatarShape; label: string; borderRadius: string }[] = [
  { value: 'circle',  label: '丸',       borderRadius: '50%' },
  { value: 'rounded', label: '角丸',     borderRadius: '16px' },
  { value: 'square',  label: '四角',     borderRadius: '0' },
];

export function getAvatarBorderRadius(shape: AvatarShape): string {
  return AVATAR_SHAPE_OPTIONS.find((o) => o.value === shape)?.borderRadius ?? '50%';
}

// ── 背景テクスチャ ───────────────────────────────────────
export type BgPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'cross';

export const BG_PATTERN_OPTIONS: { value: BgPattern; label: string; preview: string }[] = [
  { value: 'none',     label: 'なし',    preview: '' },
  { value: 'dots',     label: 'ドット',  preview: 'radial-gradient(circle, currentColor 1px, transparent 1px)' },
  { value: 'grid',     label: 'グリッド', preview: '' },
  { value: 'diagonal', label: '斜線',    preview: '' },
  { value: 'cross',    label: 'クロス',  preview: '' },
];

/**
 * 背景テクスチャの CSS style オブジェクトを返す
 * @param pattern  テクスチャ種別
 * @param color    ラインの色（例: colors.border）
 */
export function getBgPatternStyle(
  pattern: BgPattern,
  color: string,
): React.CSSProperties {
  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${color} 1.5px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
      };
    case 'grid':
      return {
        backgroundImage: [
          `linear-gradient(to right, ${color} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: '28px 28px',
      };
    case 'diagonal':
      return {
        backgroundImage: `repeating-linear-gradient(
          45deg,
          ${color} 0px,
          ${color} 1px,
          transparent 1px,
          transparent 18px
        )`,
      };
    case 'cross':
      return {
        backgroundImage: [
          `linear-gradient(to right, ${color} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        ].join(', '),
        backgroundSize: '40px 40px',
        backgroundPosition: '-0.5px -0.5px',
      };
    case 'none':
    default:
      return {};
  }
}

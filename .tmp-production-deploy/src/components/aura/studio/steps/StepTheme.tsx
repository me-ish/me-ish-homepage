// src/components/aura/studio/steps/StepTheme.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import ThemeSelector from '../ThemeSelector';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';
import {
  FONT_PRESET_LIST,
  ACCENT_COLOR_PRESETS,
  LAYOUT_PREF_OPTIONS,
  AVATAR_SHAPE_OPTIONS,
  BG_PATTERN_OPTIONS,
  getFontPreset,
  getBgPatternStyle,
} from '@/lib/aura/studio/designPresets';

type Props = {
  form: StudioFormData;
  onChange: (patch: Partial<StudioFormData>) => void;
};

// HEXカラー入力のバリデーション
function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

export default function StepTheme({ form, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHex, setCustomHex] = useState('');

  const currentFont = getFontPreset(form.fontPreset);

  function handleCustomHexChange(val: string) {
    setCustomHex(val);
    if (isValidHex(val)) {
      onChange({ accentColor: val });
    }
  }

  return (
    <div className="space-y-6">
      {/* ── ベーステーマ ── */}
      <div>
        <h2 className="text-lg font-bold">テーマを選ぶ</h2>
        <p className="text-sm text-gray-500 mt-1">
          ポートフォリオ全体の見た目を選択します。
        </p>
      </div>

      <ThemeSelector
        value={form.themeId}
        onChange={(themeId) => onChange({ themeId: themeId as StudioFormData['themeId'] })}
      />

      {/* ── 詳細カスタマイズ トグル ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-600 hover:border-[#00a1e9]/50 hover:text-[#00a1e9] transition-colors"
      >
        <span className="font-medium">
          {showAdvanced ? '詳細カスタマイズを閉じる' : '詳細カスタマイズ（上級者向け）'}
        </span>
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showAdvanced && (
        <div className="space-y-8 rounded-xl border border-gray-100 bg-gray-50/50 p-5">

          {/* アクセントカラー */}
          <section>
            <h3 className="text-sm font-bold mb-3">アクセントカラー</h3>
            <div className="flex flex-wrap gap-2.5 mb-3">
              {ACCENT_COLOR_PRESETS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { onChange({ accentColor: color }); setCustomHex(''); }}
                  title={label}
                  className="relative w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
                  style={{ background: color, boxShadow: form.accentColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : undefined }}
                  aria-pressed={form.accentColor === color}
                  aria-label={label}
                >
                  {form.accentColor === color && (
                    <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
            {/* カスタム HEX */}
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full border border-gray-200 shrink-0"
                style={{ background: isValidHex(customHex) ? customHex : form.accentColor }}
              />
              <input
                type="text"
                className="w-28 rounded-lg border px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
                placeholder="#000000"
                value={customHex || (ACCENT_COLOR_PRESETS.some(p => p.color === form.accentColor) ? '' : form.accentColor)}
                onChange={(e) => handleCustomHexChange(e.target.value)}
                maxLength={7}
              />
              <span className="text-xs text-gray-400">カスタムカラー</span>
            </div>
          </section>

          {/* フォント */}
          <section>
            <h3 className="text-sm font-bold mb-3">フォント</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONT_PRESET_LIST.map((preset) => {
                const selected = form.fontPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({ fontPreset: preset.id })}
                    className={[
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                      selected
                        ? 'border-[#00a1e9] bg-[#f0f9ff] ring-1 ring-[#00a1e9]/30'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    {/* サンプルテキスト */}
                    <span
                      className="text-base font-bold shrink-0 w-14 text-center leading-tight"
                      style={{ fontFamily: preset.fontFamily, color: selected ? form.accentColor : '#374151' }}
                    >
                      {preset.sample}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800">{preset.label}</span>
                      <span className="block text-xs text-gray-400 truncate">{preset.description}</span>
                    </span>
                    {selected && <Check className="w-4 h-4 ml-auto shrink-0 text-[#00a1e9]" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ヘッダー配置 */}
          <section>
            <h3 className="text-sm font-bold mb-1">ヘッダー配置</h3>
            <p className="text-xs text-gray-400 mb-3">名前・アバターの配置スタイル</p>
            <div className="grid grid-cols-3 gap-2">
              {/* テーマデフォルト */}
              {[{ value: '', label: 'テーマ既定' }, ...LAYOUT_PREF_OPTIONS].map((opt) => {
                const selected = form.layoutPref === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ layoutPref: opt.value })}
                    className={[
                      'flex flex-col items-center gap-2 px-2 py-3 rounded-xl border transition-all',
                      selected
                        ? 'border-[#00a1e9] bg-[#f0f9ff] ring-1 ring-[#00a1e9]/30'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    <LayoutIcon value={opt.value} accent={selected ? form.accentColor : '#9ca3af'} />
                    <span className={`text-xs font-medium ${selected ? 'text-[#00a1e9]' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* アバター形状 */}
          <section>
            <h3 className="text-sm font-bold mb-3">アバター形状</h3>
            <div className="flex gap-3">
              {AVATAR_SHAPE_OPTIONS.map((opt) => {
                const selected = (form.avatarShape || 'circle') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ avatarShape: opt.value })}
                    className={[
                      'flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all',
                      selected
                        ? 'border-[#00a1e9] bg-[#f0f9ff] ring-1 ring-[#00a1e9]/30'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    {/* 形状プレビュー */}
                    <div
                      className="w-10 h-10 shrink-0"
                      style={{
                        background: selected ? form.accentColor : '#d1d5db',
                        borderRadius: opt.borderRadius,
                      }}
                    />
                    <span className={`text-xs font-medium ${selected ? 'text-[#00a1e9]' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 背景テクスチャ */}
          <section>
            <h3 className="text-sm font-bold mb-3">背景テクスチャ</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {BG_PATTERN_OPTIONS.map((opt) => {
                const selected = (form.bgPattern || 'none') === opt.value;
                const patternStyle = getBgPatternStyle(opt.value as Parameters<typeof getBgPatternStyle>[0], '#9ca3af');
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ bgPattern: opt.value })}
                    className={[
                      'flex flex-col items-center gap-2 px-2 py-3 rounded-xl border transition-all',
                      selected
                        ? 'border-[#00a1e9] bg-[#f0f9ff] ring-1 ring-[#00a1e9]/30'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    ].join(' ')}
                  >
                    {/* テクスチャプレビュー */}
                    <div
                      className="w-10 h-10 rounded-lg border border-gray-200"
                      style={{ background: '#f9fafb', ...patternStyle }}
                    />
                    <span className={`text-xs font-medium ${selected ? 'text-[#00a1e9]' : 'text-gray-600'}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 現在の設定サマリー */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">現在の設定：</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-full inline-block border border-gray-200" style={{ background: form.accentColor }} />
              {form.accentColor}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-600">{currentFont.label}</span>
            {form.layoutPref && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-600">
                  {[...LAYOUT_PREF_OPTIONS].find(o => o.value === form.layoutPref)?.label}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── レイアウトアイコン（ミニプレビュー） ──────────────────────
function LayoutIcon({ value, accent }: { value: string; accent: string }) {
  const bg = accent;
  const line = '#d1d5db';
  // アバター（丸）と テキスト行（矩形）を使ってレイアウトを図示
  const Avatar = ({ size = 12 }: { size?: number }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0 }} />
  );
  const Lines = ({ align = 'left' }: { align?: 'left' | 'center' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: align === 'center' ? 'center' : 'flex-start', flex: 1 }}>
      <div style={{ width: 28, height: 4, borderRadius: 2, background: bg, opacity: 0.8 }} />
      <div style={{ width: 20, height: 3, borderRadius: 2, background: line }} />
      <div style={{ width: 24, height: 3, borderRadius: 2, background: line }} />
    </div>
  );

  const wrap: React.CSSProperties = { width: 48, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  if (value === '' ) return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Avatar size={10} />
        <div style={{ width: 24, height: 3, borderRadius: 2, background: line }} />
        <div style={{ width: 18, height: 3, borderRadius: 2, background: line }} />
      </div>
    </div>
  );
  if (value === 'center') return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Avatar />
        <Lines align="center" />
      </div>
    </div>
  );
  if (value === 'left') return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <Avatar />
        <Lines align="left" />
      </div>
    </div>
  );
  if (value === 'side-left') return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Avatar />
        <Lines />
      </div>
    </div>
  );
  if (value === 'side-right') return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
        <Avatar />
        <Lines />
      </div>
    </div>
  );
  if (value === 'banner') return (
    <div style={{ ...wrap, position: 'relative', overflow: 'visible' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '100%' }}>
        <Lines align="center" />
        <div style={{ position: 'absolute', bottom: -6 }}>
          <Avatar size={14} />
        </div>
      </div>
    </div>
  );
  return null;
}

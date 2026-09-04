// src/components/aura/studio/steps/StepProfile.tsx
'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import AuraImageUploader from '@/components/aura/AuraImageUploader';
import type { StudioFormData } from '@/lib/aura/studio/studioTypes';
import { TAGLINE_EXAMPLES } from '@/lib/aura/studio/skillPresets';
import { CSRF_HEADERS } from '@/lib/auth/csrf';

type Props = {
  form: StudioFormData;
  projectId: string | null;
  onChange: (patch: Partial<StudioFormData>) => void;
};

type PolishState = {
  loading: boolean;
  suggestion: string | null;
  error: string | null;
};

const INIT_POLISH: PolishState = { loading: false, suggestion: null, error: null };

async function callPolish(field: 'bio' | 'tagline' | 'displayTitle', text: string) {
  const res = await fetch('/api/aura/studio/ai/polish', {
    method: 'POST',
    headers: { ...CSRF_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, text }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'ai_failed');
  return json.result as string;
}

// AI整えボタン + 提案表示コンポーネント
function AiPolishWidget({
  field,
  currentText,
  onApply,
}: {
  field: 'bio' | 'tagline' | 'displayTitle';
  currentText: string;
  onApply: (text: string) => void;
}) {
  const [state, setState] = useState<PolishState>(INIT_POLISH);

  async function handlePolish() {
    if (!currentText.trim()) return;
    setState({ loading: true, suggestion: null, error: null });
    try {
      const result = await callPolish(field, currentText);
      setState({ loading: false, suggestion: result, error: null });
    } catch {
      setState({ loading: false, suggestion: null, error: 'AIの処理に失敗しました。もう一度お試しください。' });
    }
  }

  function handleApply() {
    if (state.suggestion) {
      onApply(state.suggestion);
      setState(INIT_POLISH);
    }
  }

  function handleDiscard() {
    setState(INIT_POLISH);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePolish}
        disabled={state.loading || !currentText.trim()}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-[#00a1e9]/30 text-[#00a1e9] hover:bg-[#e8f7ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {state.loading ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> 整えています…</>
        ) : (
          <><Sparkles className="w-3 h-3" /> AIで整える</>
        )}
      </button>

      {state.error && (
        <p className="mt-1 text-xs text-red-500">{state.error}</p>
      )}

      {state.suggestion && (
        <div className="mt-2 rounded-lg border border-[#00a1e9]/20 bg-[#f0f9ff] p-3 space-y-2">
          <p className="text-[10px] font-semibold text-[#00a1e9] uppercase tracking-wider">AI の提案</p>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{state.suggestion}</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-[#00a1e9] text-white hover:brightness-105 transition"
            >
              <Check className="w-3 h-3" /> 使う
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <X className="w-3 h-3" /> 破棄
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StepProfile({ form, projectId, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">プロフィール</h2>

      {/* 名前 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          名前 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="山田 太郎"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* 肩書き */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">肩書き・職種</label>
          <AiPolishWidget
            field="displayTitle"
            currentText={form.displayTitle}
            onApply={(text) => onChange({ displayTitle: text })}
          />
        </div>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="フリーランスデザイナー / イラストレーター"
          value={form.displayTitle}
          onChange={(e) => onChange({ displayTitle: e.target.value })}
        />
      </div>

      {/* キャッチフレーズ */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">キャッチフレーズ</label>
          <AiPolishWidget
            field="tagline"
            currentText={form.tagline}
            onApply={(text) => onChange({ tagline: text })}
          />
        </div>
        <input
          type="text"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50"
          placeholder="ビジュアルで世界を豊かにする"
          value={form.tagline}
          onChange={(e) => onChange({ tagline: e.target.value })}
        />
        {/* 例文ピル */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TAGLINE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onChange({ tagline: ex })}
              className={[
                'text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                form.tagline === ex
                  ? 'border-[#00a1e9] bg-[#e8f7ff] text-[#00a1e9] font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-[#00a1e9]/50 hover:text-[#00a1e9]',
              ].join(' ')}
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">例文をクリックで入力・AIで自分らしく整えることもできます</p>
      </div>

      {/* 自己紹介 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium">自己紹介</label>
        </div>
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a1e9]/50 resize-none"
          placeholder="経歴・得意なこと・仕事への想いなど"
          rows={5}
          value={form.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
        />
        <div className="mt-1.5">
          <AiPolishWidget
            field="bio"
            currentText={form.bio}
            onApply={(text) => onChange({ bio: text })}
          />
        </div>
      </div>

      {/* アバター */}
      <div>
        <label className="block text-sm font-medium mb-1">アバター画像</label>
        <AuraImageUploader
          value={
            form.avatarPreviewUrl || form.avatarPath
              ? [{ imageUrl: form.avatarPreviewUrl || `/api/aura/assets?path=${encodeURIComponent(form.avatarPath)}`, storagePath: form.avatarPath }]
              : []
          }
          onChange={(items) => {
            if (items.length > 0) {
              onChange({
                avatarPath: items[0].storagePath ?? '',
                avatarPreviewUrl: items[0].imageUrl,
              });
            } else {
              onChange({ avatarPath: '', avatarPreviewUrl: '' });
            }
          }}
          max={1}
          requestId={projectId}
          uploadEndpointBase="/api/aura/studio/upload/avatar"
        />
      </div>
    </div>
  );
}

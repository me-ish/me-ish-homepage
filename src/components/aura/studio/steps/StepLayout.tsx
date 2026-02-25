// src/components/aura/studio/steps/StepLayout.tsx
'use client';

import { ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { StudioFormData, SectionId } from '@/lib/aura/studio/studioTypes';
import { SECTION_META } from '@/lib/aura/studio/studioTypes';

type Props = {
  form: StudioFormData;
  onChange: (patch: Partial<StudioFormData>) => void;
};

export default function StepLayout({ form, onChange }: Props) {
  const { sectionOrder, sectionVisibility } = form;

  function move(id: SectionId, direction: 'up' | 'down') {
    const idx = sectionOrder.indexOf(id);
    if (idx === -1) return;
    const next = [...sectionOrder];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange({ sectionOrder: next });
  }

  function toggleVisibility(id: SectionId) {
    onChange({
      sectionVisibility: {
        ...sectionVisibility,
        [id]: !sectionVisibility[id],
      },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">セクション構成</h2>
        <p className="text-sm text-gray-500 mt-1">
          表示するセクションの選択と順番を変更できます。ヒーロー（名前・アバター）は常に先頭です。
        </p>
      </div>

      {/* ヒーロー（固定） */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <button type="button" disabled className="p-0.5 text-gray-200 cursor-not-allowed">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button type="button" disabled className="p-0.5 text-gray-200 cursor-not-allowed">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-400">ヒーロー</p>
          <p className="text-xs text-gray-400">名前・アバター・キャッチフレーズ（固定）</p>
        </div>
        <Eye className="w-4 h-4 text-gray-300 shrink-0" />
      </div>

      {/* 並び替え可能なセクション */}
      <div className="space-y-2">
        {sectionOrder.map((id, idx) => {
          const meta = SECTION_META[id];
          const visible = sectionVisibility[id] !== false;
          const isFirst = idx === 0;
          const isLast = idx === sectionOrder.length - 1;

          return (
            <div
              key={id}
              className={[
                'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                visible
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-60',
              ].join(' ')}
            >
              {/* 上下ボタン */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(id, 'up')}
                  disabled={isFirst}
                  className="p-0.5 text-gray-400 hover:text-gray-700 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
                  aria-label={`${meta.label}を上へ`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 'down')}
                  disabled={isLast}
                  className="p-0.5 text-gray-400 hover:text-gray-700 disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
                  aria-label={`${meta.label}を下へ`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* セクション情報 */}
              <div className="flex-1 min-w-0">
                <p className={['text-sm font-semibold', visible ? 'text-gray-800' : 'text-gray-400'].join(' ')}>
                  {meta.label}
                </p>
                <p className="text-xs text-gray-400 truncate">{meta.description}</p>
              </div>

              {/* 表示トグル */}
              <button
                type="button"
                onClick={() => toggleVisibility(id)}
                className={[
                  'shrink-0 p-1.5 rounded-lg transition-colors',
                  visible
                    ? 'text-[#00a1e9] hover:bg-[#e8f7ff]'
                    : 'text-gray-300 hover:bg-gray-100',
                ].join(' ')}
                aria-label={visible ? `${meta.label}を非表示` : `${meta.label}を表示`}
                aria-pressed={visible}
              >
                {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        非表示にしたセクションはプレビューと公開ページに表示されません。
      </p>
    </div>
  );
}

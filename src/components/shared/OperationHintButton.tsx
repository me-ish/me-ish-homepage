// ✅ OperationHintButton.tsx（デバイス対応ヒントボタン）
'use client';
import { useState } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';

export function OperationHintButton() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const instructions = isMobile
    ? ['左下スティックで移動', 'スワイプで視点回転', '作品に近づくとラベル表示', 'タップで詳細表示']
    : ['WASDキーで移動', 'マウスで視点回転', '作品に近づくとラベル表示', 'クリックで詳細表示'];

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white border border-cyan-400 text-cyan-600 rounded-full w-8 h-8 text-lg font-bold shadow hover:bg-cyan-50"
        title="操作説明"
      >
        ?
      </button>
      {open && (
        <div className="mt-2 bg-white border border-cyan-300 rounded p-3 text-sm shadow max-w-xs">
          <ul className="list-disc ml-4 space-y-1">
            {instructions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

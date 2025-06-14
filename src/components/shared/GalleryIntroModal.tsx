// ✅ GalleryIntroModal.tsx（デバイス対応モーダル）
'use client';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';

export function GalleryIntroModal() {
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const shown = localStorage.getItem('meish-intro-shown');
    if (!shown) {
      setVisible(true);
      localStorage.setItem('meish-intro-shown', 'true');
    }
  }, []);

  if (!visible) return null;

  const instructions = isMobile
    ? ['左下スティックで移動', 'スワイプで視点回転', '作品に近づくとラベル表示', 'タップで詳細表示']
    : ['WASDキーで移動', 'マウスで視点回転', '作品に近づくとラベル表示', 'クリックで詳細表示'];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm text-sm text-gray-700">
        <h2 className="text-lg font-bold mb-2">操作方法</h2>
        <ul className="list-disc ml-5 space-y-1">
          {instructions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button
          onClick={() => setVisible(false)}
          className="mt-4 bg-cyan-500 text-white px-4 py-1 rounded hover:bg-cyan-600"
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
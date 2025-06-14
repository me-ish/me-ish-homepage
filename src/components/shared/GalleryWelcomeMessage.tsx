'use client';

import { useEffect, useState } from 'react';

export default function GalleryWelcomeMessage({ onOpenChat }: { onOpenChat: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem('meish-gallery-welcome');
    if (!shown) {
      setVisible(true);
      localStorage.setItem('meish-gallery-welcome', 'true');
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 bg-white border border-cyan-300 shadow-md rounded-lg p-4 max-w-xs text-sm text-gray-800">
      <p>
        ようこそ。ここは <strong>me-ish</strong> の3Dアートギャラリーです。
        アバターで自由に移動しながら、作品に近づいて鑑賞できます。
      </p>
      <button
        onClick={() => {
          setVisible(false);
          onOpenChat();
        }}
        className="mt-3 w-full text-center bg-cyan-500 text-white py-1 px-3 rounded hover:bg-cyan-600"
      >
        ガイドAIに質問する
      </button>
    </div>
  );
}

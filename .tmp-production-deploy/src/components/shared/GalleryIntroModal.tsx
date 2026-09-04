// ✅ GalleryIntroModal.tsx（デバイス対応モーダル）
'use client';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import {
  Gamepad2,
  Move,
  MousePointer2,
  Eye,
  Hand,
  Keyboard,
  Sparkles,
} from 'lucide-react';

type Instruction = {
  icon: React.ReactNode;
  text: string;
  subtext?: string;
};

export function GalleryIntroModal() {
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const shown = localStorage.getItem('meish-intro-shown');
    if (!shown) {
      setVisible(true);
      localStorage.setItem('meish-intro-shown', 'true');
      // アニメーション開始を少し遅らせる
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    }
  }, []);

  const handleClose = () => {
    setAnimateIn(false);
    setTimeout(() => setVisible(false), 300);
  };

  if (!visible) return null;

  const mobileInstructions: Instruction[] = [
    {
      icon: <Gamepad2 size={24} />,
      text: '左下スティックで移動',
      subtext: '親指でドラッグ',
    },
    {
      icon: <Hand size={24} />,
      text: 'スワイプで視点回転',
      subtext: '画面をスワイプ',
    },
    {
      icon: <Eye size={24} />,
      text: '作品に近づくと情報表示',
      subtext: '自動でラベルが出現',
    },
    {
      icon: <MousePointer2 size={24} />,
      text: 'タップで詳細表示',
      subtext: '作品をタップ',
    },
  ];

  const desktopInstructions: Instruction[] = [
    {
      icon: <Keyboard size={24} />,
      text: 'WASDキーで移動',
      subtext: '前後左右に移動',
    },
    {
      icon: <Move size={24} />,
      text: 'マウスドラッグで視点回転',
      subtext: '画面をドラッグ',
    },
    {
      icon: <Eye size={24} />,
      text: '作品に近づくと情報表示',
      subtext: '自動でラベルが出現',
    },
    {
      icon: <MousePointer2 size={24} />,
      text: 'クリックで詳細表示',
      subtext: '作品をクリック',
    },
  ];

  const instructions = isMobile ? mobileInstructions : desktopInstructions;

  return (
    <div
      className={`
        fixed inset-0 z-[100] flex items-center justify-center p-4
        transition-all duration-300
        ${animateIn ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'}
      `}
    >
      <div
        className={`
          relative w-full max-w-md
          transition-all duration-300 ease-out
          ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}
        `}
      >
        {/* カード本体 */}
        <div
          className="
            rounded-3xl overflow-hidden
            bg-gradient-to-b from-gray-900/95 to-black/95
            backdrop-blur-xl
            border border-white/10
            shadow-2xl
          "
        >
          {/* ヘッダー */}
          <div className="relative px-6 pt-8 pb-4 text-center">
            {/* 装飾グロー */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30 mb-4">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                ようこそ
              </h2>
              <p className="text-white/60 text-sm">
                3Dギャラリーの操作方法
              </p>
            </div>
          </div>

          {/* 説明リスト */}
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {instructions.map((item, index) => (
                <div
                  key={index}
                  className="
                    flex items-center gap-4 px-4 py-3
                    rounded-2xl
                    bg-white/5 hover:bg-white/10
                    transition-colors
                  "
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">
                      {item.text}
                    </p>
                    {item.subtext && (
                      <p className="text-white/50 text-xs mt-0.5">
                        {item.subtext}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* フッター */}
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={handleClose}
              className="
                w-full py-3.5 rounded-2xl
                bg-gradient-to-r from-cyan-500 to-blue-500
                hover:from-cyan-400 hover:to-blue-400
                text-white font-semibold
                shadow-lg shadow-cyan-500/30
                transition-all duration-200
                active:scale-[0.98]
              "
            >
              ギャラリーへ入る
            </button>
            <p className="text-center text-white/40 text-xs mt-3">
              右上の <span className="text-cyan-400">?</span> でいつでも確認できます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
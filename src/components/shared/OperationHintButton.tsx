// ✅ OperationHintButton.tsx（デバイス対応ヒントボタン）
'use client';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/lib/useIsMobile';
import { useZoomArtworkOptional } from './ZoomArtworkContext';
import {
  HelpCircle,
  X,
  Gamepad2,
  Move,
  MousePointer2,
  Eye,
  Hand,
  Keyboard,
} from 'lucide-react';

type Instruction = {
  icon: React.ReactNode;
  text: string;
};

export function OperationHintButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  // 作品ズーム中は非表示
  const zoomContext = useZoomArtworkOptional();
  const isArtworkZoomed = !!zoomContext?.zoomedArtwork;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-hint-container]')) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  if (!mounted || isArtworkZoomed) return null;

  const mobileInstructions: Instruction[] = [
    { icon: <Gamepad2 size={18} />, text: '左下スティックで移動' },
    { icon: <Hand size={18} />, text: 'スワイプで視点回転' },
    { icon: <Eye size={18} />, text: '作品に近づくとラベル表示' },
    { icon: <MousePointer2 size={18} />, text: 'タップで詳細表示' },
  ];

  const desktopInstructions: Instruction[] = [
    { icon: <Keyboard size={18} />, text: 'WASDキーで移動' },
    { icon: <Move size={18} />, text: 'マウスドラッグで視点回転' },
    { icon: <Eye size={18} />, text: '作品に近づくとラベル表示' },
    { icon: <MousePointer2 size={18} />, text: 'クリックで詳細表示' },
  ];

  const instructions = isMobile ? mobileInstructions : desktopInstructions;

  return (
    <div className="fixed top-4 right-4 z-50" data-hint-container>
      {/* トグルボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-300 ease-out
          ${
            open
              ? 'bg-white/90 text-cyan-600 shadow-lg scale-95'
              : 'bg-black/40 backdrop-blur-md text-white/90 hover:bg-black/60 hover:text-white border border-white/20'
          }
        `}
        title="操作説明"
        aria-label={open ? '閉じる' : '操作説明を表示'}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <HelpCircle size={20} />}
      </button>

      {/* ドロップダウンパネル */}
      <div
        className={`
          absolute top-12 right-0 w-64
          transition-all duration-300 ease-out origin-top-right
          ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
        `}
      >
        <div
          className="
            rounded-2xl overflow-hidden
            bg-black/70 backdrop-blur-xl
            border border-white/20
            shadow-2xl
          "
        >
          {/* ヘッダー */}
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white/90 font-semibold text-sm flex items-center gap-2">
              <Gamepad2 size={16} className="text-cyan-400" />
              操作方法
            </h3>
          </div>

          {/* 説明リスト */}
          <ul className="p-3 space-y-1">
            {instructions.map((item, index) => (
              <li
                key={index}
                className="
                  flex items-center gap-3 px-3 py-2.5
                  rounded-xl
                  text-white/80 text-sm
                  hover:bg-white/10 transition-colors
                "
              >
                <span className="text-cyan-400 flex-shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>

          {/* フッター */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/5">
            <p className="text-white/50 text-xs text-center">
              {isMobile ? 'モバイル操作' : 'PC操作'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

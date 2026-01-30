'use client';

import React, { useMemo } from 'react';

type BubblePosition = {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
};

// デスクトップ用のバブル配置
const BUBBLE_POSITIONS_DESKTOP: BubblePosition[] = [
  { x: 8, y: 15, size: 80, delay: 0, duration: 8, opacity: 0.4 },
  { x: 85, y: 10, size: 60, delay: 0.5, duration: 10, opacity: 0.35 },
  { x: 5, y: 45, size: 50, delay: 1, duration: 9, opacity: 0.3 },
  { x: 90, y: 50, size: 70, delay: 1.5, duration: 11, opacity: 0.38 },
  { x: 12, y: 75, size: 45, delay: 2, duration: 7, opacity: 0.28 },
  { x: 82, y: 78, size: 55, delay: 2.5, duration: 10, opacity: 0.32 },
  { x: 75, y: 25, size: 40, delay: 3, duration: 8, opacity: 0.25 },
  { x: 20, y: 35, size: 35, delay: 3.5, duration: 9, opacity: 0.22 },
];

// モバイル用のバブル配置（少なめ）
const BUBBLE_POSITIONS_MOBILE: BubblePosition[] = [
  { x: 8, y: 12, size: 50, delay: 0, duration: 8, opacity: 0.35 },
  { x: 85, y: 15, size: 40, delay: 0.5, duration: 9, opacity: 0.3 },
  { x: 6, y: 65, size: 35, delay: 1, duration: 10, opacity: 0.28 },
  { x: 82, y: 70, size: 45, delay: 1.5, duration: 8, opacity: 0.32 },
];

function Bubble({
  x,
  y,
  size,
  delay,
  duration,
  opacity,
  mouseX = 0.5,
  mouseY = 0.5,
}: BubblePosition & { mouseX?: number; mouseY?: number }) {
  const parallaxX = (mouseX - 0.5) * 15;
  const parallaxY = (mouseY - 0.5) * 15;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        transform: `translate(${parallaxX * (1 + delay * 0.1)}px, ${parallaxY * (1 + delay * 0.1)}px)`,
        animation: `bubble-float ${duration}s ease-in-out infinite, bubble-fade-in 1s ease-out ${delay}s forwards`,
        animationDelay: `${delay}s`,
        opacity: 0,
      }}
    >
      <div
        className="relative w-full h-full rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, rgba(0,161,233,${opacity}) 40%, rgba(0,161,233,${opacity * 0.5}) 100%)`,
          boxShadow: `
            inset -2px -2px 8px rgba(255,255,255,0.4),
            inset 2px 2px 8px rgba(0,161,233,0.2),
            0 4px 20px rgba(0,161,233,0.15)
          `,
        }}
      >
        {/* Highlight */}
        <div
          className="absolute rounded-full bg-white/60"
          style={{
            width: '25%',
            height: '25%',
            top: '15%',
            left: '20%',
            filter: 'blur(1px)',
          }}
        />
        {/* Secondary highlight */}
        <div
          className="absolute rounded-full bg-white/30"
          style={{
            width: '15%',
            height: '15%',
            top: '35%',
            left: '60%',
            filter: 'blur(1px)',
          }}
        />
      </div>
    </div>
  );
}

type FloatingBubblesProps = {
  variant?: 'desktop' | 'mobile';
  mouseX?: number;
  mouseY?: number;
};

export function FloatingBubbles({ variant = 'desktop', mouseX = 0.5, mouseY = 0.5 }: FloatingBubblesProps) {
  const positions = variant === 'mobile' ? BUBBLE_POSITIONS_MOBILE : BUBBLE_POSITIONS_DESKTOP;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none">
        {positions.map((bubble, idx) => (
          <Bubble key={idx} {...bubble} mouseX={mouseX} mouseY={mouseY} />
        ))}
      </div>

      <style jsx global>{`
        @keyframes bubble-float {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-25px) scale(1.05);
          }
        }

        @keyframes bubble-fade-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          @keyframes bubble-float {
            0%, 100% { transform: none; }
          }
          @keyframes bubble-fade-in {
            from, to { opacity: 0.5; transform: none; }
          }
        }
      `}</style>
    </>
  );
}

export default FloatingBubbles;

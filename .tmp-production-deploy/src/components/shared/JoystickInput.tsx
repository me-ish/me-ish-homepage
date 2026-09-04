'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

type JoystickInputProps = {
  onMove: (offset: { x: number; y: number }) => void;
  /** ジョイスティックのサイズ（px） */
  size?: number;
  /** デッドゾーン（0-1、この範囲内は0扱い） */
  deadZone?: number;
};

// 定数
const MAX_DISTANCE_RATIO = 0.4; // ノブの最大移動距離（ベースサイズの割合）

export default function JoystickInput({
  onMove,
  size = 120,
  deadZone = 0.1,
}: JoystickInputProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [intensity, setIntensity] = useState(0); // 0-1 for glow effect

  const maxDistance = size * MAX_DISTANCE_RATIO;
  const knobSize = size * 0.38;

  const updateKnob = useCallback(
    (tx: number, ty: number) => {
      const dx = tx - centerRef.current.x;
      const dy = ty - centerRef.current.y;
      const rawDistance = Math.sqrt(dx * dx + dy * dy);
      const distance = Math.min(rawDistance, maxDistance);
      const angle = Math.atan2(dy, dx);
      const offsetX = distance * Math.cos(angle);
      const offsetY = distance * Math.sin(angle);

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }

      // 正規化された値（-1 to 1）
      const normalizedX = offsetX / maxDistance;
      const normalizedY = -offsetY / maxDistance;

      // デッドゾーン適用
      const magnitude = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
      setIntensity(magnitude);

      if (magnitude < deadZone) {
        onMove({ x: 0, y: 0 });
      } else {
        // デッドゾーン外は再スケール
        const scale = (magnitude - deadZone) / (1 - deadZone);
        const scaledMagnitude = Math.min(scale, 1);
        const factor = magnitude > 0 ? scaledMagnitude / magnitude : 0;
        onMove({
          x: normalizedX * factor,
          y: normalizedY * factor,
        });
      }
    },
    [maxDistance, deadZone, onMove]
  );

  const resetKnob = useCallback(() => {
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    setIntensity(0);
    onMove({ x: 0, y: 0 });
  }, [onMove]);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    let isActive = false;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = base.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      isActive = true;
      setActive(true);
      updateKnob(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isActive) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateKnob(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
      isActive = false;
      setActive(false);
      resetKnob();
    };

    base.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      base.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [updateKnob, resetKnob]);

  // グローの強度（操作量に応じて変化）
  const glowOpacity = active ? 0.3 + intensity * 0.5 : 0;
  const baseOpacity = active ? 0.95 : 0.6;
  const knobScale = active ? 1 + intensity * 0.1 : 1;

  return (
    <div
      ref={baseRef}
      className="fixed z-50 touch-none select-none"
      style={{
        bottom: 24,
        left: 24,
        width: size,
        height: size,
      }}
    >
      {/* 外側のグロー */}
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-200"
        style={{
          background: `radial-gradient(circle, rgba(0, 200, 255, ${glowOpacity}) 0%, transparent 70%)`,
          transform: 'scale(1.5)',
        }}
      />

      {/* ベース（グラスモーフィズム） */}
      <div
        className="absolute inset-0 rounded-full border-2 transition-all duration-200"
        style={{
          background: `rgba(255, 255, 255, ${baseOpacity * 0.15})`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderColor: active
            ? `rgba(0, 200, 255, ${0.6 + intensity * 0.4})`
            : 'rgba(255, 255, 255, 0.3)',
          boxShadow: active
            ? `0 0 ${10 + intensity * 20}px rgba(0, 200, 255, ${0.3 + intensity * 0.3}), inset 0 0 20px rgba(255, 255, 255, 0.1)`
            : 'inset 0 0 20px rgba(255, 255, 255, 0.05)',
        }}
      />

      {/* 方向インジケーター（十字） */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="absolute w-[2px] rounded-full transition-opacity duration-200"
          style={{
            height: size * 0.3,
            background: `rgba(255, 255, 255, ${active ? 0.3 : 0.15})`,
          }}
        />
        <div
          className="absolute h-[2px] rounded-full transition-opacity duration-200"
          style={{
            width: size * 0.3,
            background: `rgba(255, 255, 255, ${active ? 0.3 : 0.15})`,
          }}
        />
      </div>

      {/* ノブ */}
      <div
        ref={knobRef}
        className="absolute rounded-full transition-shadow duration-150"
        style={{
          width: knobSize,
          height: knobSize,
          top: (size - knobSize) / 2,
          left: (size - knobSize) / 2,
          background: active
            ? `radial-gradient(circle at 30% 30%, rgba(100, 220, 255, 0.95), rgba(0, 180, 230, 0.9))`
            : `radial-gradient(circle at 30% 30%, rgba(200, 220, 230, 0.8), rgba(150, 170, 180, 0.7))`,
          boxShadow: active
            ? `0 2px 8px rgba(0, 0, 0, 0.3), 0 0 ${15 + intensity * 10}px rgba(0, 200, 255, ${0.4 + intensity * 0.4}), inset 0 1px 2px rgba(255, 255, 255, 0.5)`
            : '0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          transform: `scale(${knobScale})`,
          transition: 'background 0.2s, box-shadow 0.15s, transform 0.1s',
        }}
      />
    </div>
  );
}

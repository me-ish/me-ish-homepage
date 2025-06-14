'use client';

import React, { useRef, useState, useEffect } from 'react';

type JoystickInputProps = {
  onMove: (offset: { x: number; y: number }) => void;
};

export default function JoystickInput({ onMove }: JoystickInputProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const getOffset = (touch: Touch, rect: DOMRect) => {
    const x = touch.clientX - (rect.left + rect.width / 2);
    const y = touch.clientY - (rect.top + rect.height / 2);
    const radius = rect.width / 2;
    return {
      x: Math.max(-1, Math.min(1, x / radius)),
      y: Math.max(-1, Math.min(1, y / radius)),
    };
  };

  const handleTouchStart = (e: TouchEvent) => {
    setDragging(true);
    const rect = baseRef.current!.getBoundingClientRect();
    const offset = getOffset(e.touches[0], rect);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${offset.x * 40}px), calc(-50% + ${offset.y * 40}px))`;
    }
    onMove(offset);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging) return;
    const rect = baseRef.current!.getBoundingClientRect();
    const offset = getOffset(e.touches[0], rect);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${offset.x * 40}px), calc(-50% + ${offset.y * 40}px))`;
    }
    onMove(offset);
  };

  const handleTouchEnd = () => {
    setDragging(false);
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(-50%, -50%)';
    }
    onMove({ x: 0, y: 0 });
  };

  useEffect(() => {
    const el = baseRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart);
    el.addEventListener('touchmove', handleTouchMove);
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      style={{
        position: 'fixed',
        bottom: 30,
        left: 30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(0, 153, 255, 0.1)',
        border: '2px solid #00a1e9',
        touchAction: 'none',
        zIndex: 100,
      }}
    >
      <div
        ref={knobRef}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#00a1e9',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          transition: dragging ? 'none' : 'transform 0.1s ease',
        }}
      />
    </div>
  );
}

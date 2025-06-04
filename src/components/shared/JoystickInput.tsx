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
      x: Math.max(-radius, Math.min(radius, x)) / radius,
      y: Math.max(-radius, Math.min(radius, y)) / radius,
    };
  };

  const handleTouchStart = (e: TouchEvent) => {
    setDragging(true);
    const rect = baseRef.current!.getBoundingClientRect();
    const offset = getOffset(e.touches[0], rect);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${offset.x * 40}px, ${offset.y * 40}px)`;
    }
    onMove(offset);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging) return;
    const rect = baseRef.current!.getBoundingClientRect();
    const offset = getOffset(e.touches[0], rect);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${offset.x * 40}px, ${offset.y * 40}px)`;
    }
    onMove(offset);
  };

  const handleTouchEnd = () => {
    setDragging(false);
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
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
        position: 'absolute',
        bottom: 30,
        left: 30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.3)',
        touchAction: 'none',
        zIndex: 20,
      }}
    >
      <div
        ref={knobRef}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          transform: 'translate(0, 0)',
          transition: dragging ? 'none' : 'transform 0.1s ease',
        }}
      />
    </div>
  );
}
